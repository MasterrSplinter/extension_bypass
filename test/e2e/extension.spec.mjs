/**
 * Tests e2e : charge le build dist/chrome dans un vrai Chromium et vérifie le
 * blocage in-page sur CHAQUE site de streaming protégé (hôtes simulés).
 *
 * Les fixtures sont servies par interception réseau Playwright (context.route) :
 * pas de serveur ni de TLS, et on évite l'upgrade HSTS forcé de certains TLD
 * (.app). Le navigateur considère la page comme servie depuis le vrai domaine,
 * ce qui déclenche l'injection des content scripts (matche *://*.<domaine>/*).
 */
import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const EXT = resolve(ROOT, 'dist/chrome');
const UNPROTECTED = 'notprotected.test';

function readFixture(name) {
  return readFileSync(resolve(HERE, 'fixtures', name), 'utf8');
}
const FIXTURES = {
  generic: readFixture('streaming.html'),
  senpai: readFixture('senpai.html'),
  overlay: readFixture('overlay.html'),
  empire: readFixture('empire.html')
};

// Liste des sites protégés depuis la source unique.
function streamingSites() {
  const ctx = vm.createContext({ URL, console });
  vm.runInContext(readFileSync(resolve(ROOT, 'src/shared/blocklists.js'), 'utf8'), ctx);
  return ctx.WFB_STREAMING_SITES;
}
const SITES = streamingSites();
// Domaines à TLD inédit (jamais listés) : doivent être reconnus par EMPREINTE de
// marque et protégés via l'injection dynamique du service worker.
const BRAND_TLD_HOSTS = ['senpai-stream.monster', 'senpai-stream.brandnewtld', 'empire-streaming.show'];
const TEST_HOSTS = new Set([...SITES, ...BRAND_TLD_HOSTS, UNPROTECTED]);

let context;
let extId;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false, // requis pour charger une extension (tourne sous xvfb)
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`
    ]
  });

  // ID de l'extension (depuis le service worker) pour lire chrome.storage via une
  // page d'extension stable dans les tests.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 8000 });
  extId = new URL(sw.url()).host;

  // Sert la fixture adaptée pour nos hôtes de test ; n'intercepte que le HTTP(S)
  // (les pages chrome-extension:// doivent se charger sans interception).
  await context.route(/^https?:\/\//, (route) => {
    let url;
    try { url = new URL(route.request().url()); } catch { return route.continue(); }
    if (!TEST_HOSTS.has(url.hostname)) return route.continue();
    let body = FIXTURES.generic;
    if (url.hostname.includes('senpai-stream') || url.pathname.startsWith('/senpai')) body = FIXTURES.senpai;
    else if (url.pathname.startsWith('/overlay')) body = FIXTURES.overlay;
    else if (url.pathname.startsWith('/empire')) body = FIXTURES.empire;
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
  });
});

test.afterAll(async () => {
  await context?.close();
});

// ── 1. Injection + blocage générique sur CHAQUE site protégé ────────────────
for (const site of SITES) {
  test(`injecte et supprime la pub sur ${site}`, async () => {
    const page = await context.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));

    await page.goto(`https://${site}/`, { waitUntil: 'load' });

    // La pub disparaît (preuve que content.js s'est injecté et a tourné).
    await expect(page.locator('#popup-overlay')).toHaveCount(0, { timeout: 6000 });
    // Le lecteur légitime reste.
    await expect(page.locator('#player-container')).toHaveCount(1);
    // Activation journalisée sur le bon hôte.
    await expect.poll(() => logs.some((l) => l.includes(site)), { timeout: 6000 }).toBe(true);

    await page.close();
  });
}

// ── 1b. Faux positifs : l'UI légitime « overlay/modal » n'est PAS supprimée ──
test('ne supprime pas l’UI légitime overlay/modal (anti faux positif)', async () => {
  const page = await context.newPage();
  await page.goto('https://empire-streaming.us/', { waitUntil: 'load' });
  // La vraie pub disparaît…
  await expect(page.locator('#popup-overlay')).toHaveCount(0, { timeout: 6000 });
  // …mais les éléments légitimes (classe overlay-/modal-, non publicitaires) restent.
  await expect(page.locator('#legit-overlay')).toHaveCount(1);
  await expect(page.locator('#legit-modal')).toHaveCount(1);
  await page.close();
});

