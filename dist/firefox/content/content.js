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
  var WHITELIST_DOMAINS = [
    "google.com",
    "accounts.google.com",
    "facebook.com",
    "paypal.com",
    "github.com",
    "youtube.com",
    "vimeo.com",
    "dailymotion.com",
    "googleapis.com",
    "gstatic.com",
    "cloudflare.com",
    "jsdelivr.net",
    "stripe.com",
    "apple.com",
    "microsoft.com"
  ];
  function isAdUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const u = new URL(url, globalThis.location?.href || "https://localhost");
      return AD_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
    } catch {
      return false;
    }
  }
  function isWhitelisted(hostname) {
    if (!hostname) return false;
    return WHITELIST_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
  }

  // src/content/content.js
  (function() {
    "use strict";
    let _debugMode = false;
    function log(...args) {
      if (_debugMode) console.log(...args);
    }
    chrome.storage.sync.get(["debug_mode"]).then((data) => {
      _debugMode = data.debug_mode === true;
    }).catch(() => {
    });
    const WFB_NONCE = crypto.randomUUID();
    function injectMainWorldScript() {
      if (window.__WFB_MAIN_LOADED) {
        log("[StreamBlocker] main_world.js d\xE9j\xE0 charg\xE9 via manifest \u2014 skip injection dynamique");
        window.dispatchEvent(new CustomEvent("__wfb_init__", { detail: { nonce: WFB_NONCE } }));
        return;
      }
      try {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("content/main_world.js");
        script.onload = () => {
          script.remove();
          window.dispatchEvent(new CustomEvent("__wfb_init__", { detail: { nonce: WFB_NONCE } }));
        };
        (document.head || document.documentElement).appendChild(script);
      } catch (e) {
        log("[StreamBlocker] Erreur injection main_world:", e);
      }
    }
    injectMainWorldScript();
    let protectionEnabled = true;
    function loadAndSyncEnabledState() {
      const doLoad = (data) => {
        protectionEnabled = data.enabled !== false;
        syncEnabledToMainWorld(protectionEnabled);
        if (protectionEnabled) {
          removeAdElements();
          removeAntiAdblockStyles();
          removeAntiAdblockMessages();
        }
        console.log(`[StreamBlocker] Protection ${protectionEnabled ? "\u2705 activ\xE9e" : "\u23F8\uFE0F d\xE9sactiv\xE9e"} sur ${location.hostname}`);
      };
      if (chrome.storage.sync) {
        chrome.storage.sync.get(["enabled"], (syncData) => {
          if (chrome.runtime.lastError || syncData.enabled === void 0) {
            chrome.storage.local.get(["enabled"], doLoad);
          } else {
            doLoad(syncData);
          }
        });
      } else {
        chrome.storage.local.get(["enabled"], doLoad);
      }
    }
    function syncEnabledToMainWorld(enabled) {
      updateCssToggle(enabled);
      try {
        window.dispatchEvent(new CustomEvent("__wfb_set_enabled__", { detail: { enabled, nonce: WFB_NONCE } }));
      } catch {
      }
    }
    function updateCssToggle(enabled) {
      if (enabled) {
        document.documentElement.classList.remove("wfb-disabled");
      } else {
        document.documentElement.classList.add("wfb-disabled");
      }
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" && area !== "local") return;
      if (changes.enabled !== void 0) {
        const newEnabled = changes.enabled.newValue !== false;
        if (newEnabled !== protectionEnabled) {
          protectionEnabled = newEnabled;
          syncEnabledToMainWorld(protectionEnabled);
          console.log(`[StreamBlocker] Protection mise \xE0 jour: ${protectionEnabled ? "\u2705 ON" : "\u23F8\uFE0F OFF"}`);
          if (protectionEnabled) {
            observer.observe(document.documentElement, observerConfig);
          } else {
            observer.disconnect();
          }
        }
      }
    });
    document.addEventListener("click", (e) => {
      if (!protectionEnabled) return;
      const target = e.target.closest("a[href]");
      if (!target) return;
      const href = target.getAttribute("href") || "";
      const tgt = target.getAttribute("target") || "";
      const isSenpai = location.hostname.includes("senpai-stream");
      const isLivewire = isSenpai && target.closest("[wire\\:click]");
      if (!e.isTrusted) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("[StreamBlocker] Clic programmatique bloqu\xE9 vers :", href);
        return;
      }
      if (isAdUrl(href)) {
        if (isLivewire) {
          e.preventDefault();
          target.removeAttribute("target");
          console.log("[StreamBlocker] Senpai Stream: Clic pub neutralis\xE9 mais autoris\xE9 pour Livewire");
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("[StreamBlocker] Clic pub bloqu\xE9 vers :", href);
        return;
      }
      if (tgt === "_blank" && href && !href.startsWith("#") && !href.startsWith("javascript")) {
        if (isLivewire) {
          e.preventDefault();
          target.removeAttribute("target");
          console.log("[StreamBlocker] Senpai Stream: Lien _blank neutralis\xE9 (autoris\xE9 pour Livewire)");
          return;
        }
        try {
          const u = new URL(href, window.location.href);
          if (!isWhitelisted(u.hostname)) {
            e.preventDefault();
            if (!location.hostname.includes("empire-streaming")) {
              e.stopImmediatePropagation();
            }
            console.log("[StreamBlocker] Lien _blank bloqu\xE9 :", href);
            return;
          }
        } catch {
        }
      }
      try {
        const rect = target.getBoundingClientRect();
        const isHuge = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
        if (isHuge) {
          e.preventDefault();
          e.stopImmediatePropagation();
          target.remove();
          console.log("[StreamBlocker] Overlay g\xE9ant bloqu\xE9 et supprim\xE9 vers :", href);
          return;
        }
        if (window !== window.top && tgt === "_blank") {
          const linkHost = new URL(href, window.location.href).hostname;
          if (linkHost !== location.hostname) {
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log("[StreamBlocker] Clic externe depuis iframe bloqu\xE9 vers :", href);
            return;
          }
        }
      } catch {
      }
    }, true);
    document.addEventListener("mousedown", (e) => {
      if (!protectionEnabled) return;
      if (e.button !== 1) return;
      const target = e.target.closest("a[href]");
      if (!target) return;
      if (location.hostname.includes("senpai-stream") && e.target.closest("[wire\\:click]")) return;
      if (isAdUrl(target.href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    const AD_SELECTORS = [
      'div[class*="popup"]',
      'div[class*="modal"]:not([class*="player"])',
      'div[class*="overlay"]:not([class*="video"])',
      'div[id*="popup"]',
      'div[id*="overlay"]',
      'div[id*="ad-"]',
      'div[id*="-ad"]',
      'div[class*="advert"]',
      'div[class*="sponsor"]',
      'iframe[src*="popads"]',
      'iframe[src*="popcash"]',
      'iframe[src*="exoclick"]',
      'iframe[src*="adsterra"]',
      'iframe[src*="propellerads"]',
      'iframe[src*="juicyads"]',
      'iframe[src*="tsyndicate"]',
      'iframe[src*="pupupul"]',
      'iframe[src*="clkme"]',
      'iframe[src*="adspyglass"]',
      'iframe[src*="moonads"]',
      'iframe[src*="clickaine"]',
      'script[src*="popads"]',
      'script[src*="popcash"]',
      'script[src*="exoclick"]',
      'script[src*="tsyndicate"]',
      'script[src*="pupupul"]',
      'script[src*="moonads"]',
      "ins.adsbygoogle",
      '[id^="google_ads"]',
      "[data-ad-client]",
      "[data-ad-slot]",
      ".mgid-widget",
      ".taboola-widget",
      '[id*="taboola"]',
      '[class*="taboola"]',
      '[id*="outbrain"]',
      '[class*="outbrain"]'
    ];
    function removeAdElements() {
      if (!protectionEnabled) return;
      if (location.pathname.includes("player") || location.hostname.includes("player") || location.hostname.includes("fastflux") || location.hostname.includes("embed")) return;
      if (location.hostname.includes("empire-streaming")) return;
      let removed = 0;
      AD_SELECTORS.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((el) => {
            if (el.closest("#player-container") || el.closest(".video-player") || el.closest("video")) return;
            el.remove();
            removed++;
          });
        } catch (e) {
        }
      });
      if (removed > 0) {
        console.log(`[StreamBlocker] ${removed} \xE9l\xE9ment(s) publicitaire(s) supprim\xE9(s)`);
      }
    }
    function removeAntiAdblockStyles() {
      if (!protectionEnabled) return;
      if (location.hostname.includes("empire-streaming")) return;
      document.querySelectorAll("style").forEach((style) => {
        if (style.textContent.includes("adblock") || style.textContent.includes("adblocker")) {
          style.remove();
          console.log("[StreamBlocker] Style anti-adblock supprim\xE9");
        }
      });
    }
    function removeAntiAdblockMessages() {
      if (!protectionEnabled) return;
      if (location.hostname.includes("empire-streaming")) return;
      const keywords = ["adblock", "adblocker", "d\xE9sactiver votre bloqueur", "disable your ad", "whitelist"];
      document.querySelectorAll("div, section, aside, p").forEach((el) => {
        const text = el.textContent.toLowerCase();
        if (keywords.some((k) => text.includes(k)) && el.children.length < 5) {
          el.remove();
          console.log("[StreamBlocker] Message anti-adblock supprim\xE9");
        }
      });
    }
    function cleanSenpaiStreamScams() {
      if (!protectionEnabled) return;
      if (!location.hostname.includes("senpai-stream")) return;
      document.querySelectorAll('a[href*="t.me"], a[href*="telegram.me"], a[href*="vip"], a[href*="premium"], a[href*="abonnement"]').forEach((el) => {
        el.remove();
        console.log("[StreamBlocker] Lien Telegram/VIP supprim\xE9");
      });
      document.querySelectorAll('img[src*="abonnements.png"], img[src*="banners/abonnement"]').forEach((el) => {
        const link = el.closest("a");
        if (link) {
          link.remove();
          console.log("[StreamBlocker] Banni\xE8re image (lien) supprim\xE9e");
        } else {
          el.remove();
          console.log("[StreamBlocker] Banni\xE8re image supprim\xE9e");
        }
      });
      document.querySelectorAll("div, a, section, p, span").forEach((el) => {
        if (el.children.length > 15) return;
        const text = (el.innerText || el.textContent || "").toLowerCase().replace(/\s+/g, "");
        if (text.includes("abonnementdisponible") || text.includes("cryptomonnaies") || text.includes("t'abonner")) {
          el.remove();
          console.log("[StreamBlocker] Banni\xE8re abonnement supprim\xE9e (d\xE9tection texte agressive)");
        }
      });
    }
    function cleanEmpireStreamingSafe() {
      if (!protectionEnabled) return;
      if (!location.hostname.includes("empire-streaming")) return;
      document.querySelectorAll("script[src]").forEach((el) => {
        const src = el.getAttribute("src") || "";
        if (!src) return;
        if (isAdUrl(src)) {
          el.remove();
          log("[StreamBlocker] Empire Streaming : script pub supprim\xE9", src);
        }
      });
      document.querySelectorAll("iframe[src]").forEach((el) => {
        const src = el.getAttribute("src") || "";
        if (!src) return;
        if (src.includes("player") || src.includes("embed") || src.includes("stream") || src.includes("watch")) return;
        if (isAdUrl(src)) {
          el.remove();
          log("[StreamBlocker] Empire Streaming : iframe pub supprim\xE9e", src);
        }
      });
      document.querySelectorAll("script:not([src])").forEach((el) => {
        const content = el.textContent || "";
        const isAdScript = content.includes("popads") || content.includes("popcash") || content.includes("exoclick") || content.includes("window.open") && content.includes("random");
        if (isAdScript) {
          el.remove();
          log("[StreamBlocker] Empire Streaming : script pub inline supprim\xE9");
        }
      });
    }
    const observerConfig = { childList: true, subtree: true };
    const observer = new MutationObserver((mutations) => {
      if (!protectionEnabled) return;
      let shouldClean = false;
      for (const mut of mutations) {
        if (mut.addedNodes.length > 0) {
          shouldClean = true;
          break;
        }
      }
      if (shouldClean) {
        removeAdElements();
        cleanSenpaiStreamScams();
        cleanEmpireStreamingSafe();
      }
    });
    window.addEventListener("__wfb_user_click__", (e) => {
      try {
        if (location.hostname.includes("webflix.lol") && e.detail && e.detail.isPlayBtn) {
          console.log("[StreamBlocker] Webflix : Clic manuel sur Play logg\xE9");
        }
        chrome.runtime.sendMessage({ type: "USER_CLICK" });
      } catch {
      }
    }, { capture: true, passive: true });
    const sendNonce = () => {
      window.dispatchEvent(new CustomEvent("__wfb_init__", { detail: { nonce: WFB_NONCE } }));
    };
    setTimeout(sendNonce, 0);
    setTimeout(sendNonce, 50);
    setTimeout(sendNonce, 200);
    loadAndSyncEnabledState();
    chrome.storage.local.get(["enabled"], (data) => {
      if (data.enabled !== false) {
        observer.observe(document.documentElement, observerConfig);
      }
    });
    setInterval(() => {
      if (!protectionEnabled) return;
      removeAdElements();
      removeAntiAdblockMessages();
      cleanSenpaiStreamScams();
      cleanEmpireStreamingSafe();
    }, 2e3);
    let _notifLevel = "minimal";
    chrome.storage.sync.get(["notification_level"]).then((data) => {
      _notifLevel = data.notification_level || "minimal";
    }).catch(() => {
    });
    window.addEventListener("__wfb_popup_blocked__", (e) => {
      if (!protectionEnabled) return;
      if (_notifLevel === "silent") return;
      const url = e.detail && e.detail.url || "";
      let shortUrl = "";
      try {
        shortUrl = new URL(url).hostname;
      } catch {
        shortUrl = url.slice(0, 30);
      }
      const toast = document.createElement("div");
      toast.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "z-index:2147483647",
        "background:rgba(12,12,30,0.92)",
        "color:#a855f7",
        "padding:8px 14px",
        "border-radius:8px",
        "font-size:12px",
        "font-family:'Inter',sans-serif",
        "pointer-events:none",
        "border:1px solid rgba(124,58,237,0.4)",
        "backdrop-filter:blur(8px)",
        "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
        "transition:opacity 0.4s",
        "opacity:1"
      ].join(";");
      if (_notifLevel === "verbose") {
        toast.textContent = `\u{1F6AB} Popup bloqu\xE9 : ${shortUrl || "inconnu"} \u2014 ${url.slice(0, 60)}`;
      } else {
        toast.textContent = `\u{1F6AB}${shortUrl ? " " + shortUrl : " popup"} bloqu\xE9`;
      }
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
      }, 2200);
    }, { passive: true });
    function detectUnknownStreamingSite() {
      if (!location.hostname) return;
      const signals = [
        !!document.querySelector("video, video[src]"),
        // Lecteur vidéo
        !!document.querySelector('iframe[src*="player"], iframe[src*="embed"]'),
        // Iframe de lecteur
        document.querySelectorAll("iframe").length >= 2,
        // Beaucoup d'iframes
        document.querySelectorAll('[class*="overlay"], [class*="popup"]').length >= 2,
        // Overlays
        document.title.toLowerCase().match(/streaming|film|série|episode|vf|vostfr|anime/) !== null
        // Titre streaming
      ];
      const score = signals.filter(Boolean).length;
      if (score >= 3) {
        log("[StreamBlocker] Site inconnu ressemble \xE0 du streaming (score:", score, ") \u2192 envoi SUGGEST_SITE");
        try {
          chrome.runtime.sendMessage({ type: "SUGGEST_SITE", hostname: location.hostname });
        } catch {
        }
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", detectUnknownStreamingSite);
    } else {
      setTimeout(detectUnknownStreamingSite, 1500);
    }
  })();
})();
