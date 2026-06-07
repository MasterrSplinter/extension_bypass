"use strict";
(() => {
  // src/shared/domains.js
  var AD_DOMAINS = [
    "popads.net",
    "popcash.net",
    "exoclick.com",
    "trafficjunky.net",
    "juicyads.com",
    "adsterra.com",
    "propellerads.com",
    "hilltopads.net",
    "bidvertiser.com",
    "mgid.com",
    "revcontent.com",
    "taboola.com",
    "outbrain.com",
    "googlesyndication.com",
    "doubleclick.net",
    "googleadservices.com",
    "adsafeprotected.com",
    "pupupul.site",
    "clkme.me",
    "adspyglass.com",
    "moonads.to",
    "clickaine.com",
    "tsyndicate.com",
    "creativecdn.com",
    "smartadserver.com",
    "adbull.me",
    "adnxs.com",
    "sheety.co",
    "moonadsq.to",
    "miniroad.store",
    "stake.com",
    "playafterdark.com",
    "otieu.com",
    "foreignabnormality.com",
    "adnium.com",
    "plugrush.com",
    "push.house",
    "evadav.com",
    "galaksion.com",
    "kadam.net",
    "richpush.co",
    "traficshop.com",
    "rtmark.net",
    "adxpansion.com",
    "jucyadsnew.com",
    "ero-advertising.com",
    "realsrv.com",
    "adspirit.de",
    "clicksfly.com",
    "ouo.io",
    "shrinkme.io",
    "exe.io",
    "short.pe",
    "gplinks.co",
    "northseize.com"
  ];
  var STREAMING_SITES = [
    "senpai-stream.quest",
    "webflix.lol",
    "french-stream.ac",
    "frenchstream.wtf",
    "papystreaming.tv",
    "voiranime.com",
    "filmcomplet.link",
    "streamcomplet.app",
    "wiflix.st",
    "annuaire-telechargement.art",
    "dpstreaming.to",
    "cpasmieux.com",
    "zone-telechargement.beauty",
    "vostfree.tv",
    "neko-sama.fr",
    "anime-sama.fr",
    "mavanime.org",
    "empire-streaming.us",
    "empire-streaming.com",
    "empire-streaming.net"
  ];

  // src/background/background.js
  var _debugMode = false;
  function log(...args) {
    if (_debugMode) console.log(...args);
  }
  chrome.storage.sync.get(["debug_mode"]).then((data) => {
    _debugMode = data.debug_mode === true;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.debug_mode !== void 0) {
      _debugMode = changes.debug_mode.newValue === true;
    }
  });
  var REMOTE_RULES_URL = "https://raw.githubusercontent.com/webflix-adblocker/rules/main/rules.json";
  var HEURISTIC_WINDOW_MS = 1500;
  var BADGE_COLOR = "#7c3aed";
  var WHITELIST_DOMAINS2 = [
    // Sites de streaming
    "senpai-stream.quest",
    "webflix.lol",
    "french-stream.ac",
    "frenchstream.wtf",
    "papystreaming.tv",
    "voiranime.com",
    "filmcomplet.link",
    "streamcomplet.app",
    "wiflix.st",
    "empire-streaming.us",
    "empire-streaming.com",
    "empire-streaming.net",
    // Lecteurs vidéo
    "wavewatch.top",
    "apis.wavewatch.top",
    "bysebuho.com",
    "nzn3.org",
    "player4k.com",
    "viperstreamz.com",
    "viperstream.xyz",
    "viperstre.am",
    "viper4k.com",
    "streamvid.net",
    "embedme.top",
    "embtaku.com",
    "filemoon.sx",
    "filemoon.in",
    "filemoon.com",
    "filemoon.to",
    "doodstream.com",
    "dood.wf",
    "dood.cx",
    "dood.la",
    "dood.re",
    "dood.pm",
    "sibnet.ru",
    "uqload.com",
    "uqload.co",
    "uqload.io",
    "sendvid.com",
    "streamlare.com",
    "upstream.to",
    "vidoza.net",
    "voe.sx",
    "voe.bar",
    "voe.run",
    "voe.click",
    "streamtape.com",
    "streamtape.net",
    "streamtape.to",
    "turbovid.me",
    "supervideo.tv",
    "netu.ac",
    "netuplayer.top",
    "mixdrop.ag",
    "mixdrop.bz",
    "mixdrop.ch",
    "mixdrop.co",
    "mixdrop.gl",
    "mixdrop.to",
    "myviid.eu",
    "myviid.com",
    "gounlimited.to",
    "evoload.io",
    "fembed.com",
    "fembed.net",
    "femax20.com",
    "fembad.org",
    "fvs.io",
    "bflyv.com",
    "fastream.to",
    "mp4upload.com",
    "flash-vars.com",
    "wishembed.download",
    "cloudvideo.tv",
    "yourupload.com",
    "aidolove.com",
    "dropload.io",
    "playerx.stream",
    "hlsplayer.net",
    "speedostream.com",
    "streamta.pe",
    "vidhd.fun",
    "vidalyze.com",
    "dailymotion.com",
    "1fichier.com",
    // Services standards
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "googleapis.com",
    "gstatic.com",
    "cloudflare.com",
    "jsdelivr.net",
    "jwplatform.com",
    "jwpcdn.com",
    "google.com",
    "bing.com",
    "cdnjs.cloudflare.com",
    "unpkg.com",
    "ajax.googleapis.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com"
  ];
  var PLAYER_SOURCE_PATTERNS = [
    "smartlink",
    "wavewatch",
    "bysebuho",
    "nzn3",
    "viperstream",
    "viperstre",
    "viper4k",
    "filemoon",
    "streamtape",
    "dood",
    "uqload",
    "turbovid",
    "supervideo",
    "streamlare",
    "player4k",
    "embedme",
    "embtaku",
    "streamvid",
    "mixdrop",
    "myviid",
    "gounlimited",
    "fembed",
    "mp4upload",
    "cloudvideo"
  ];
  var _enabledCache = true;
  var _enabledCacheReady = false;
  var lastUserClickTime = 0;
  var _customDomainsCache = [];
  var _disabledSitesCache = [];
  function isSiteDisabled(hostname) {
    const h = normalizeHost2(hostname);
    return _disabledSitesCache.some((d) => normalizeHost2(d) === h || h.endsWith("." + normalizeHost2(d)));
  }
  async function initCache() {
    const syncData = await chrome.storage.sync.get(["enabled", "custom_domains", "disabled_sites"]);
    _enabledCache = syncData.enabled !== false;
    _customDomainsCache = syncData.custom_domains || [];
    _disabledSitesCache = syncData.disabled_sites || [];
    _enabledCacheReady = true;
    log(`[StreamBlocker/SW] Cache initialis\xE9: enabled=${_enabledCache}, custom=${_customDomainsCache.length}, disabled_sites=${_disabledSitesCache.length}`);
    if (_customDomainsCache.length > 0) {
      registerCustomDomains(_customDomainsCache);
    }
  }
  initCache();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      if (changes.enabled !== void 0) {
        const newEnabled = changes.enabled.newValue !== false;
        if (_enabledCache !== newEnabled) {
          _enabledCache = newEnabled;
          log(`[StreamBlocker/SW] Sync: enabled=${_enabledCache}`);
        }
      }
      if (changes.custom_domains !== void 0) {
        _customDomainsCache = changes.custom_domains.newValue || [];
      }
      if (changes.disabled_sites !== void 0) {
        _disabledSitesCache = changes.disabled_sites.newValue || [];
      }
    }
  });
  function isEnabled(hostname) {
    if (!_enabledCache) return false;
    if (hostname && isSiteDisabled(hostname)) return false;
    return true;
  }
  function normalizeHost2(h) {
    return (h || "").toLowerCase().replace(/^www\./, "");
  }
  function isAdHostname(hostname) {
    const h = normalizeHost2(hostname);
    if (!h) return false;
    return AD_DOMAINS.some((d) => h === d || h.endsWith("." + d));
  }
  function isWhitelistedHostname(hostname) {
    const h = normalizeHost2(hostname);
    if (!h) return true;
    return WHITELIST_DOMAINS2.some((d) => h === d || h.endsWith("." + d));
  }
  function isPlayerSource(hostname) {
    const h = normalizeHost2(hostname);
    return PLAYER_SOURCE_PATTERNS.some((p) => h.includes(p));
  }
  function isStreamingSiteSource(hostname) {
    const h = normalizeHost2(hostname);
    return STREAMING_SITES.some((d) => h === d || h.endsWith("." + d)) || _customDomainsCache.some((d) => h === d || h.endsWith("." + d));
  }
  function getHostname(url) {
    if (!url || url === "about:blank" || url === "" || url.startsWith("chrome")) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
  async function safeCloseTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      return true;
    } catch {
      return false;
    }
  }
  async function updateBadge() {
    try {
      const data = await chrome.storage.local.get(["blockedCount"]);
      const count = data.blockedCount || 0;
      const text = count > 0 ? String(count) : "";
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          if (!isEnabled()) {
            await chrome.action.setBadgeText({ text: "", tabId: tab.id });
          } else {
            await chrome.action.setBadgeText({ text, tabId: tab.id });
            if (count > 0) {
              await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: tab.id });
            }
          }
        } catch {
        }
      }
    } catch {
    }
  }
  async function incrementBlockedCount(hostname, pageHostname) {
    const data = await chrome.storage.local.get(["blockedCount", "blockedHistory", "siteStats"]);
    const newCount = (data.blockedCount || 0) + 1;
    const history = data.blockedHistory || {};
    history[hostname] = (history[hostname] || 0) + 1;
    const siteStats = data.siteStats || {};
    if (pageHostname) {
      const cleanHost = pageHostname.replace(/^www\./, "");
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
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "\u{1F6E1}\uFE0F Pub bloqu\xE9e",
        message: `Onglet ferm\xE9 : ${hostname}`,
        silent: true
      });
    } catch {
    }
  }
  var _cookieCleaningEnabled = false;
  chrome.storage.sync.get(["cookie_cleaning"]).then((data) => {
    _cookieCleaningEnabled = data.cookie_cleaning === true;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.cookie_cleaning !== void 0) {
      _cookieCleaningEnabled = changes.cookie_cleaning.newValue === true;
      log("[StreamBlocker/SW] Cookie cleaning:", _cookieCleaningEnabled ? "ON" : "OFF");
    }
  });
  async function cleanTrackingCookies() {
    if (!_cookieCleaningEnabled) return 0;
    if (!chrome.cookies) return 0;
    let totalRemoved = 0;
    for (const domain of AD_DOMAINS) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        const dotCookies = await chrome.cookies.getAll({ domain: "." + domain });
        const allCookies = [...cookies, ...dotCookies];
        for (const cookie of allCookies) {
          try {
            const protocol = cookie.secure ? "https" : "http";
            const url = `${protocol}://${cookie.domain.replace(/^\./, "")}${cookie.path}`;
            await chrome.cookies.remove({ url, name: cookie.name });
            totalRemoved++;
          } catch {
          }
        }
      } catch {
      }
    }
    if (totalRemoved > 0) {
      log(`[StreamBlocker/SW] \u{1F9F9} ${totalRemoved} cookie(s) tracking supprim\xE9(s)`);
      const data = await chrome.storage.local.get(["cookiesCleanedTotal"]);
      await chrome.storage.local.set({
        cookiesCleanedTotal: (data.cookiesCleanedTotal || 0) + totalRemoved,
        lastCookieClean: Date.now()
      });
    }
    return totalRemoved;
  }
  async function setupAlarms() {
    const existing = await chrome.alarms.getAll();
    const names = existing.map((a) => a.name);
    if (!names.includes("keepAlive")) {
      chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
    }
    if (!names.includes("updateRules")) {
      chrome.alarms.create("updateRules", { periodInMinutes: 1440 });
    }
    if (!names.includes("cleanCookies")) {
      chrome.alarms.create("cleanCookies", { periodInMinutes: 30 });
    }
  }
  setupAlarms();
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "keepAlive") {
      const data = await chrome.storage.sync.get(["enabled"]);
      _enabledCache = data.enabled !== false;
    } else if (alarm.name === "updateRules") {
      await fetchAndUpdateRules();
    } else if (alarm.name === "cleanCookies") {
      await cleanTrackingCookies();
    }
  });
  var ALLOWED_RULE_ACTIONS = /* @__PURE__ */ new Set(["block", "allow", "allowAllRequests", "upgradeScheme"]);
  var MAX_REMOTE_RULES = 500;
  function validateRemoteRules(rules) {
    if (!Array.isArray(rules)) return false;
    if (rules.length === 0 || rules.length > MAX_REMOTE_RULES) return false;
    return rules.every((rule) => {
      if (typeof rule !== "object" || rule === null) return false;
      if (typeof rule.id !== "number") return false;
      if (!rule.action || typeof rule.action !== "object") return false;
      if (!rule.condition || typeof rule.condition !== "object") return false;
      if (!ALLOWED_RULE_ACTIONS.has(rule.action.type)) return false;
      if (rule.action.redirect && rule.action.redirect.url) return false;
      if (rule.action.redirect && rule.action.redirect.extensionPath && !rule.action.redirect.extensionPath.startsWith("/")) return false;
      return true;
    });
  }
  async function fetchAndUpdateRules() {
    log("[StreamBlocker/SW] \u{1F504} Tentative M\xE0J r\xE8gles distantes...");
    try {
      const response = await fetch(REMOTE_RULES_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const remoteData = await response.json();
      let remoteRules = Array.isArray(remoteData) ? remoteData : remoteData.rules || [];
      const remoteVersion = remoteData.version || null;
      if (remoteVersion) {
        const { savedRulesVersion } = await chrome.storage.local.get(["savedRulesVersion"]);
        if (savedRulesVersion === remoteVersion) {
          log(`[StreamBlocker/SW] R\xE8gles d\xE9j\xE0 \xE0 jour (v${remoteVersion}) \u2014 aucune action`);
          return;
        }
      }
      if (!validateRemoteRules(remoteRules)) {
        throw new Error("Sch\xE9ma de r\xE8gles invalide ou suspect \u2014 mise \xE0 jour annul\xE9e");
      }
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      const existingIds = existing.map((r) => r.id);
      const numberedRules = remoteRules.map((rule, i) => ({ ...rule, id: 1e3 + i }));
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingIds,
        addRules: numberedRules
      });
      await chrome.storage.local.set({
        lastRulesUpdate: Date.now(),
        rulesCount: numberedRules.length,
        savedRulesVersion: remoteVersion || "unknown"
      });
      log(`[StreamBlocker/SW] \u2705 ${numberedRules.length} r\xE8gles charg\xE9es (v${remoteVersion || "sans version"})`);
    } catch (err) {
      console.warn("[StreamBlocker/SW] \u26A0\uFE0F R\xE8gles distantes non disponibles:", err.message);
    }
  }
  chrome.storage.local.get(["lastRulesUpdate"]).then((data) => {
    const oneDayAgo = Date.now() - 864e5;
    if (!data.lastRulesUpdate || data.lastRulesUpdate < oneDayAgo) {
      fetchAndUpdateRules();
    }
  });
  async function registerCustomDomains(domains) {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
    try {
      try {
        await chrome.scripting.unregisterContentScripts({ ids: ["custom_streaming_main", "custom_streaming_isolated"] });
      } catch {
      }
      if (domains.length > 0) {
        const matches = domains.map((d) => `*://*.${d}/*`);
        const scripts = [
          {
            id: "custom_streaming_main",
            matches,
            js: ["content/main_world.js"],
            runAt: "document_start",
            world: "MAIN",
            allFrames: false
          },
          {
            id: "custom_streaming_isolated",
            matches,
            js: ["content/content.js"],
            css: ["content/content.css"],
            runAt: "document_start",
            allFrames: false
          }
        ];
        await chrome.scripting.registerContentScripts(scripts);
        console.log(`[StreamBlocker/SW] \u2705 Scripts inject\xE9s dynamiquement sur ${domains.length} domaines`);
      }
    } catch (err) {
      console.error("[StreamBlocker/SW] \u274C Erreur registerContentScripts:", err);
    }
  }
  chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
    if (!isEnabled()) return;
    const hostname = getHostname(details.url);
    if (!hostname) return;
    if (isWhitelistedHostname(hostname)) return;
    if (isAdHostname(hostname)) {
      console.log(`[StreamBlocker/SW] \u{1F6AB} Pub connue: ${hostname}`);
      if (await safeCloseTab(details.tabId)) {
        await incrementBlockedCount(hostname, hostname);
        notifyBlocked(hostname);
      }
      return;
    }
    if (details.sourceTabId) {
      try {
        const sourceTab = await chrome.tabs.get(details.sourceTabId);
        const sourceHost = getHostname(sourceTab.url);
        if (!sourceHost) return;
        const fromStreaming = isStreamingSiteSource(sourceHost);
        const fromPlayer = isPlayerSource(sourceHost);
        if (fromStreaming || fromPlayer) {
          console.log(`[StreamBlocker/SW] \u{1F6AB} Popup suspect depuis ${sourceHost} \u2192 ${hostname}`);
          if (await safeCloseTab(details.tabId)) {
            await incrementBlockedCount(hostname, sourceHost);
            notifyBlocked(hostname);
          }
          return;
        }
      } catch {
      }
    }
    try {
      const activeTabs = await chrome.tabs.query({ active: true });
      for (const tab of activeTabs) {
        const activeHost = getHostname(tab.url);
        if (!activeHost) continue;
        if (isStreamingSiteSource(activeHost) || isPlayerSource(activeHost)) {
          if (tab.id !== details.tabId) {
            console.log(`[StreamBlocker/SW] \u{1F6AB} Popup depuis onglet streaming actif ${activeHost} \u2192 ${hostname}`);
            if (await safeCloseTab(details.tabId)) {
              await incrementBlockedCount(hostname + " [active-tab]", activeHost);
              notifyBlocked(hostname);
            }
            return;
          }
        }
      }
    } catch {
    }
    if (lastUserClickTime > 0) {
      const timeSinceClick = Date.now() - lastUserClickTime;
      if (timeSinceClick >= 0 && timeSinceClick < HEURISTIC_WINDOW_MS) {
        console.log(`[StreamBlocker/SW] \u{1F6AB} Heuristique (${timeSinceClick}ms): ${hostname}`);
        if (await safeCloseTab(details.tabId)) {
          await incrementBlockedCount(hostname + " [timing]", hostname);
          notifyBlocked(hostname);
        }
      }
    }
  });
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "loading") return;
    if (!isEnabled()) return;
    const hostname = getHostname(tab.url);
    if (!hostname) return;
    if (isAdHostname(hostname)) {
      console.log(`[StreamBlocker/SW] \u{1F6AB} Tab pub d\xE9tect\xE9: ${hostname}`);
      if (await safeCloseTab(tabId)) {
        await incrementBlockedCount(hostname, hostname);
        notifyBlocked(hostname);
      }
      return;
    }
    if (isStreamingSiteSource(hostname)) {
      updateBadge();
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message.type;
    if (type === "USER_CLICK") {
      lastUserClickTime = Date.now();
      sendResponse({ ok: true });
      return false;
    }
    if (type === "GET_STATS") {
      chrome.storage.local.get(["blockedCount", "blockedHistory", "lastRulesUpdate", "rulesCount", "dailyStats", "suggestedSite", "siteStats", "cookiesCleanedTotal", "lastCookieClean"]).then((data) => {
        sendResponse({
          blockedCount: data.blockedCount || 0,
          blockedHistory: data.blockedHistory || {},
          lastRulesUpdate: data.lastRulesUpdate || null,
          rulesCount: data.rulesCount || 40,
          dailyStats: data.dailyStats || {},
          // [S4] Stats par jour
          suggestedSite: data.suggestedSite || null,
          // [S2] Site suggestionné
          siteStats: data.siteStats || {},
          // Stats par site visité
          cookiesCleanedTotal: data.cookiesCleanedTotal || 0,
          lastCookieClean: data.lastCookieClean || null,
          cookieCleaningEnabled: _cookieCleaningEnabled,
          enabled: _enabledCache,
          disabledSites: _disabledSitesCache
          // [S5] Sites désactivés
        });
      });
      return true;
    }
    if (type === "CLEAN_COOKIES") {
      cleanTrackingCookies().then((count) => {
        sendResponse({ ok: true, cleaned: count });
      });
      return true;
    }
    if (type === "TOGGLE_PROTECTION") {
      const newEnabled = message.enabled;
      _enabledCache = newEnabled;
      chrome.storage.sync.set({ enabled: newEnabled }).then(async () => {
        try {
          await chrome.declarativeNetRequest.updateEnabledRulesets(
            newEnabled ? { enableRulesetIds: ["ruleset_main"], disableRulesetIds: [] } : { enableRulesetIds: [], disableRulesetIds: ["ruleset_main"] }
          );
          if (!newEnabled) {
            const existing = await chrome.declarativeNetRequest.getDynamicRules();
            const existingIds = existing.map((r) => r.id);
            if (existingIds.length > 0) {
              await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
              log(`[StreamBlocker/SW] ${existingIds.length} r\xE8gle(s) dynamique(s) d\xE9sactiv\xE9e(s)`);
            }
          } else {
            await fetchAndUpdateRules();
          }
        } catch (e) {
          console.warn("[StreamBlocker/SW] DNR toggle error:", e.message);
        }
        await updateBadge();
        log(`[StreamBlocker/SW] Protection ${newEnabled ? "\u2705 activ\xE9e" : "\u23F8\uFE0F d\xE9sactiv\xE9e"}`);
        sendResponse({ ok: true, enabled: newEnabled });
      });
      return true;
    }
    if (type === "TOGGLE_SITE_PROTECTION") {
      const { hostname, disabled } = message;
      if (!hostname) {
        sendResponse({ ok: false });
        return false;
      }
      chrome.storage.sync.get(["disabled_sites"], async (data) => {
        let disabledSites = data.disabled_sites || [];
        const h = normalizeHost2(hostname);
        if (disabled) {
          if (!disabledSites.includes(h)) disabledSites.push(h);
        } else {
          disabledSites = disabledSites.filter((d) => normalizeHost2(d) !== h);
        }
        await chrome.storage.sync.set({ disabled_sites: disabledSites });
        _disabledSitesCache = disabledSites;
        sendResponse({ ok: true, disabled_sites: disabledSites });
      });
      return true;
    }
    if (type === "GET_SITE_STATUS") {
      const { hostname } = message;
      sendResponse({
        ok: true,
        globalEnabled: _enabledCache,
        siteDisabled: hostname ? isSiteDisabled(hostname) : false,
        effectivelyEnabled: hostname ? isEnabled(hostname) : _enabledCache
      });
      return false;
    }
    if (type === "SUGGEST_SITE") {
      const { hostname } = message;
      if (hostname && !isStreamingSiteSource(hostname) && !isWhitelistedHostname(hostname)) {
        log("[StreamBlocker/SW] Site inconnu d\xE9tect\xE9 comme streaming probable :", hostname);
        chrome.storage.local.set({ suggestedSite: { hostname, detectedAt: Date.now() } });
      }
      sendResponse({ ok: true });
      return false;
    }
    if (type === "RESET_STATS") {
      chrome.storage.local.set({ blockedCount: 0, blockedHistory: {} }).then(async () => {
        await updateBadge();
        sendResponse({ ok: true });
      });
      return true;
    }
    if (type === "UPDATE_RULES_NOW") {
      fetchAndUpdateRules().then(async () => {
        const data = await chrome.storage.local.get(["rulesCount", "lastRulesUpdate"]);
        sendResponse({ ok: true, rulesCount: data.rulesCount || 40, lastRulesUpdate: data.lastRulesUpdate });
      });
      return true;
    }
    if (type === "ADD_CUSTOM_DOMAIN") {
      const domain = message.domain;
      const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
      if (typeof domain !== "string" || !DOMAIN_REGEX.test(domain) || domain.length > 253) {
        console.warn("[StreamBlocker/SW] ADD_CUSTOM_DOMAIN rejet\xE9 : domaine invalide :", domain);
        sendResponse({ ok: false, error: "Domaine invalide" });
        return true;
      }
      chrome.storage.sync.get(["custom_domains"], async (data) => {
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
    if (type === "REMOVE_CUSTOM_DOMAIN") {
      const domain = message.domain;
      chrome.storage.sync.get(["custom_domains"], async (data) => {
        let domains = data.custom_domains || [];
        if (domains.includes(domain)) {
          domains = domains.filter((d) => d !== domain);
          await chrome.storage.sync.set({ custom_domains: domains });
          _customDomainsCache = domains;
          if (domains.length > 0) {
            await registerCustomDomains(domains);
          } else {
            try {
              await chrome.scripting.unregisterContentScripts({ ids: ["custom_streaming_main", "custom_streaming_isolated"] });
            } catch {
            }
          }
        }
        sendResponse({ ok: true, custom_domains: domains });
      });
      return true;
    }
    return false;
  });
  chrome.runtime.onInstalled.addListener(async () => {
    await chrome.alarms.clearAll();
    await setupAlarms();
    log("[StreamBlocker/SW] Extension install\xE9e/mise \xE0 jour");
  });
  updateBadge();
  log("[StreamBlocker/SW] \u2705 v1.7 d\xE9marr\xE9 \u2014 +empire-streaming.us + sync + site-by-site");
})();
