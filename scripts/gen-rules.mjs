#!/usr/bin/env node
/**
 * gen-rules.mjs — Génère src/rules/rules.json à partir de la source unique.
 *
 *   règles = un bloc DNR par domaine de WFB_AD_DOMAINS (shared/blocklists.js)
 *          + les règles « spéciales » (conditions non-triviales) de rules/special.json
 *
 * Met aussi à jour WFB_DEFAULT_RULES_COUNT dans blocklists.js (métadonnée dérivée).
 *
 *   node scripts/gen-rules.mjs           → (ré)écrit rules.json + le compteur
 *   node scripts/gen-rules.mjs --check   → échoue si les fichiers ne sont pas à jour (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOCKLISTS = resolve(ROOT, 'src/shared/blocklists.js');
const SPECIAL = resolve(ROOT, 'src/rules/special.json');
const RULES = resolve(ROOT, 'src/rules/rules.json');
const CHECK = process.argv.includes('--check');

// Types de ressources par défaut pour un blocage de domaine standard.
const STANDARD_RESOURCE_TYPES = ['script', 'sub_frame', 'xmlhttprequest', 'image', 'media', 'websocket'];
const SPECIAL_ID_OFFSET = 1000; // les règles spéciales occupent une plage séparée

function loadAdDomains() {
  const ctx = vm.createContext({ URL, console });
  vm.runInContext(readFileSync(BLOCKLISTS, 'utf8'), ctx, { filename: 'blocklists.js' });
  if (!Array.isArray(ctx.WFB_AD_DOMAINS)) throw new Error('WFB_AD_DOMAINS introuvable dans blocklists.js');
  return ctx.WFB_AD_DOMAINS;
}

function buildRules() {
  const domains = loadAdDomains();
  const domainRules = domains.map((d, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: `||${d}^`, resourceTypes: STANDARD_RESOURCE_TYPES }
  }));

  const special = JSON.parse(readFileSync(SPECIAL, 'utf8')).map((rule, i) => {
    const { _comment, ...clean } = rule; // retirer le champ de documentation
    return { id: SPECIAL_ID_OFFSET + i, ...clean };
  });

  const all = [...domainRules, ...special];
  const ids = new Set();
  for (const r of all) {
    if (ids.has(r.id)) throw new Error(`id de règle dupliqué: ${r.id}`);
    ids.add(r.id);
  }
  return all;
}

function updateRulesCount(count) {
  const src = readFileSync(BLOCKLISTS, 'utf8');
  const next = src.replace(
    /var WFB_DEFAULT_RULES_COUNT = \d+;/,
    `var WFB_DEFAULT_RULES_COUNT = ${count};`
  );
  return { src, next };
}

const rules = buildRules();
const rulesJson = JSON.stringify(rules, null, 2) + '\n';
const { src: blSrc, next: blNext } = updateRulesCount(rules.length);

if (CHECK) {
  const current = readFileSync(RULES, 'utf8');
  const errors = [];
  if (current !== rulesJson) errors.push('rules.json n’est pas à jour');
  if (blSrc !== blNext) errors.push('WFB_DEFAULT_RULES_COUNT n’est pas à jour');
  if (errors.length) {
    console.error('❌ ' + errors.join(' ; ') + '. Lance `npm run gen:rules`.');
    process.exit(1);
  }
  console.log(`✅ rules.json à jour (${rules.length} règles)`);
} else {
  writeFileSync(RULES, rulesJson);
  if (blSrc !== blNext) writeFileSync(BLOCKLISTS, blNext);
  console.log(`✅ ${rules.length} règles générées → src/rules/rules.json`);
}
