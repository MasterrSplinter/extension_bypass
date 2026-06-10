/**
 * background.js — Streaming AdBlocker Pro
 * Service worker (Chrome) / event page (Firefox) — architecture robuste
 *
 * Rôles :
 *  - Cache mémoire de l'état `enabled` (mis à jour par message et storage)
 *  - Fermeture des onglets/popups publicitaires (webNavigation + tabs.onUpdated)
 *  - Heuristique timing reliée à l'onglet réellement cliqué
 *  - Gestion des domaines personnalisés (registerContentScripts)
 */

'use strict';

// Charger les modules partagés. Chrome (vrai service worker) → importScripts ;
// Firefox (event page) les reçoit déjà via le tableau `scripts` du manifest.
if (typeof WFB_AD_DOMAINS === 'undefined' && typeof importScripts === 'function') {
  importScripts('/shared/blocklists.js', '/shared/matchers.js');
}

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

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
let lastUserClickTime = 0;       // Timestamp du dernier clic utilisateur (0 = jamais)
let lastUserClickTabId = -1;     // Onglet d'où provient ce clic (USER_CLICK ne vient que des sites protégés)
let _customDomainsCache = [];    // Cache des domaines custom ajoutés

// Charger l'état initial depuis le storage au démarrage du SW
async function initCache() {
  const data = await chrome.storage.local.get(['enabled', 'custom_domains']);
  _enabledCache = data.enabled !== false;
  _customDomainsCache = data.custom_domains || [];
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
// UTILITAIRES (prédicats : shared/matchers.js)
// ══════════════════════════════════════════════════════════════

function isAdHostname(hostname) {
  return WFB_hostInList(hostname, AD_DOMAINS);
}

function isWhitelistedHostname(hostname) {
  // hostname vide → considéré comme whitelisté (ne rien fermer).
  if (!WFB_normalizeHost(hostname)) return true;
  return WFB_hostInList(hostname, WHITELIST_DOMAINS);
}

function isPlayerSource(hostname) {
  return WFB_patternInHost(hostname, PLAYER_SOURCE_PATTERNS);
}

function isStreamingSiteSource(hostname) {
  return WFB_hostInList(hostname, STREAMING_SITES) ||
         WFB_hostInList(hostname, _customDomainsCache);
}

function getHostname(url) {
  return WFB_hostnameFromUrl(url);
}

async function safeCloseTab(tabId) {
  try { await chrome.tabs.remove(tabId); return true; } catch { return false; }
}

async function updateBadge() {
  try {
    const data = await chrome.storage.local.get(['blockedCount']);
    const count = data.blockedCount || 0;
    // Badge global (sans tabId) : O(1) au lieu d'un parcours de tous les onglets.
    if (!isEnabled() || count === 0) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
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
}
setupAlarms();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    // Ping minimal — maintient le SW actif et rafraîchit le cache
    const data = await chrome.storage.local.get(['enabled']);
    _enabledCache = data.enabled !== false;
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
          js: ['shared/blocklists.js', 'shared/matchers.js', 'content/content.js'],
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

  // Heuristique timing : popup ouvert dans les 800ms d'un clic utilisateur.
  // Restreinte à l'onglet réellement cliqué (sourceTabId == onglet du dernier
  // USER_CLICK), qui provient forcément d'un site protégé puisque les content
  // scripts ne s'exécutent que là. Évite de fermer des onglets légitimes
  // ouverts depuis d'autres pages dans la même fenêtre temporelle.
  // NB: lastUserClickTime=0 signifie "jamais cliqué", pas "clic il y a 0ms".
  if (lastUserClickTime > 0 && details.sourceTabId === lastUserClickTabId) {
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

  // ── USER_CLICK : horodater le clic + mémoriser l'onglet source ──
  if (type === 'USER_CLICK') {
    lastUserClickTime = Date.now();
    lastUserClickTabId = (sender && sender.tab) ? sender.tab.id : -1;
    sendResponse({ ok: true });
    return false;
  }

  // ── GET_STATS : statistiques complètes ────────────────────
  if (type === 'GET_STATS') {
    chrome.storage.local.get(['blockedCount', 'blockedHistory', 'rulesCount'])
      .then(data => {
        sendResponse({
          blockedCount:    data.blockedCount    || 0,
          blockedHistory:  data.blockedHistory  || {},
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

console.log('[StreamBlocker/SW] ✅ Démarré — Streaming AdBlocker Pro');
