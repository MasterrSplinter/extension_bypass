#!/usr/bin/env node
/**
 * Validation légère des manifests et des règles DNR :
 *  - JSON bien formé
 *  - champs obligatoires présents (manifest_version, name, version)
 *  - tous les fichiers JS/CSS référencés existent réellement
 *  - IDs de règles DNR uniques
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src');
let errors = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };

// Charge les listes partagées (script classique) pour vérifier la cohérence.
function loadBlocklists() {
  const ctx = vm.createContext({ URL, console });
  vm.runInContext(readFileSync(resolve(SRC, 'shared/blocklists.js'), 'utf8'), ctx);
  return ctx;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`JSON invalide: ${path} (${e.message})`);
    return null;
  }
}

function collectReferencedFiles(manifest) {
  const files = [];
  for (const cs of manifest.content_scripts || []) {
    files.push(...(cs.js || []), ...(cs.css || []));
  }
  const sw = manifest.background?.service_worker;
  if (sw) files.push(sw);
  files.push(...(manifest.background?.scripts || []));
  for (const r of manifest.declarative_net_request?.rule_resources || []) {
    if (r.path) files.push(r.path);
  }
  return files;
}

// Tous les patterns de matches des content_scripts, à plat.
function collectMatchPatterns(manifest) {
  const patterns = [];
  for (const cs of manifest.content_scripts || []) patterns.push(...(cs.matches || []));
  return patterns;
}

// Un domaine est couvert s'il existe un pattern `*://*.<domaine>/*`.
function domainIsMatched(domain, patterns) {
  return patterns.includes(`*://*.${domain}/*`);
}

const lists = loadBlocklists();

for (const name of ['manifest.chrome.json', 'manifest.firefox.json']) {
  console.log(`• ${name}`);
  const manifest = readJson(resolve(SRC, name));
  if (!manifest) continue;
  for (const field of ['manifest_version', 'name', 'version']) {
    if (!manifest[field]) fail(`${name}: champ obligatoire manquant « ${field} »`);
  }
  for (const ref of collectReferencedFiles(manifest)) {
    if (!existsSync(resolve(SRC, ref))) fail(`${name}: fichier référencé introuvable « ${ref} »`);
  }
  // Chaque site de streaming protégé doit être injecté par un content_script.
  const patterns = collectMatchPatterns(manifest);
  for (const domain of lists.WFB_STREAMING_SITES || []) {
    if (!domainIsMatched(domain, patterns)) {
      fail(`${name}: « ${domain} » est dans WFB_STREAMING_SITES mais absent des content_scripts.matches`);
    }
  }
}

console.log('• rules/rules.json');
const rules = readJson(resolve(SRC, 'rules/rules.json'));
if (Array.isArray(rules)) {
  const ids = new Set();
  for (const rule of rules) {
    if (ids.has(rule.id)) fail(`rules.json: id de règle dupliqué « ${rule.id} »`);
    ids.add(rule.id);
    if (!rule.action || !rule.condition) fail(`rules.json: règle ${rule.id} incomplète (action/condition)`);
  }
  console.log(`  → ${rules.length} règles, ${ids.size} ids uniques`);
} else if (rules !== null) {
  fail('rules.json doit être un tableau');
}

if (errors > 0) {
  console.error(`\n❌ Validation échouée (${errors} erreur(s))`);
  process.exit(1);
}
console.log('\n✅ Manifests et règles valides');
