/**
 * Test e2e : charge le build dist/chrome dans un vrai Chromium et vérifie que
 * le blocage in-page fonctionne sur un hôte « streaming » simulé.
 *
 * Astuce : --host-resolver-rules fait croire au navigateur que la fixture locale
 * est servie depuis anime-sama.fr, ce qui déclenche l'injection des content
 * scripts (matche *://*.anime-sama.fr/*). On vérifie ainsi le correctif réel.
 */
import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, '../../dist/chrome');
const FIXTURE = readFileSync(resolve(HERE, 'fixtures/streaming.html'), 'utf8');
const PORT = 8973;
const PROTECTED = 'anime-sama.fr';    // mappé → 127.0.0.1
const UNPROTECTED = 'notprotected.test'; // mappé → 127.0.0.1 (contrôle négatif)

let server, context;

test.beforeAll(async () => {
  // Serveur statique : renvoie la fixture quel que soit le chemin.
  server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  context = await chromium.launchPersistentContext('', {
    headless: false, // requis pour charger une extension (tourne sous xvfb)
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP ${PROTECTED} 127.0.0.1, MAP ${UNPROTECTED} 127.0.0.1`
    ]
  });
});

test.afterAll(async () => {
  await context?.close();
  await new Promise((r) => server.close(r));
});

test('injecte les content scripts et supprime la pub sur un site protégé', async () => {
  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto(`http://${PROTECTED}:${PORT}/`, { waitUntil: 'load' });

  // La pub doit disparaître (preuve que content.js s'est injecté et a tourné).
  await expect(page.locator('#popup-overlay')).toHaveCount(0, { timeout: 5000 });

  // Le lecteur légitime et le contenu doivent rester.
  await expect(page.locator('#player-container')).toHaveCount(1);
  await expect(page.locator('#marker')).toHaveCount(1);

  // Le content script journalise son activation sur le bon hôte.
  await expect.poll(() => logs.some((l) => l.includes('anime-sama.fr')), { timeout: 5000 }).toBe(true);

  await page.close();
});

test('n’injecte PAS sur un hôte non protégé (scoping correct)', async () => {
  const page = await context.newPage();
  await page.goto(`http://${UNPROTECTED}:${PORT}/`, { waitUntil: 'load' });

  // Sans content script, la pub reste présente.
  await page.waitForTimeout(1500);
  await expect(page.locator('#popup-overlay')).toHaveCount(1);

  await page.close();
});
