/**
 * tests/domains.test.mjs — Tests unitaires pour shared/domains.js
 *
 * Exécuter : node tests/run.mjs
 */
import { AD_DOMAINS, AD_DOMAINS_PLAYER, STREAMING_SITES, WHITELIST_DOMAINS, isAdUrl, isWhitelisted, isAdDomain, normalizeHost } from '../src/shared/domains.js';

// ─── Mini framework de test ────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function describe(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AD_DOMAINS', () => {
  assert(AD_DOMAINS.length > 40, `Devrait contenir >40 domaines (${AD_DOMAINS.length})`);
  assert(AD_DOMAINS.includes('popads.net'), "Devrait contenir 'popads.net'");
  assert(AD_DOMAINS.includes('exoclick.com'), "Devrait contenir 'exoclick.com'");
  assert(AD_DOMAINS.includes('northseize.com'), "Devrait contenir 'northseize.com'");

  // Vérifier l'absence de doublons
  const unique = new Set(AD_DOMAINS);
  assert(unique.size === AD_DOMAINS.length, `Pas de doublons (${unique.size} uniques vs ${AD_DOMAINS.length} total)`);
});

describe('AD_DOMAINS_PLAYER', () => {
  assert(AD_DOMAINS_PLAYER.length >= 15, `Devrait contenir >=15 domaines (${AD_DOMAINS_PLAYER.length})`);
  // Tous les domaines player devraient être dans AD_DOMAINS aussi
  const missing = AD_DOMAINS_PLAYER.filter(d => !AD_DOMAINS.includes(d));
  assert(missing.length === 0, `Tous les domaines player devraient être dans AD_DOMAINS. Manquants: ${missing.join(', ')}`);
});

describe('STREAMING_SITES', () => {
  assert(STREAMING_SITES.includes('empire-streaming.us'), "Devrait contenir 'empire-streaming.us'");
  assert(STREAMING_SITES.includes('senpai-stream.quest'), "Devrait contenir 'senpai-stream.quest'");
  assert(STREAMING_SITES.length > 10, `Devrait contenir >10 sites (${STREAMING_SITES.length})`);
});

describe('WHITELIST_DOMAINS', () => {
  assert(WHITELIST_DOMAINS.includes('google.com'), "Devrait contenir 'google.com'");
  assert(WHITELIST_DOMAINS.includes('youtube.com'), "Devrait contenir 'youtube.com'");
  assert(!WHITELIST_DOMAINS.includes('popads.net'), "Ne devrait PAS contenir 'popads.net'");
});

describe('isAdUrl()', () => {
  assert(isAdUrl('https://popads.net/popup') === true, 'popads.net devrait être détecté');
  assert(isAdUrl('https://sub.exoclick.com/serve') === true, 'sub.exoclick.com devrait être détecté');
  assert(isAdUrl('https://google.com') === false, 'google.com ne devrait PAS être détecté');
  assert(isAdUrl('https://youtube.com/watch') === false, 'youtube.com ne devrait PAS être détecté');
  assert(isAdUrl('') === false, "chaîne vide devrait retourner false");
  assert(isAdUrl(null) === false, "null devrait retourner false");
  assert(isAdUrl('not-a-url') === false, "texte invalide devrait retourner false");
  assert(isAdUrl('https://notpopads.net') === false, 'notpopads.net ne devrait PAS matcher (pas un sous-domaine)');
});

describe('isWhitelisted()', () => {
  assert(isWhitelisted('google.com') === true, 'google.com devrait être whitelisté');
  assert(isWhitelisted('accounts.google.com') === true, 'accounts.google.com devrait être whitelisté');
  assert(isWhitelisted('youtube.com') === true, 'youtube.com devrait être whitelisté');
  assert(isWhitelisted('popads.net') === false, 'popads.net ne devrait PAS être whitelisté');
  assert(isWhitelisted('') === false, "chaîne vide devrait retourner false");
  assert(isWhitelisted(null) === false, "null devrait retourner false");
});

describe('isAdDomain()', () => {
  assert(isAdDomain('https://popads.net/popup') === true, 'popads.net devrait être un domaine pub');
  assert(isAdDomain('https://hilltopads.net/x') === true, 'hilltopads.net devrait être un domaine pub');
  assert(isAdDomain('https://google.com') === false, 'google.com ne devrait PAS être un domaine pub');
});

describe('normalizeHost()', () => {
  assert(normalizeHost('www.google.com') === 'google.com', 'Devrait supprimer www.');
  assert(normalizeHost('google.com') === 'google.com', 'Devrait rester inchangé sans www.');
  assert(normalizeHost('') === '', 'Chaîne vide devrait retourner chaîne vide');
  assert(normalizeHost(null) === '', 'null devrait retourner chaîne vide');
});

// ─── Résultat ──────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ✅ ${passed} passé(s)  |  ❌ ${failed} échoué(s)`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
