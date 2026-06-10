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
 */

'use strict';

// Charger les listes partagées. Chrome (vrai service worker) → importScripts ;
// Firefox (event page) les reçoit déjà via le tableau `scripts` du manifest.
if (typeof WFB_AD_DOMAINS === 'undefined' && typeof importScripts === 'function') {
  importScripts('/shared/blocklists.js');
}

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const REMOTE_RULES_URL = 'https://raw.githubusercontent.com/webflix-adblocker/rules/main/rules.json';
const HEURISTIC_WINDOW_MS = 800;
const BADGE_COLOR = '#7c3aed';

// ══════════════════════════════════════════════════════════════
// LISTES (source unique : shared/blocklists.js)
// ══════════════════════════════════════════════════════════════

const AD_DOMAINS = WFB_AD_DOMAINS;
const STREAMING_SITES = WFB_STREAMING_SITES;
const WHITELIST_DOMAINS = WFB_NAV_WHITELIST;
const PLAYER_SOURCE_PATTERNS = WFB_PLAYER_SOURCE_PATTERNS;

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
  console.log(`[StreamBlocker/SW] Cache initialisé: enabled=${_enabledCache}, custom=${_customDomainsCache.length}`);
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
      console.log(`[StreamBlocker/SW] Cache mis à jour via storage.onChanged: enabled=${_enabledCache}`);
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
  console.log('[StreamBlocker/SW] 🔄 Tentative MàJ règles distantes...');
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
    console.log(`[StreamBlocker/SW] ✅ ${numberedRules.length} règles chargées`);
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

  // Pub connue → fermer
  if (isAdHostname(hostname)) {
    console.log(`[StreamBlocker/SW] 🚫 Pub connue: ${hostname}`);
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
        console.log(`[StreamBlocker/SW] 🚫 Popup suspect depuis ${sourceHost} → ${hostname}`);
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
      console.log(`[StreamBlocker/SW] 🚫 Heuristique (${timeSinceClick}ms): ${hostname}`);
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
    console.log(`[StreamBlocker/SW] 🚫 Tab pub détecté: ${hostname}`);
    if (await safeCloseTab(tabId)) {
      await incrementBlockedCount(hostname);
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

  // ── GET_STATS : statistiques complètes ────────────────────
  if (type === 'GET_STATS') {
    chrome.storage.local.get(['blockedCount', 'blockedHistory', 'lastRulesUpdate', 'rulesCount'])
      .then(data => {
        sendResponse({
          blockedCount:    data.blockedCount    || 0,
          blockedHistory:  data.blockedHistory  || {},
          lastRulesUpdate: data.lastRulesUpdate || null,
          rulesCount:      data.rulesCount      || WFB_DEFAULT_RULES_COUNT,
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
        console.warn('[StreamBlocker/SW] DNR toggle error:', e.message);
      }

      // Mettre à jour le badge
      await updateBadge();

      console.log(`[StreamBlocker/SW] Protection ${newEnabled ? '✅ activée' : '⏸️ désactivée'}`);
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
      sendResponse({ ok: true, rulesCount: data.rulesCount || WFB_DEFAULT_RULES_COUNT, lastRulesUpdate: data.lastRulesUpdate });
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

  // ── REMOVE_CUSTOM_DOMAIN : Supprimer dynamiquement un site ─
  if (type === 'REMOVE_CUSTOM_DOMAIN') {
    const domain = message.domain;
    chrome.storage.local.get(['custom_domains'], async (data) => {
      let domains = data.custom_domains || [];
      if (domains.includes(domain)) {
        domains = domains.filter(d => d !== domain);
        await chrome.storage.local.set({ custom_domains: domains });
        _customDomainsCache = domains;
        if (domains.length > 0) {
          await registerCustomDomains(domains);
        } else {
          try { await chrome.scripting.unregisterContentScripts({ ids: ['custom_streaming_main', 'custom_streaming_isolated'] }); } catch {}
        }
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
  console.log('[StreamBlocker/SW] Extension installée/mise à jour');
});

// Badge initial
updateBadge();

console.log('[StreamBlocker/SW] ✅ v1.5 démarré — Architecture robuste');
