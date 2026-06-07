/**
 * shared/domains.js — Source de vérité UNIQUE pour toutes les listes de domaines
 * 
 * Ce fichier est importé par tous les scripts de l'extension via esbuild.
 * Modifier les listes ICI se répercute automatiquement partout.
 */

// ─── Domaines publicitaires ─────────────────────────────────────────────────
export const AD_DOMAINS = [
  'popads.net', 'popcash.net', 'exoclick.com', 'trafficjunky.net',
  'juicyads.com', 'adsterra.com', 'propellerads.com', 'hilltopads.net',
  'bidvertiser.com', 'mgid.com', 'revcontent.com', 'taboola.com',
  'outbrain.com', 'googlesyndication.com', 'doubleclick.net',
  'googleadservices.com', 'adsafeprotected.com', 'pupupul.site',
  'clkme.me', 'adspyglass.com', 'moonads.to', 'clickaine.com',
  'tsyndicate.com', 'creativecdn.com', 'smartadserver.com', 'adbull.me',
  'adnxs.com', 'sheety.co', 'moonadsq.to', 'miniroad.store',
  'stake.com', 'playafterdark.com', 'otieu.com', 'foreignabnormality.com',
  'adnium.com', 'plugrush.com', 'push.house', 'evadav.com',
  'galaksion.com', 'kadam.net', 'richpush.co', 'traficshop.com',
  'rtmark.net', 'adxpansion.com', 'jucyadsnew.com', 'ero-advertising.com',
  'realsrv.com', 'adspirit.de', 'clicksfly.com', 'ouo.io',
  'shrinkme.io', 'exe.io', 'short.pe', 'gplinks.co', 'northseize.com'
];

// ─── Sous-ensemble prioritaire pour le player_cleaner (iframes de lecteurs) ──
export const AD_DOMAINS_PLAYER = [
  'popads.net', 'popcash.net', 'exoclick.com', 'adsterra.com',
  'propellerads.com', 'tsyndicate.com', 'pupupul.site', 'moonads.to',
  'clickaine.com', 'juicyads.com', 'adspyglass.com',
  'hilltopads.net', 'trafficjunky.net', 'clkme.me',
  'creativecdn.com', 'smartadserver.com', 'realsrv.com',
  'northseize.com', 'otieu.com', 'foreignabnormality.com'
];

// ─── Sites de streaming protégés par défaut ─────────────────────────────────
export const STREAMING_SITES = [
  'senpai-stream.quest', 'webflix.lol', 'french-stream.ac', 'frenchstream.wtf',
  'papystreaming.tv', 'voiranime.com', 'filmcomplet.link', 'streamcomplet.app',
  'wiflix.st', 'annuaire-telechargement.art', 'dpstreaming.to', 'cpasmieux.com',
  'zone-telechargement.beauty', 'vostfree.tv', 'neko-sama.fr',
  'anime-sama.fr', 'mavanime.org',
  'empire-streaming.us', 'empire-streaming.com', 'empire-streaming.net'
];

// ─── Domaines whitelistés (jamais bloqués) ──────────────────────────────────
export const WHITELIST_DOMAINS = [
  'google.com', 'accounts.google.com', 'facebook.com', 'paypal.com',
  'github.com', 'youtube.com', 'vimeo.com', 'dailymotion.com',
  'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
  'stripe.com', 'apple.com', 'microsoft.com'
];

// ─── Fonctions utilitaires ──────────────────────────────────────────────────

/**
 * Vérifie si une URL pointe vers un domaine publicitaire connu
 * @param {string} url - URL à vérifier
 * @returns {boolean}
 */
export function isAdUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url, globalThis.location?.href || 'https://localhost');
    return AD_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

/**
 * Vérifie si un hostname est whitelisté
 * @param {string} hostname
 * @returns {boolean}
 */
export function isWhitelisted(hostname) {
  if (!hostname) return false;
  return WHITELIST_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}

/**
 * Vérifie si un hostname ou URL est un domaine pub (pour player_cleaner)
 * @param {string} url
 * @returns {boolean}
 */
export function isAdDomain(url) {
  try {
    const u = new URL(url, globalThis.location?.href || 'https://localhost');
    return AD_DOMAINS_PLAYER.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

/**
 * Normalise un hostname (supprime www.)
 * @param {string} hostname
 * @returns {string}
 */
export function normalizeHost(hostname) {
  return (hostname || '').replace(/^www\./, '');
}
