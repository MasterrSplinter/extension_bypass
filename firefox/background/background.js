/**
 * background.js — Webflix AdBlocker Pro (Firefox)
 * Réécriture complète — architecture robuste
 *
 * FIXES:
 *  ✅ Double listener onMessage supprimé (un seul handler)
 *  ✅ Cache en mémoire pour `enabled` (mis à jour par message)
 *  ✅ Heuristique timing corrigée (lastUserClickTime=0 = jamais cliqué)
 *  ✅ Alarmes créées sans doublons (clearAlarms avant)
 *  ✅ Badge mis à jour correctement
 *  ✅ rulesCount exposé dans GET_STATS
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const REMOTE_RULES_URL = 'https://raw.githubusercontent.com/webflix-adblocker/rules/main/rules.json';
const HEURISTIC_WINDOW_MS = 800;
const BADGE_COLOR = '#7c3aed';

// ══════════════════════════════════════════════════════════════
// LISTES
// ══════════════════════════════════════════════════════════════

const AD_DOMAINS = [
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
  'shrinkme.io', 'exe.io', 'short.pe', 'gplinks.co', 'realsrv.com'
];

const STREAMING_SITES = [
  'webflix.lol', 'french-stream.ac', 'frenchstream.wtf', 'papystreaming.tv',
  'voiranime.com', 'filmcomplet.link', 'streamcomplet.app', 'wiflix.st',
  'annuaire-telechargement.art', 'dpstreaming.to', 'cpasmieux.com',
  'zone-telechargement.beauty', 'vostfree.tv', 'neko-sama.fr',
  'anime-sama.fr', 'mavanime.org'
];

const WHITELIST_DOMAINS = [
  // Sites de streaming
  'webflix.lol', 'french-stream.ac', 'frenchstream.wtf', 'papystreaming.tv',
  'voiranime.com', 'filmcomplet.link', 'streamcomplet.app', 'wiflix.st',
  // Lecteurs vidéo
  'wavewatch.top', 'apis.wavewatch.top', 'bysebuho.com', 'nzn3.org',
  'player4k.com', 'viperstreamz.com', 'viperstream.xyz', 'viperstre.am', 'viper4k.com',
  'streamvid.net', 'embedme.top', 'embtaku.com',
  'filemoon.sx', 'filemoon.in', 'filemoon.com', 'filemoon.to',
  'doodstream.com', 'dood.wf', 'dood.cx', 'dood.la', 'dood.re', 'dood.pm',
  'sibnet.ru', 'uqload.com', 'uqload.co', 'uqload.io',
  'sendvid.com', 'streamlare.com', 'upstream.to', 'vidoza.net',
  'voe.sx', 'voe.bar', 'voe.run', 'voe.click',
  'streamtape.com', 'streamtape.net', 'streamtape.to',
  'turbovid.me', 'supervideo.tv', 'netu.ac', 'netuplayer.top',
  'mixdrop.ag', 'mixdrop.bz', 'mixdrop.ch', 'mixdrop.co', 'mixdrop.gl', 'mixdrop.to',
  'myviid.eu', 'myviid.com', 'gounlimited.to', 'evoload.io',
  'fembed.com', 'fembed.net', 'femax20.com', 'fembad.org', 'fvs.io',
  'bflyv.com', 'fastream.to', 'mp4upload.com', 'flash-vars.com',
  'wishembed.download', 'cloudvideo.tv', 'yourupload.com',
  'aidolove.com', 'dropload.io', 'playerx.stream', 'hlsplayer.net',
  'speedostream.com', 'streamta.pe', 'vidhd.fun', 'vidalyze.com',
  'dailymotion.com', '1fichier.com',
  // Services standards
  'youtube.com', 'youtu.be', 'vimeo.com',
  'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
  'jwplatform.com', 'jwpcdn.com', 'google.com', 'bing.com',
  'cdnjs.cloudflare.com', 'unpkg.com', 'ajax.googleapis.com',
  'fonts.googleapis.com', 'fonts.gstatic.com'
];

const PLAYER_SOURCE_PATTERNS = [
  'wavewatch', 'bysebuho', 'nzn3', 'viperstream', 'viperstre', 'viper4k',
  'filemoon', 'streamtape', 'dood', 'uqload', 'turbovid',
  'supervideo', 'streamlare', 'player4k', 'embedme', 'embtaku', 'streamvid',
  'mixdrop', 'myviid', 'gounlimited', 'fembed', 'mp4upload', 'cloudvideo'
];

// ══════════════════════════════════════════════════════════════
// ÉTAT EN MÉMOIRE (cache pour éviter storage reads en boucle)
// ══════════════════════════════════════════════════════════════

let _enabledCache = true;        // Cache de l'état ON/OFF
let _enabledCacheReady = false;  // Indique si le cache a été initialisé
let lastUserClickTime = 0;       // Timestamp du dernier clic utilisateur (0 = jamais)
let _customDomainsCache = [];    // Cache des domaines custom ajoutés

// Charger l'état initial depuis le storage au démarrage du SW
async function initCache() {
  const data = await chrome.storage.local.get(['enabled', 'custom_domains']);
  _enabledCache = data.enabled !== false;
  _customDomainsCache = data.custom_domains || [];
  _enabledCacheReady = true;
  console.log(`[WebflixBlocker/BG] Cache initialisé: enabled=${_enabledCache}, custom=${_customDomainsCache.length}`);
  if (_customDomainsCache.length > 0) {
    registerCustomDomains(_customDomainsCache);
  }
}
initCache();

// Synchroniser le cache si le storage change (ex: fallback popup)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled !== undefined) {
    const newEnabled = changes.enabled.newValue !== false;
    if (_enabledCache !== newEnabled) {
      _enabledCache = newEnabled;
      console.log(`[WebflixBlocker/BG] Cache mis à jour via storage.onChanged: enabled=${_enabledCache}`);
    }
  }
  if (changes.custom_domains !== undefined) {
    _customDomainsCache = changes.custom_domains.newValue || [];
  }
});

function isEnabled() {
  return _enabledCache;
}

// ══════════════════════════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════════════════════════

function normalizeHost(h) {
  return (h || '').toLowerCase().replace(/^www\./, '');
}

function isAdHostname(hostname) {
  const h = normalizeHost(hostname);
  if (!h) return false;
  return AD_DOMAINS.some(d => h === d || h.endsWith('.' + d));
}

function isWhitelistedHostname(hostname) {
  const h = normalizeHost(hostname);
  if (!h) return true;
  return WHITELIST_DOMAINS.some(d => h === d || h.endsWith('.' + d));
}

function isPlayerSource(hostname) {
  const h = normalizeHost(hostname);
  return PLAYER_SOURCE_PATTERNS.some(p => h.includes(p));
}

function isStreamingSiteSource(hostname) {
  const h = normalizeHost(hostname);
  return STREAMING_SITES.some(d => h === d || h.endsWith('.' + d)) || 
         _customDomainsCache.some(d => h === d || h.endsWith('.' + d));
}

function getHostname(url) {
  if (!url || url === 'about:blank' || url === '' || url.startsWith('chrome')) return null;
  try { return new URL(url).hostname; } catch { return null; }
}

async function safeCloseTab(tabId) {
  try { await chrome.tabs.remove(tabId); return true; } catch { return false; }
}

async function updateBadge() {
  try {
    const data = await chrome.storage.local.get(['blockedCount']);
    const count = data.blockedCount || 0;
    const text = count > 0 ? String(count) : '';
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        if (!isEnabled()) {
          await chrome.action.setBadgeText({ text: '', tabId: tab.id });
        } else {
          await chrome.action.setBadgeText({ text, tabId: tab.id });
          if (count > 0) {
            await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: tab.id });
          }
        }
      } catch {}
    }
  } catch {}
}

async function incrementBlockedCount(hostname) {
  const data = await chrome.storage.local.get(['blockedCount', 'blockedHistory']);
  const newCount = (data.blockedCount || 0) + 1;
  const history = data.blockedHistory || {};
  history[hostname] = (history[hostname] || 0) + 1;
  await chrome.storage.local.set({ blockedCount: newCount, blockedHistory: history });
  await updateBadge();
  return newCount;
}

function notifyBlocked(hostname) {
  try {
    if (!chrome.notifications) return;
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: '🛡️ Pub bloquée', message: `Onglet fermé : ${hostname}`, silent: true
    });
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// KEEP-ALIVE — chrome.alarms (sans doublons)
// ══════════════════════════════════════════════════════════════

async function setupAlarms() {
  // Vérifier si les alarmes existent déjà avant de les créer
  const existing = await chrome.alarms.getAll();
  const names = existing.map(a => a.name);

  if (!names.includes('keepAlive')) {
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
  }
  if (!names.includes('updateRules')) {
    chrome.alarms.create('updateRules', { periodInMinutes: 1440 });
  }
}
setupAlarms();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    // Ping minimal — maintient le SW actif et rafraîchit le cache
    const data = await chrome.storage.local.get(['enabled']);
    _enabledCache = data.enabled !== false;
  }
  if (alarm.name === 'updateRules') {
    await fetchAndUpdateRules();
  }
});

// ══════════════════════════════════════════════════════════════
// RÈGLES DISTANTES
// ══════════════════════════════════════════════════════════════

async function fetchAndUpdateRules() {
  console.log('[WebflixBlocker/BG] 🔄 Tentative MàJ règles distantes...');
  try {
    const response = await fetch(REMOTE_RULES_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remoteRules = await response.json();
    if (!Array.isArray(remoteRules) || remoteRules.length === 0) throw new Error('Format invalide');

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existing.map(r => r.id);
    const numberedRules = remoteRules.map((rule, i) => ({ ...rule, id: 1000 + i }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: numberedRules
    });
    await chrome.storage.local.set({ lastRulesUpdate: Date.now(), rulesCount: numberedRules.length });
    console.log(`[WebflixBlocker/BG] ✅ ${numberedRules.length} règles chargées`);
  } catch (err) {
    console.warn('[WebflixBlocker/BG] ⚠️ Règles distantes non disponibles:', err.message);
  }
}

// MàJ au démarrage si nécessaire (sans bloquer le SW)
chrome.storage.local.get(['lastRulesUpdate']).then(data => {
  const oneDayAgo = Date.now() - 86400000;
  if (!data.lastRulesUpdate || data.lastRulesUpdate < oneDayAgo) {
    fetchAndUpdateRules();
  }
});

// ══════════════════════════════════════════════════════════════
// GESTION DES DOMAINES CUSTOM (Dynamic Content Scripts)
// ══════════════════════════════════════════════════════════════

async function registerCustomDomains(domains) {
  if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
  try {
    // Unregister old scripts
    try { await chrome.scripting.unregisterContentScripts({ ids: ['custom_streaming_main', 'custom_streaming_isolated'] }); } catch {}
    
    if (domains.length > 0) {
      const matches = domains.map(d => `*://*.${d}/*`);
      const scripts = [
        {
          id: 'custom_streaming_main',
          matches: matches,
          js: ['content/main_world.js'],
          runAt: 'document_start',
          world: 'MAIN',
          allFrames: false
        },
        {
          id: 'custom_streaming_isolated',
          matches: matches,
          js: ['content/content.js'],
          css: ['content/content.css'],
          runAt: 'document_start',
          allFrames: false
        }
      ];
      await chrome.scripting.registerContentScripts(scripts);
      console.log(`[WebflixBlocker/BG] ✅ Scripts injectés dynamiquement sur ${domains.length} domaines`);
    }
  } catch (err) {
    console.error('[WebflixBlocker/BG] ❌ Erreur registerContentScripts:', err);
  }
}

// ══════════════════════════════════════════════════════════════
// LISTENER 1 : Nouvel onglet créé (window.open / target=_blank)
// ══════════════════════════════════════════════════════════════

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  if (!isEnabled()) return;

  const hostname = getHostname(details.url);
  if (!hostname) return;

  // Toujours laisser passer les domaines whitelistés
  if (isWhitelistedHostname(hostname)) return;

  // Pub connue → fermer
  if (isAdHostname(hostname)) {
    console.log(`[WebflixBlocker/BG] 🚫 Pub connue: ${hostname}`);
    if (await safeCloseTab(details.tabId)) {
      await incrementBlockedCount(hostname);
      notifyBlocked(hostname);
    }
    return;
  }

  // Stratégie universelle : onglet ouvert depuis streaming ou lecteur
  if (details.sourceTabId) {
    try {
      const sourceTab  = await chrome.tabs.get(details.sourceTabId);
      const sourceHost = getHostname(sourceTab.url);
      if (!sourceHost) return;

      const fromStreaming = isStreamingSiteSource(sourceHost);
      const fromPlayer    = isPlayerSource(sourceHost);

      if (fromStreaming || fromPlayer) {
        console.log(`[WebflixBlocker/BG] 🚫 Popup suspect depuis ${sourceHost} → ${hostname}`);
        if (await safeCloseTab(details.tabId)) {
          await incrementBlockedCount(hostname);
          notifyBlocked(hostname);
        }
        return;
      }
    } catch {}
  }

  // Heuristique timing : ouvert dans les 800ms d'un clic utilisateur
  // IMPORTANT: lastUserClickTime=0 signifie "jamais cliqué", pas "clic il y a 0ms"
  if (lastUserClickTime > 0) {
    const timeSinceClick = Date.now() - lastUserClickTime;
    if (timeSinceClick >= 0 && timeSinceClick < HEURISTIC_WINDOW_MS) {
      console.log(`[WebflixBlocker/BG] 🚫 Heuristique (${timeSinceClick}ms): ${hostname}`);
      if (await safeCloseTab(details.tabId)) {
        await incrementBlockedCount(hostname + ' [timing]');
        notifyBlocked(hostname);
      }
    }
  }
});

// ══════════════════════════════════════════════════════════════
// LISTENER 2 : Tab mis à jour vers une pub (backup)
// ══════════════════════════════════════════════════════════════

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  if (!isEnabled()) return;

  const hostname = getHostname(tab.url);
  if (!hostname) return;

  if (isAdHostname(hostname)) {
    console.log(`[WebflixBlocker/BG] 🚫 Tab pub détecté: ${hostname}`);
    if (await safeCloseTab(tabId)) {
      await incrementBlockedCount(hostname);
      notifyBlocked(hostname);
    }
    return;
  }

  // Badge sur les onglets webflix uniquement
  if (hostname.includes('webflix.lol')) {
    updateBadge();
  }
});

// ══════════════════════════════════════════════════════════════
// MESSAGES (UN SEUL HANDLER — évite les conflits)
// ══════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message.type;

  // ── USER_CLICK : horodater le clic ────────────────────────
  if (type === 'USER_CLICK') {
    lastUserClickTime = Date.now();
    // Pas de sendResponse nécessaire, réponse synchrone
    sendResponse({ ok: true });
    return false;
  }

  // ── GET_STATS : statistiques complètes ────────────────────
  if (type === 'GET_STATS') {
    chrome.storage.local.get(['blockedCount', 'blockedHistory', 'lastRulesUpdate', 'rulesCount'])
      .then(data => {
        sendResponse({
          blockedCount:    data.blockedCount    || 0,
          blockedHistory:  data.blockedHistory  || {},
          lastRulesUpdate: data.lastRulesUpdate || null,
          rulesCount:      data.rulesCount      || 40,
          enabled:         _enabledCache
        });
      });
    return true; // Async
  }

  // ── TOGGLE_PROTECTION : activer/désactiver ─────────────────
  if (type === 'TOGGLE_PROTECTION') {
    const newEnabled = message.enabled;
    _enabledCache = newEnabled; // Mise à jour immédiate du cache

    chrome.storage.local.set({ enabled: newEnabled }).then(async () => {
      // Activer/désactiver les règles DNR
      try {
        await chrome.declarativeNetRequest.updateEnabledRulesets(
          newEnabled
            ? { enableRulesetIds: ['ruleset_main'], disableRulesetIds: [] }
            : { enableRulesetIds: [], disableRulesetIds: ['ruleset_main'] }
        );
      } catch (e) {
        console.warn('[WebflixBlocker/BG] DNR toggle error:', e.message);
      }

      // Mettre à jour le badge
      await updateBadge();

      console.log(`[WebflixBlocker/BG] Protection ${newEnabled ? '✅ activée' : '⏸️ désactivée'}`);
      sendResponse({ ok: true, enabled: newEnabled });
    });
    return true; // Async
  }

  // ── RESET_STATS : remettre les compteurs à zéro ────────────
  if (type === 'RESET_STATS') {
    chrome.storage.local.set({ blockedCount: 0, blockedHistory: {} }).then(async () => {
      await updateBadge();
      sendResponse({ ok: true });
    });
    return true; // Async
  }

  // ── UPDATE_RULES_NOW : forcer la MàJ des règles ────────────
  if (type === 'UPDATE_RULES_NOW') {
    fetchAndUpdateRules().then(async () => {
      const data = await chrome.storage.local.get(['rulesCount', 'lastRulesUpdate']);
      sendResponse({ ok: true, rulesCount: data.rulesCount || 40, lastRulesUpdate: data.lastRulesUpdate });
    });
    return true; // Async
  }

  // ── ADD_CUSTOM_DOMAIN : Ajouter dynamiquement un site ──────
  if (type === 'ADD_CUSTOM_DOMAIN') {
    const domain = message.domain;
    chrome.storage.local.get(['custom_domains'], async (data) => {
      const domains = data.custom_domains || [];
      if (!domains.includes(domain)) {
        domains.push(domain);
        await chrome.storage.local.set({ custom_domains: domains });
        _customDomainsCache = domains;
        await registerCustomDomains(domains);
      }
      sendResponse({ ok: true, custom_domains: domains });
    });
    return true; // Async
  }

  return false;
});

// ══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════════

// Écouter l'installation/mise à jour pour réinitialiser les alarmes
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clearAll();
  await setupAlarms();
  console.log('[WebflixBlocker/BG] Extension installée/mise à jour');
});

// Badge initial
updateBadge();

console.log('[WebflixBlocker/BG] ✅ v1.5 démarré — Architecture robuste');
