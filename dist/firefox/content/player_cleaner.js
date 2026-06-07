(() => {
  // src/shared/domains.js
  var AD_DOMAINS_PLAYER = [
    "popads.net",
    "popcash.net",
    "exoclick.com",
    "adsterra.com",
    "propellerads.com",
    "tsyndicate.com",
    "pupupul.site",
    "moonads.to",
    "clickaine.com",
    "juicyads.com",
    "adspyglass.com",
    "hilltopads.net",
    "trafficjunky.net",
    "clkme.me",
    "creativecdn.com",
    "smartadserver.com",
    "realsrv.com",
    "northseize.com",
    "otieu.com",
    "foreignabnormality.com"
  ];
  function isAdDomain(url) {
    try {
      const u = new URL(url, globalThis.location?.href || "https://localhost");
      return AD_DOMAINS_PLAYER.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
    } catch {
      return false;
    }
  }

  // src/content/player_cleaner.js
  (function() {
    "use strict";
    window.open = function() {
      console.log("[StreamBlocker/Player] window.open bloqu\xE9");
      return null;
    };
    const PLAYER_AD_SELECTORS = [
      // Overlays génériques du lecteur
      '.jw-overlays [class*="ad"]',
      ".jw-ad-container",
      ".jw-ad-skip-button",
      "#jwplayer_wrapper > div:not(.jw-wrapper)",
      // Plyr
      ".plyr__ads",
      ".plyr__preview-scrubbing[data-ad]",
      // Vidstack
      "[data-media-ad]",
      // Overlays tiers
      'div[style*="z-index: 9999"]:not([class*="player"]):not([class*="control"])',
      'div[style*="z-index:9999"]:not([class*="player"]):not([class*="control"])',
      'div[style*="position: fixed"]:not([class*="player"]):not([class*="control"])',
      // Boutons / comptes à rebours pub
      '[class*="skip-ad"]',
      '[class*="countdown"]',
      '[id*="skip-ad"]',
      '[id*="ad-countdown"]',
      // Iframes pub dans le lecteur
      'iframe[src*="popads"]',
      'iframe[src*="adsterra"]',
      'iframe[src*="tsyndicate"]',
      'iframe[src*="exoclick"]',
      'iframe[src*="pupupul"]',
      // Liens redirect pub
      'a[href*="popads"]',
      'a[href*="adsterra"]',
      'a[href*="exoclick"]'
    ];
    function cleanPlayerAds() {
      let removed = 0;
      PLAYER_AD_SELECTORS.forEach((sel) => {
        try {
          document.querySelectorAll(sel).forEach((el) => {
            el.remove();
            removed++;
          });
        } catch (e) {
        }
      });
      if (removed > 0) {
        console.log(`[StreamBlocker/Player] ${removed} \xE9l\xE9ment(s) supprim\xE9(s) dans le lecteur`);
      }
    }
    const observer = new MutationObserver(() => cleanPlayerAds());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (a && isAdDomain(a.href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("[StreamBlocker/Player] Clic pub bloqu\xE9 :", a.href);
      }
    }, true);
    const _origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
      const el = _origCreateElement(tag);
      if (tag.toLowerCase() === "script") {
        const _origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = function(name, value) {
          if (name === "src" && isAdDomain(value)) {
            console.log("[StreamBlocker/Player] Script pub bloqu\xE9 :", value);
            return;
          }
          return _origSetAttribute(name, value);
        };
      }
      return el;
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cleanPlayerAds);
    } else {
      cleanPlayerAds();
    }
    setInterval(cleanPlayerAds, 1500);
    console.log("[StreamBlocker/Player] \u2705 Nettoyeur de lecteur activ\xE9");
  })();
})();
