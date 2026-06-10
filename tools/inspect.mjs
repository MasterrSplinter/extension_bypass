#!/usr/bin/env node
/**
 * inspect.mjs — Pilote un vrai Chromium (extension chargée) vers une URL réelle
 * et rapporte : URL finale, titre, console, iframes, éléments pub/overlay et une
 * capture d'écran. Permet d'inspecter la VRAIE structure d'un site.
 *
 *   xvfb-run -a node tools/inspect.mjs <url> [waitMs]
 */
import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, '../dist/chrome');
const url = process.argv[2];
const waitMs = Number(process.argv[3] || 8000);
if (!url) { console.error('Usage: node tools/inspect.mjs <url> [waitMs]'); process.exit(1); }

const context = await chromium.launchPersistentContext('', {
  headless: false,
  ignoreHTTPSErrors: true,
  args: [
    '--headless=new', '--disable-quic', '--ignore-certificate-errors',
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`
  ]
});

const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

let navError = null;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
} catch (e) { navError = e.message; }

await page.waitForTimeout(waitMs);

const info = await page.evaluate(() => {
  const pick = (el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    cls: (el.className && el.className.toString().slice(0, 80)) || null,
    html: el.outerHTML.slice(0, 220)
  });
  const iframes = [...document.querySelectorAll('iframe')].map(f => f.src || f.getAttribute('src') || '(inline)');
  const adish = [...document.querySelectorAll(
    'div[class*="popup"],div[id*="popup"],div[class*="overlay"],[class*="modal"],a[target="_blank"],[class*="ad"],[id*="ad"],button'
  )].slice(0, 25).map(pick);
  return {
    title: document.title,
    host: location.hostname,
    href: location.href,
    bodyText: (document.body ? document.body.innerText.slice(0, 300) : ''),
    iframes,
    adish
  };
});

console.log('\n===== RÉSULTAT =====');
console.log('navError :', navError);
console.log('href     :', info.href);
console.log('host     :', info.host);
console.log('title    :', info.title);
console.log('\n--- bodyText (300) ---\n' + info.bodyText);
console.log('\n--- iframes (' + info.iframes.length + ') ---');
info.iframes.forEach(s => console.log('  ' + s));
console.log('\n--- éléments pub/overlay candidats (' + info.adish.length + ') ---');
info.adish.forEach(e => console.log(`  <${e.tag} id=${e.id} class="${e.cls}"> ${e.html}`));
console.log('\n--- console / erreurs page (' + logs.length + ') ---');
logs.slice(0, 40).forEach(l => console.log('  ' + l));

await page.screenshot({ path: '/tmp/inspect.png', fullPage: false }).catch(() => {});
console.log('\nCapture : /tmp/inspect.png');

await context.close();
