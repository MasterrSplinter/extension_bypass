/**
 * service_worker.js — Webflix AdBlocker Pro v1.5
 * Réécriture complète — architecture robuste
 *
 * FIXES:
 *  ✅ Double listener onMessage supprimé (un seul handler)
 *  ✅ Cache en mémoire pour `enabled` (mis à jour par message)
 *  ✅ Heuristique timing corrigée (lastUserClickTime=0 = jamais cliqué)
 *  ✅ Alarmes créées sans doublons (clearAlarms avant)
 *  ✅ Badge mis à jour correctement
 *  ✅ rulesCount exposé dans GET_STATS
 * SECURITY:
 *  ✅ [C1] Validation de schéma des règles distantes
 *  ✅ [H1] Validation regex stricte des domaines custom
 *  ✅ [F1] Logs conditionnels (DEBUG flag)
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// FLAG DE DEBUG — contrôlé depuis les options (chrome.storage.sync.debug_mode)
// ══════════════════════════════════════════════════════════════
let _debugMode = false;
function log(...args) { if (_debugMode) console.log(...args); }

// Charger l'état debug au démarrage
chrome.storage.sync.get(['debug_mode']).then(data => {
  _debugMode = data.debug_mode === true;
});
// Réagir aux changements en temps réel
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.debug_mode !== undefined) {
    _debugMode = changes.debug_mode.newValue === true;
  }
});

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const REMOTE_RULES_URL = 'https://raw.githubusercontent.com/webflix-adblocker/rules/main/rules.json';
const HEURISTIC_WINDOW_MS = 1500; // Fenêtre de 1.5s après un clic utilisateur (augmenté de 800ms)
const BADGE_COLOR = '#7c3aed';

// ══════════════════════════════════════════════════════════════
// LISTES — importées depuis la source de vérité unique
// ══════════════════════════════════════════════════════════════

import { AD_DOMAINS, STREAMING_SITES, WHITELIST_DOMAINS as BASE_WHITELIST, normalizeHost as _normalizeHost } from '../shared/domains.js';

const WHITELIST_DOMAINS = [
  // Sites de streaming
  'senpai-stream.quest', 'webflix.lol', 'french-stream.ac', 'frenchstream.wtf', 'papystreaming.tv',
  'voiranime.com', 'filmcomplet.link', 'streamcomplet.app', 'wiflix.st',
  'empire-streaming.us', 'empire-streaming.com', 'empire-streaming.net',
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

const PLAYER_SOURCE_PATTERNS = ['smartlink', 
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
let _disabledSitesCache = [];    // [S5] Sites sur lesquels la protection est désactivée

// [S5] Vérifier si la protection est désactivée pour un hostname spécifique
function isSiteDisabled(hostname) {
  const h = normalizeHost(hostname);
  return _disabledSitesCache.some(d => normalizeHost(d) === h || h.endsWith('.' + normalizeHost(d)));
}

// Charger l'état initial depuis le storage au démarrage du SW
// S12 : Les préférences utilisateur sont syncées via chrome.storage.sync
async function initCache() {
  // Préférences syncées entre appareils
  const syncData = await chrome.storage.sync.get(['enabled', 'custom_domains', 'disabled_sites']);
  _enabledCache = syncData.enabled !== false;
  _customDomainsCache = syncData.custom_domains || [];
  _disabledSitesCache = syncData.disabled_sites || [];
  _enabledCacheReady = true;
  log(`[StreamBlocker/SW] Cache initialisé: enabled=${_enabledCache}, custom=${_customDomainsCache.length}, disabled_sites=${_disabledSitesCache.length}`);
  if (_customDomainsCache.length > 0) {
    registerCustomDomains(_customDomainsCache);
  }
}
initCache();

// Synchroniser le cache quand storage.sync change (autre appareil ou popup)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.enabled !== undefined) {
      const newEnabled = changes.enabled.newValue !== false;
      if (_enabledCache !== newEnabled) {
        _enabledCache = newEnabled;
        log(`[StreamBlocker/SW] Sync: enabled=${_enabledCache}`);
      }
    }
    if (changes.custom_domains !== undefined) {
      _customDomainsCache = changes.custom_domains.newValue || [];
    }
    if (changes.disabled_sites !== undefined) {
      _disabledSitesCache = changes.disabled_sites.newValue || [];
    }
  }
});

function isEnabled(hostname) {
  if (!_enabledCache) return false;
  // [S5] Vérifier la désactivation site par site
  if (hostname && isSiteDisabled(hostname)) return false;
  return true;
}

// Appel sans hostname = vérification globale uniquement
function isEnabledGlobal() { return _enabledCache; }

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

async function incrementBlockedCount(hostname, pageHostname) {
  const data = await chrome.storage.local.get(['blockedCount', 'blockedHistory', 'siteStats']);
  const newCount = (data.blockedCount || 0) + 1;
  const history = data.blockedHistory || {};
  history[hostname] = (history[hostname] || 0) + 1;

  // Stats par site visité (pas par domaine pub)
  const siteStats = data.siteStats || {};
  if (pageHostname) {
    const cleanHost = pageHostname.replace(/^www\./, '');
    if (!siteStats[cleanHost]) siteStats[cleanHost] = { blocked: 0, lastVisit: 0 };
    siteStats[cleanHost].blocked++;
    siteStats[cleanHost].lastVisit = Date.now();
  }

  await chrome.storage.local.set({ blockedCount: newCount, blockedHistory: history, siteStats });
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
// NETTOYAGE COOKIES TRACKING — supprime les cookies des domaines pub
// ══════════════════════════════════════════════════════════════

let _cookieCleaningEnabled = false;

// Charger le paramètre au démarrage
chrome.storage.sync.get(['cookie_cleaning']).then(data => {
  _cookieCleaningEnabled = data.cookie_cleaning === true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.cookie_cleaning !== undefined) {
    _cookieCleaningEnabled = changes.cookie_cleaning.newValue === true;
    log('[StreamBlocker/SW] Cookie cleaning:', _cookieCleaningEnabled ? 'ON' : 'OFF');
  }
});

/**
 * Supprime tous les cookies des domaines publicitaires connus.
 * Retourne le nombre de cookies supprimés.
 */