// ── 1c. Bypass Empire : auto-clic « Regarder la video », pas « Installer » ──
test('skippe le mur d’installation d’Empire et lance le lecteur', async () => {
  test.setTimeout(20000);
  const page = await context.newPage();
  await page.goto('https://empire-streaming.us/empire-watch', { waitUntil: 'load' });

  // Le bypass clique « Regarder la video » → le lecteur apparaît.
  await expect.poll(() => page.evaluate(() => window.__empireWatched === true), { timeout: 8000 }).toBe(true);
  await expect(page.locator('#real-video')).toHaveCount(1, { timeout: 6000 });
  // Les CTA d'installation (scam) sont retirés.
  await expect(page.locator('#install-tv')).toHaveCount(0);
  await expect(page.locator('#install-btn')).toHaveCount(0);
  // On reste sur Empire (pas de navigation vers le site d'install).
  expect(new URL(page.url()).hostname).toBe('empire-streaming.us');
  await page.close();
});

// ── 2. Scoping : aucune injection sur un hôte non protégé ───────────────────
test('n’injecte PAS sur un hôte non protégé', async () => {
  const page = await context.newPage();
  await page.goto(`https://${UNPROTECTED}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await expect(page.locator('#popup-overlay')).toHaveCount(1);
  await page.close();
});

// ── 2b. Le compteur s'incrémente quand un popup/_blank pub est bloqué ───────
test('incrémente le compteur de blocages (content → SW)', async () => {
  // Lit blockedCount via une page d'options éphémère (chrome.storage stable).
  async function readCount() {
    const ext = await context.newPage();
    try {
      await ext.goto(`chrome-extension://${extId}/options/options.html`, { waitUntil: 'domcontentloaded' });
      return await ext.evaluate(async () => (await chrome.storage.local.get('blockedCount')).blockedCount || 0);
    } finally { await ext.close(); }
  }

  const page = await context.newPage();
  await page.goto('https://french-stream.ac/', { waitUntil: 'load' });
  await page.waitForTimeout(500); // laisser les listeners s'attacher
  const before = await readCount();

  // Clic sur un lien _blank (hôte non listé) → bloqué par content.js → signalé au SW.
  await page.locator('#popup-link').click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200); // laisser le SW agréger puis écrire (lot ~800ms)
  await page.close();              // fermer l'onglet avant de lire via la page d'options

  await expect.poll(readCount, { timeout: 8000 }).toBeGreaterThan(before);
});

// ── 3. main_world : un overlay géant pub est retiré ─────────────────────────
test('retire l’overlay géant publicitaire (main_world)', async () => {
  const page = await context.newPage();
  await page.goto('https://french-stream.ac/overlay', { waitUntil: 'load' });
  await expect(page.locator('#giant-ad')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('#marker')).toHaveCount(1);
  await page.close();
});

// ── 4. Bypass spécifique senpai-stream (flux Livewire) ──────────────────────
test('exécute le bypass Livewire de senpai-stream', async () => {
  test.setTimeout(25000);
  const page = await context.newPage();
  await page.goto('https://senpai-stream.quest/senpai', { waitUntil: 'load' });

  // Le bypass appelle incrementSteps (≥5) puis clique le bouton Play.
  await expect.poll(() => page.evaluate(() => window.__wfbSteps), { timeout: 12000 }).toBeGreaterThanOrEqual(5);
  await expect.poll(() => page.evaluate(() => window.__wfbPlayed), { timeout: 12000 }).toBe(true);

  // Nettoyage des scams senpai : Telegram, bannière image et bannière texte.
  await expect(page.locator('#tg')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('#promo-img-link')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('#promo-text')).toHaveCount(0, { timeout: 6000 });
  // Pub générique retirée, contenu légitime conservé.
  await expect(page.locator('#popup-overlay')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('#marker')).toHaveCount(1);

  await page.close();
});

// ── 5. Résilience au changement de domaine (empreinte de marque) ────────────
// Ces TLD ne sont dans AUCUNE liste : seule la reconnaissance par empreinte +
// l'injection dynamique du service worker peut les protéger.
for (const host of BRAND_TLD_HOSTS) {
  test(`protège un TLD inédit via empreinte : ${host}`, async () => {
    test.setTimeout(20000);
    const page = await context.newPage();
    await page.goto(`https://${host}/`, { waitUntil: 'load' });

    // Le service worker reconnaît la marque et injecte les scripts → pub retirée.
    await expect(page.locator('#popup-overlay')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('#marker')).toHaveCount(1);

    await page.close();
  });
}