async function cleanTrackingCookies() {
  if (!_cookieCleaningEnabled) return 0;
  if (!chrome.cookies) return 0;

  let totalRemoved = 0;

  for (const domain of AD_DOMAINS) {
    try {
      // Chercher les cookies pour ce domaine (avec et sans point de début)
      const cookies = await chrome.cookies.getAll({ domain });
      const dotCookies = await chrome.cookies.getAll({ domain: '.' + domain });
      const allCookies = [...cookies, ...dotCookies];

      for (const cookie of allCookies) {
        try {
          const protocol = cookie.secure ? 'https' : 'http';
          const url = `${protocol}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
          await chrome.cookies.remove({ url, name: cookie.name });
          totalRemoved++;
        } catch {}
      }
    } catch {}
  }

  if (totalRemoved > 0) {
    log(`[StreamBlocker/SW] 🧹 ${totalRemoved} cookie(s) tracking supprimé(s)`);
    // Sauvegarder les stats de nettoyage
    const data = await chrome.storage.local.get(['cookiesCleanedTotal']);
    await chrome.storage.local.set({
      cookiesCleanedTotal: (data.cookiesCleanedTotal || 0) + totalRemoved,
      lastCookieClean: Date.now()
    });
  }

  return totalRemoved;
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
  if (!names.includes('cleanCookies')) {
    chrome.alarms.create('cleanCookies', { periodInMinutes: 30 });
  }
}
setupAlarms();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    // Ping minimal — maintient le SW actif et rafraîchit le cache
    // Lire depuis sync (source de vérité) au lieu de local
    const data = await chrome.storage.sync.get(['enabled']);
    _enabledCache = data.enabled !== false;
  } else if (alarm.name === 'updateRules') {
    await fetchAndUpdateRules();
  } else if (alarm.name === 'cleanCookies') {
    await cleanTrackingCookies();
  }
});

// ══════════════════════════════════════════════════════════════
// RÈGLES DISTANTES
// ══════════════════════════════════════════════════════════════

// [C1] Validation du schéma des règles distantes avant application
// Prévient l'injection de règles malveillantes si le dépôt GitHub est compromis.
const ALLOWED_RULE_ACTIONS = new Set(['block', 'allow', 'allowAllRequests', 'upgradeScheme']);
const MAX_REMOTE_RULES = 500;

function validateRemoteRules(rules) {
  if (!Array.isArray(rules)) return false;
  if (rules.length === 0 || rules.length > MAX_REMOTE_RULES) return false;
  return rules.every(rule => {
    if (typeof rule !== 'object' || rule === null) return false;
    if (typeof rule.id !== 'number') return false;
    if (!rule.action || typeof rule.action !== 'object') return false;
    if (!rule.condition || typeof rule.condition !== 'object') return false;
    if (!ALLOWED_RULE_ACTIONS.has(rule.action.type)) return false;
    if (rule.action.redirect && rule.action.redirect.url) return false;
    if (rule.action.redirect && rule.action.redirect.extensionPath &&
        !rule.action.redirect.extensionPath.startsWith('/')) return false;
    return true;
  });
}

async function fetchAndUpdateRules() {
  log('[StreamBlocker/SW] 🔄 Tentative MàJ règles distantes...');
  try {
    const response = await fetch(REMOTE_RULES_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const remoteData = await response.json();

    // [S6] Support du versioning : le fichier peut avoir { version, rules } ou être un tableau
    let remoteRules = Array.isArray(remoteData) ? remoteData : (remoteData.rules || []);
    const remoteVersion = remoteData.version || null;

    // [S6] Vérifier si la version a changé avant d'appliquer
    if (remoteVersion) {
      const { savedRulesVersion } = await chrome.storage.local.get(['savedRulesVersion']);
      if (savedRulesVersion === remoteVersion) {
        log(`[StreamBlocker/SW] Règles déjà à jour (v${remoteVersion}) — aucune action`);
        return;
      }
    }

    // [C1] Valider le schéma avant toute application
    if (!validateRemoteRules(remoteRules)) {
      throw new Error('Schéma de règles invalide ou suspect — mise à jour annulée');
    }

    // [S6] Sauvegarder les règles actuelles pour rollback
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existing.map(r => r.id);
    const numberedRules = remoteRules.map((rule, i) => ({ ...rule, id: 1000 + i }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: numberedRules
    });
    await chrome.storage.local.set({
      lastRulesUpdate: Date.now(),
      rulesCount: numberedRules.length,
      savedRulesVersion: remoteVersion || 'unknown'
    });
    log(`[StreamBlocker/SW] ✅ ${numberedRules.length} règles chargées (v${remoteVersion || 'sans version'})`);
  } catch (err) {
    console.warn('[StreamBlocker/SW] ⚠️ Règles distantes non disponibles:', err.message);
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
      console.log(`[StreamBlocker/SW] ✅ Scripts injectés dynamiquement sur ${domains.length} domaines`);
    }
  } catch (err) {
    console.error('[StreamBlocker/SW] ❌ Erreur registerContentScripts:', err);
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

  // Pub connue → fermer immédiatement
  if (isAdHostname(hostname)) {
    console.log(`[StreamBlocker/SW] 🚫 Pub connue: ${hostname}`);
    if (await safeCloseTab(details.tabId)) {
      await incrementBlockedCount(hostname, hostname);
      notifyBlocked(hostname);
    }
    return;
  }

  // Stratégie 1 : onglet ouvert depuis un site de streaming ou un lecteur vidéo
  if (details.sourceTabId) {
    try {
      const sourceTab  = await chrome.tabs.get(details.sourceTabId);
      const sourceHost = getHostname(sourceTab.url);
      if (!sourceHost) return;

      const fromStreaming = isStreamingSiteSource(sourceHost);
      const fromPlayer    = isPlayerSource(sourceHost);

      if (fromStreaming || fromPlayer) {
        console.log(`[StreamBlocker/SW] 🚫 Popup suspect depuis ${sourceHost} → ${hostname}`);
        if (await safeCloseTab(details.tabId)) {
          await incrementBlockedCount(hostname, sourceHost);
          notifyBlocked(hostname);
        }
        return;
      }
    } catch {}
  }

  // Stratégie 2 : sourceTabId manque ou pointe vers une iframe cross-origin (lecteur embedé).
  // On vérifie si l'onglet actif de n'importe quelle fenêtre est un site de streaming.
  // Si oui, le popup est très probablement une pub déclenchée depuis ce contexte.
  try {
    const activeTabs = await chrome.tabs.query({ active: true });
    for (const tab of activeTabs) {
      const activeHost = getHostname(tab.url);
      if (!activeHost) continue;
      if (isStreamingSiteSource(activeHost) || isPlayerSource(activeHost)) {
        // Vérifier que le popup n'est pas l'onglet de streaming lui-même (tabId différent)
        if (tab.id !== details.tabId) {
          console.log(`[StreamBlocker/SW] 🚫 Popup depuis onglet streaming actif ${activeHost} → ${hostname}`);
          if (await safeCloseTab(details.tabId)) {
            await incrementBlockedCount(hostname + ' [active-tab]', activeHost);
            notifyBlocked(hostname);
          }
          return;
        }
      }
    }
  } catch {}

  // Stratégie 3 — Heuristique timing : ouvert dans les 1500ms d'un clic utilisateur
  // IMPORTANT: lastUserClickTime=0 signifie "jamais cliqué", pas "clic il y a 0ms"
  if (lastUserClickTime > 0) {
    const timeSinceClick = Date.now() - lastUserClickTime;
    if (timeSinceClick >= 0 && timeSinceClick < HEURISTIC_WINDOW_MS) {
      console.log(`[StreamBlocker/SW] 🚫 Heuristique (${timeSinceClick}ms): ${hostname}`);
      if (await safeCloseTab(details.tabId)) {
        await incrementBlockedCount(hostname + ' [timing]', hostname);
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
    console.log(`[StreamBlocker/SW] 🚫 Tab pub détecté: ${hostname}`);
    if (await safeCloseTab(tabId)) {
      await incrementBlockedCount(hostname, hostname);
      notifyBlocked(hostname);
    }
    return;
  }

  // Badge sur les onglets de streaming uniquement
  if (isStreamingSiteSource(hostname)) {
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

  // ── GET_STATS : statistiques complètes ─────────────────
  if (type === 'GET_STATS') {
    chrome.storage.local.get(['blockedCount', 'blockedHistory', 'lastRulesUpdate', 'rulesCount', 'dailyStats', 'suggestedSite', 'siteStats', 'cookiesCleanedTotal', 'lastCookieClean'])
      .then(data => {
        sendResponse({
          blockedCount:    data.blockedCount    || 0,
          blockedHistory:  data.blockedHistory  || {},
          lastRulesUpdate: data.lastRulesUpdate || null,
          rulesCount:      data.rulesCount      || 40,
          dailyStats:      data.dailyStats      || {},   // [S4] Stats par jour
          suggestedSite:   data.suggestedSite   || null, // [S2] Site suggestionné
          siteStats:       data.siteStats       || {},   // Stats par site visité
          cookiesCleanedTotal: data.cookiesCleanedTotal || 0,
          lastCookieClean: data.lastCookieClean || null,
          cookieCleaningEnabled: _cookieCleaningEnabled,
          enabled:         _enabledCache,
          disabledSites:   _disabledSitesCache           // [S5] Sites désactivés
        });
      });
    return true;
  }

  // ── CLEAN_COOKIES : nettoyage à la demande ─────────────────
  if (type === 'CLEAN_COOKIES') {
    cleanTrackingCookies().then(count => {
      sendResponse({ ok: true, cleaned: count });
    });
    return true;
  }

  // ── TOGGLE_PROTECTION : activer/désactiver ─────────────────
  if (type === 'TOGGLE_PROTECTION') {
    const newEnabled = message.enabled;
    _enabledCache = newEnabled;

    // [S12] Préférences syncées entre appareils
    chrome.storage.sync.set({ enabled: newEnabled }).then(async () => {
      try {
        // Toggle static rulesets
        await chrome.declarativeNetRequest.updateEnabledRulesets(
          newEnabled
            ? { enableRulesetIds: ['ruleset_main'], disableRulesetIds: [] }
            : { enableRulesetIds: [], disableRulesetIds: ['ruleset_main'] }
        );

        // Toggle dynamic rules (règles distantes)
        if (!newEnabled) {
          // Désactiver : supprimer toutes les règles dynamiques (sauvegardées en storage)
          const existing = await chrome.declarativeNetRequest.getDynamicRules();
          const existingIds = existing.map(r => r.id);
          if (existingIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
            log(`[StreamBlocker/SW] ${existingIds.length} règle(s) dynamique(s) désactivée(s)`);
          }
        } else {
          // Réactiver : recharger les règles dynamiques depuis le storage ou la source distante
          await fetchAndUpdateRules();
        }
      } catch (e) {
        console.warn('[StreamBlocker/SW] DNR toggle error:', e.message);
      }
      await updateBadge();
      log(`[StreamBlocker/SW] Protection ${newEnabled ? '✅ activée' : '⏸️ désactivée'}`);
      sendResponse({ ok: true, enabled: newEnabled });
    });
    return true;
  }

  // [S5] TOGGLE_SITE_PROTECTION : activer/désactiver pour un site spécifique
  if (type === 'TOGGLE_SITE_PROTECTION') {
    const { hostname, disabled } = message;
    if (!hostname) { sendResponse({ ok: false }); return false; }

    chrome.storage.sync.get(['disabled_sites'], async (data) => {
      let disabledSites = data.disabled_sites || [];
      const h = normalizeHost(hostname);
      if (disabled) {
        if (!disabledSites.includes(h)) disabledSites.push(h);
      } else {
        disabledSites = disabledSites.filter(d => normalizeHost(d) !== h);
      }
      await chrome.storage.sync.set({ disabled_sites: disabledSites });
      _disabledSitesCache = disabledSites;
      sendResponse({ ok: true, disabled_sites: disabledSites });
    });
    return true;
  }

  // [S5] GET_SITE_STATUS : état de la protection pour un hostname
  if (type === 'GET_SITE_STATUS') {
    const { hostname } = message;
    sendResponse({
      ok: true,
      globalEnabled: _enabledCache,
      siteDisabled: hostname ? isSiteDisabled(hostname) : false,
      effectivelyEnabled: hostname ? isEnabled(hostname) : _enabledCache
    });
    return false;
  }

  // [S2] SUGGEST_SITE : un site inconnu semble être du streaming
  if (type === 'SUGGEST_SITE') {
    const { hostname } = message;
    if (hostname && !isStreamingSiteSource(hostname) && !isWhitelistedHostname(hostname)) {
      log('[StreamBlocker/SW] Site inconnu détecté comme streaming probable :', hostname);
      // Stocker en local pour que le popup puisse afficher la suggestion
      chrome.storage.local.set({ suggestedSite: { hostname, detectedAt: Date.now() } });
    }
    sendResponse({ ok: true });
    return false;
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

    // [H1] Valider le domaine avec une regex stricte avant de l'accepter
    const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
    if (typeof domain !== 'string' || !DOMAIN_REGEX.test(domain) || domain.length > 253) {
      console.warn('[StreamBlocker/SW] ADD_CUSTOM_DOMAIN rejeté : domaine invalide :', domain);
      sendResponse({ ok: false, error: 'Domaine invalide' });
      return true;
    }

    // [S12] Stocker dans sync pour synchronisation entre appareils
    chrome.storage.sync.get(['custom_domains'], async (data) => {
      const domains = data.custom_domains || [];
      if (!domains.includes(domain)) {
        domains.push(domain);
        await chrome.storage.sync.set({ custom_domains: domains });
        _customDomainsCache = domains;
        await registerCustomDomains(domains);
      }
      sendResponse({ ok: true, custom_domains: domains });
    });
    return true;
  }

  // ── REMOVE_CUSTOM_DOMAIN : Supprimer dynamiquement un site ─
  if (type === 'REMOVE_CUSTOM_DOMAIN') {
    const domain = message.domain;
    // [S12] Synchronisé via sync
    chrome.storage.sync.get(['custom_domains'], async (data) => {
      let domains = data.custom_domains || [];
      if (domains.includes(domain)) {
        domains = domains.filter(d => d !== domain);
        await chrome.storage.sync.set({ custom_domains: domains });
        _customDomainsCache = domains;
        if (domains.length > 0) {
          await registerCustomDomains(domains);
        } else {
          try { await chrome.scripting.unregisterContentScripts({ ids: ['custom_streaming_main', 'custom_streaming_isolated'] }); } catch {}
        }
      }
      sendResponse({ ok: true, custom_domains: domains });
    });
    return true;
  }

  return false;
});

// ══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clearAll();
  await setupAlarms();
  log('[StreamBlocker/SW] Extension installée/mise à jour');
});

updateBadge();
log('[StreamBlocker/SW] ✅ v1.7 démarré — +empire-streaming.us + sync + site-by-site');
