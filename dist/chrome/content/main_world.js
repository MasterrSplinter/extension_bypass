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

  // src/content/main_world/utils.js
  var _nativeToString = Function.prototype.toString;
  var _nativeFnMap = /* @__PURE__ */ new Map();
  function makeNativeLook(fn, nativeFn) {
    _nativeFnMap.set(fn, _nativeToString.call(nativeFn));
    return fn;
  }
  Function.prototype.toString = function() {
    if (_nativeFnMap.has(this)) return _nativeFnMap.get(this);
    return _nativeToString.call(this);
  };
  _nativeFnMap.set(Function.prototype.toString, _nativeToString.call(_nativeToString));
  var nativeClick = HTMLElement.prototype.click;
  function isWhitelisted(url) {
    if (!url || typeof url !== "string") return true;
    if (url.includes("smartlink")) return false;
    if (url.startsWith("#") || url.startsWith("javascript:") || url.startsWith("/") || url.startsWith("blob:")) return true;
    try {
      const u = new URL(url, window.location.href);
      if (u.hostname === location.hostname) return true;
      return WHITELIST_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
    } catch {
      return true;
    }
  }

  // src/content/main_world/core.js
  window.__WFB_MAIN_LOADED = true;
  if (typeof window.__WFB_ENABLED === "undefined") {
    const initiallyDisabled = document.documentElement.classList.contains("wfb-disabled");
    window.__WFB_ENABLED = !initiallyDisabled;
  }
  var _wfbNonce = null;
  window.addEventListener("__wfb_init__", (e) => {
    if (e.detail && e.detail.nonce && !_wfbNonce) {
      _wfbNonce = e.detail.nonce;
      console.log("[StreamBlocker/MAIN] Nonce re\xE7u \u2705");
    }
  });
  window.addEventListener("__wfb_set_enabled__", (e) => {
    if (!e.detail || typeof e.detail !== "object") return;
    if (_wfbNonce) {
      if (e.detail.nonce !== _wfbNonce) {
        console.warn("[StreamBlocker/MAIN] \u26A0\uFE0F Event __wfb_set_enabled__ rejet\xE9 : nonce invalide");
        return;
      }
    } else {
      console.warn("[StreamBlocker/MAIN] \u26A0\uFE0F Nonce non initialis\xE9 \u2014 event accept\xE9 (fallback)");
    }
    window.__WFB_ENABLED = e.detail.enabled === true;
    console.log("[StreamBlocker/MAIN] \xC9tat protection mis \xE0 jour :", window.__WFB_ENABLED);
  }, { capture: true });
  var _wfbClassObserver = new MutationObserver(() => {
    const disabled = document.documentElement.classList.contains("wfb-disabled");
    const newState = !disabled;
    if (window.__WFB_ENABLED !== newState) {
      window.__WFB_ENABLED = newState;
      console.log("[StreamBlocker/MAIN] \xC9tat protection mis \xE0 jour (via DOM) :", newState);
    }
  });
  _wfbClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
  var _nativeOpen = window.open;
  var _fakeOpen = makeNativeLook(function open(url, target, features) {
    if (!window.__WFB_ENABLED) {
      return _nativeOpen.call(window, url, target, features);
    }
    console.log("[StreamBlocker/MAIN] window.open intercept\xE9 :", url);
    const fakeWin = {
      closed: false,
      opener: window,
      name: target || "",
      location: { href: url || "about:blank", assign: () => {
      }, replace: () => {
      } },
      document: {
        write: () => {
        },
        writeln: () => {
        },
        close: () => {
        },
        body: { innerHTML: "" }
      },
      focus: () => {
      },
      blur: () => {
      },
      close: () => {
        fakeWin.closed = true;
      },
      postMessage: () => {
      },
      addEventListener: () => {
      },
      removeEventListener: () => {
      },
      setTimeout: (fn, d) => setTimeout(fn, d),
      clearTimeout: (id) => clearTimeout(id)
    };
    setTimeout(() => {
      fakeWin.closed = true;
    }, 200);
    return fakeWin;
  }, _nativeOpen);
  window.open = _fakeOpen;
  HTMLElement.prototype.click = makeNativeLook(function click() {
    if (window.__WFB_ENABLED && (this.tagName === "A" || this.tagName === "a")) {
      const href = this.getAttribute("href") || (typeof this.href === "string" ? this.href : "");
      const target = this.getAttribute("target") || this.target || "";
      if (target === "_blank" && href && !isWhitelisted(href)) {
        console.log("[StreamBlocker/MAIN] .click() sur <a _blank> bloqu\xE9 :", href);
        return;
      }
    }
    return nativeClick.call(this);
  }, nativeClick);
  function hideAdOverlays() {
    if (!window.__WFB_ENABLED) return;
    const elements = document.querySelectorAll("a, div, iframe");
    elements.forEach((el) => {
      if (el.tagName === "A" && el.href && isAdUrl(el.href)) {
        el.remove();
        return;
      }
      const rect = el.getBoundingClientRect();
      const isGiant = rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8;
      if (isGiant) {
        const style = window.getComputedStyle(el);
        const isClickable = el.tagName === "A" || style.cursor === "pointer";
        const isOverlay = style.position === "absolute" || style.position === "fixed" || style.position === "relative";
        const isTransparent = style.opacity < 0.1 || style.backgroundColor === "rgba(0, 0, 0, 0)" || style.backgroundColor === "transparent";
        const isHighZIndex = parseInt(style.zIndex, 10) > 1e3;
        if (isClickable || isOverlay && isTransparent && isHighZIndex) {
          const elId = (el.id || "").toLowerCase();
          const elClass = (el.className || "").toString().toLowerCase();
          const isPlayButton = elId === "bigplay" || elClass.includes("big-play") || elId === "play-btn";
          if (!el.querySelector("video") && !el.classList.contains("jwplayer") && !isPlayButton) {
            console.log("[StreamBlocker/MAIN] Overlay g\xE9ant/transparent publicitaire supprim\xE9", el);
            el.remove();
          }
        }
      }
    });
  }
  try {
    const _origAssign = window.location.assign.bind(window.location);
    const _origReplace = window.location.replace.bind(window.location);
    window.location.assign = function(url) {
      if (window.__WFB_ENABLED && isAdUrl(url)) {
        console.log("[StreamBlocker/MAIN] location.assign bloqu\xE9 :", url);
        return;
      }
      return _origAssign(url);
    };
    window.location.replace = function(url) {
      if (window.__WFB_ENABLED && isAdUrl(url)) {
        console.log("[StreamBlocker/MAIN] location.replace bloqu\xE9 :", url);
        return;
      }
      return _origReplace(url);
    };
  } catch (e) {
  }
  function bypassGenericStepOverlay() {
    if (!window.__WFB_ENABLED) return false;
    const allBtns = document.querySelectorAll('button, .btn, [class*="btn"], a[class*="btn"]');
    let found = false;
    allBtns.forEach((btn) => {
      const text = (btn.textContent || btn.innerText || "").trim().toUpperCase();
      const style = window.getComputedStyle(btn);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
      const isStepBtn = text.includes("\xC9TAPE") || text.includes("ETAPE") || text.includes("STEP") || text.includes("UNLOCK") || text.includes("D\xC9BLOQUER") || text.includes("DEBLOCK") || text.includes("AUTORISER") || text.includes("CONTINUER") || text.includes("ACC\xC9DER") || text.includes("PUB") && (text.includes("1") || text.includes("2"));
      if (isStepBtn) {
        console.log("[StreamBlocker/MAIN] Bouton \xE9tape d\xE9tect\xE9 :", text);
        found = true;
        try {
          nativeClick.call(btn);
        } catch (e) {
        }
      }
    });
    return found;
  }
  document.addEventListener("click", () => {
    try {
      window.dispatchEvent(new CustomEvent("__wfb_user_click__"));
    } catch {
    }
  }, { capture: true, passive: true });

  // src/content/main_world/sites/empire.js
  function patchWebSocket() {
    if (!location.hostname.includes("empire-streaming")) return;
    const _NativeWS = window.WebSocket;
    const _nativeST = window.setTimeout;
    function FakeEmpireSocket(url, protocols) {
      const urlStr = typeof url === "string" ? url : String(url);
      const defProp = (key, val) => Object.defineProperty(this, key, {
        value: val,
        writable: true,
        configurable: true,
        enumerable: true
      });
      defProp("url", urlStr);
      defProp("readyState", 0);
      defProp("bufferedAmount", 0);
      defProp("extensions", "");
      defProp("protocol", "");
      defProp("binaryType", "blob");
      defProp("onopen", null);
      defProp("onmessage", null);
      defProp("onerror", null);
      defProp("onclose", null);
      this._listeners = {};
      this._namespaces = /* @__PURE__ */ new Set();
      console.log("[StreamBlocker/MAIN] Empire: WS intercept\xE9 (universelle) \u2192", urlStr);
      _nativeST(() => this._startHandshake(), 10);
    }
    FakeEmpireSocket.prototype._startHandshake = function() {
      Object.defineProperty(this, "readyState", { value: 1, writable: true, configurable: true });
      this._fire("open", new Event("open"));
      const sid = "bp_" + Math.random().toString(36).slice(2, 14);
      this._recv("0" + JSON.stringify({ sid, upgrades: [], pingInterval: 25e3, pingTimeout: 2e4 }));
      _nativeST(() => {
        this._recv("40");
        _nativeST(() => {
          const tk = "bypass_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
          this._recv("42" + JSON.stringify(["travelFinish", { status: true, token: tk, ip: "1.2.3.4", valid: true }]));
          console.log("[StreamBlocker/MAIN] Empire: travelFinish / \xE9mis \u2705 tk=", tk);
        }, 200);
      }, 50);
    };
    FakeEmpireSocket.prototype.send = function(rawData) {
      const data = typeof rawData === "string" ? rawData : "";
      if (!data) return;
      console.log("[StreamBlocker/MAIN] Empire: client\u2192server:", data.slice(0, 120));
      if (data === "3") return;
      const nsMatch = data.match(/^40(\/[^,]+),(.*)/);
      if (nsMatch) {
        const ns = nsMatch[1];
        const params = nsMatch[2];
        if (!this._namespaces.has(ns)) {
          this._namespaces.add(ns);
          _nativeST(() => {
            this._recv(`40${ns},{}`);
            console.log("[StreamBlocker/MAIN] Empire: namespace", ns, "confirm\xE9 \u2705");
            _nativeST(() => this._fireTravelFinish(ns, params), 150);
          }, 30);
        }
        return;
      }
    };
    FakeEmpireSocket.prototype._fireTravelFinish = function(ns, params) {
      let p = {};
      try {
        p = JSON.parse(params || "{}");
      } catch (e) {
      }
      const tk = "bypass_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
      const ip = p.ip || "1.2.3.4";
      const pkt = `42${ns},` + JSON.stringify(["travelFinish", {
        status: true,
        token: tk,
        ip,
        valid: true,
        completed: true,
        steps_remaining: 0
      }]);
      this._recv(pkt);
      console.log("[StreamBlocker/MAIN] Empire: travelFinish", ns, "\u2705 tk=", tk);
      _nativeST(() => {
        this._recv("42" + JSON.stringify(["travelFinish", { status: true, token: tk, ip, valid: true }]));
      }, 80);
    };
    FakeEmpireSocket.prototype._recv = function(data) {
      const evt = new MessageEvent("message", { data });
      if (typeof this.onmessage === "function") {
        try {
          this.onmessage(evt);
        } catch (e) {
        }
      }
      (this._listeners["message"] || []).forEach((fn) => {
        try {
          fn(evt);
        } catch (e) {
        }
      });
    };
    FakeEmpireSocket.prototype._fire = function(type, ev) {
      if (typeof this["on" + type] === "function") {
        try {
          this["on" + type](ev);
        } catch (e) {
        }
      }
      (this._listeners[type] || []).forEach((fn) => {
        try {
          fn(ev);
        } catch (e) {
        }
      });
    };
    FakeEmpireSocket.prototype.close = function() {
      try {
        this.readyState = 3;
      } catch (e) {
        Object.defineProperty(this, "readyState", { value: 3, writable: true, configurable: true });
      }
      this._fire("close", new CloseEvent("close", { wasClean: true, code: 1e3 }));
    };
    FakeEmpireSocket.prototype.addEventListener = function(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    };
    FakeEmpireSocket.prototype.removeEventListener = function(type, fn) {
      if (this._listeners[type])
        this._listeners[type] = this._listeners[type].filter((h) => h !== fn);
    };
    FakeEmpireSocket.CONNECTING = 0;
    FakeEmpireSocket.OPEN = 1;
    FakeEmpireSocket.CLOSING = 2;
    FakeEmpireSocket.CLOSED = 3;
    function WFBWebSocket(url, protocols) {
      const urlStr = typeof url === "string" ? url : String(url);
      const isEmpire = urlStr.includes("empire-socket") || urlStr.includes("ws-premium") || urlStr.includes("socket.io") && !urlStr.includes(location.hostname);
      if (isEmpire && window.__WFB_ENABLED !== false) {
        return new FakeEmpireSocket(urlStr, protocols);
      }
      return new _NativeWS(url, protocols);
    }
    WFBWebSocket.prototype = _NativeWS.prototype;
    WFBWebSocket.CONNECTING = 0;
    WFBWebSocket.OPEN = 1;
    WFBWebSocket.CLOSING = 2;
    WFBWebSocket.CLOSED = 3;
    try {
      Object.defineProperty(globalThis, "WebSocket", {
        get() {
          if (window.__WFB_ENABLED === false) return _NativeWS;
          return WFBWebSocket;
        },
        set(v) {
          console.log("[StreamBlocker/MAIN] Empire: tentative de reset WebSocket ignor\xE9e");
        },
        configurable: true
      });
      if (window.__WFB_ENABLED !== false) {
        console.log("[StreamBlocker/MAIN] Empire: WebSocket intercept\xE9 via defineProperty \u2705");
      }
    } catch (e) {
      window.WebSocket = makeNativeLook(WFBWebSocket, _NativeWS);
      if (window.__WFB_ENABLED !== false) {
        console.log("[StreamBlocker/MAIN] Empire: WebSocket intercept\xE9 via assignment (fallback)");
      }
    }
  }
  var EMPIRE_AD_API_PATTERNS = [
    "empire-socket-streaming",
    "/certify_token",
    "/certify_ads",
    "/ad_viewed",
    "/pub_viewed",
    "/step_complete",
    "/unlock_player",
    "/unlock_access",
    "ws.empire-socket-streaming"
  ];
  var EMPIRE_STEP_SELECTORS = [
    "button",
    "a[href]",
    '[role="button"]',
    "[onclick]",
    '[class*="btn"]',
    '[class*="button"]',
    '[class*="step"]',
    '[class*="pub"]',
    '[class*="ad-"]',
    '[class*="unlock"]',
    '[class*="watch"]',
    '[id*="step"]',
    '[id*="btn"]',
    "[data-step]",
    "[data-ad]",
    "[data-pub]"
  ];
  var EMPIRE_STEP_KEYWORDS = [
    "\xE9tape",
    "etape",
    "step ",
    "pub ",
    "publicit\xE9",
    "publicite",
    "continuer",
    "suivant",
    "unlock",
    "d\xE9bloquer",
    "debloquer",
    "acc\xE9der",
    "acceder",
    "autoriser",
    "valider"
  ];
  var EMPIRE_STEP_EXCLUSION_CLASSES = [
    "slick-",
    "swiper-",
    "carousel-",
    "slider-",
    "nav-",
    "navbar-",
    "pagination",
    "breadcrumb",
    "menu-",
    "header-",
    "footer-",
    "search-",
    "filter-",
    "sort-",
    "tab-",
    "accordion-"
  ];
  var empireBypassed = false;
  var empireStepsCompleted = 0;
  var empireBypassAttempts = 0;
  var empirePlayerLaunched = false;
  var pinstallHandled = false;
  function setupEmpireStreamingAntiPopup() {
    if (!window.__WFB_ENABLED) return;
    if (!location.hostname.includes("empire-streaming")) return;
    function makeFakeAdResponse(url) {
      console.log("[StreamBlocker/MAIN] Empire: API pub intercept\xE9e \u2192", url);
      return Promise.resolve(new Response(
        JSON.stringify({
          success: true,
          certified: true,
          valid: true,
          status: "ok",
          verified: true,
          completed: true,
          step_done: true,
          unlocked: true,
          steps_remaining: 0
        }),
        { status: 200, statusText: "OK", headers: { "Content-Type": "application/json" } }
      ));
    }
    function isEmpireAdApiUrl(url) {
      if (!url || typeof url !== "string") return false;
      return EMPIRE_AD_API_PATTERNS.some((p) => url.includes(p));
    }
    const _origFetch = window.fetch;
    window.fetch = makeNativeLook(function fetch(resource, init) {
      if (window.__WFB_ENABLED === false) return _origFetch.apply(this, arguments);
      const url = typeof resource === "string" ? resource : resource && resource.url ? resource.url : "";
      if (isEmpireAdApiUrl(url)) return makeFakeAdResponse(url);
      const isSocketServer = url.includes("empire-socket-streaming") || url.includes("socket.io") && !url.includes("empire-streaming.us");
      if (isSocketServer) {
        console.log("[StreamBlocker/MAIN] Empire: socket-streaming intercept\xE9 \u2192", url.slice(0, 80));
        return makeFakeAdResponse(url);
      }
      if (init && init.method === "POST" && url.includes("empire-streaming.us")) {
        const isValidationEndpoint = url.includes("/certify") || url.includes("/validate") || url.includes("/verify") || url.includes("/certify_token") || url.includes("/unlock") || url.includes("/certify_ads") || url.includes("certify_token") || url.includes("/pub_viewed") || url.includes("/ad_viewed") || url.includes("/step_complete");
        if (isValidationEndpoint) {
          console.log("[StreamBlocker/MAIN] Empire: validation endpoint intercept\xE9 \u2192", url);
          return makeFakeAdResponse(url);
        }
        console.log("[StreamBlocker/MAIN] Empire: POST API \u2192", url.slice(0, 100), "(non intercept\xE9)");
      }
      return _origFetch.apply(this, arguments);
    }, _origFetch);
    const _origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (window.__WFB_ENABLED === false) return _origXHROpen.apply(this, arguments);
      const urlStr = String(url || "");
      if (isEmpireAdApiUrl(urlStr)) {
        this._empireAdApi = true;
        this._empireAdUrl = url;
      }
      const isSocketPolling = urlStr.includes("empire-socket-streaming") || urlStr.includes("ws-premium") || urlStr.includes("socket.io?EIO") || urlStr.includes("socket.io") && !urlStr.includes("empire-streaming.us");
      if (isSocketPolling) {
        this._empirePollingBypass = true;
      }
      return _origXHROpen.apply(this, arguments);
    };
    const _origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
      if (this._empireAdApi) {
        console.log("[StreamBlocker/MAIN] Empire: XHR pub intercept\xE9 \u2192", this._empireAdUrl);
        const fakeResp = JSON.stringify({ success: true, certified: true, status: "ok", steps_remaining: 0 });
        Object.defineProperty(this, "readyState", { configurable: true, get: () => 4 });
        Object.defineProperty(this, "status", { configurable: true, get: () => 200 });
        Object.defineProperty(this, "statusText", { configurable: true, get: () => "OK" });
        Object.defineProperty(this, "response", { configurable: true, get: () => fakeResp });
        Object.defineProperty(this, "responseText", { configurable: true, get: () => fakeResp });
        setTimeout(() => {
          if (typeof this.onreadystatechange === "function") this.onreadystatechange();
          if (typeof this.onload === "function") this.onload(new Event("load"));
        }, 30);
        return;
      }
      if (this._empirePollingBypass) {
        const fakeData = "1:0";
        Object.defineProperty(this, "status", { configurable: true, get: () => 200 });
        Object.defineProperty(this, "readyState", { configurable: true, get: () => 4 });
        Object.defineProperty(this, "responseText", { configurable: true, get: () => fakeData });
        Object.defineProperty(this, "response", { configurable: true, get: () => fakeData });
        setTimeout(() => {
          if (typeof this.onreadystatechange === "function") this.onreadystatechange();
          if (typeof this.onload === "function") this.onload(new Event("load"));
        }, 20);
        return;
      }
      return _origXHRSend.apply(this, arguments);
    };
    const _origSetInterval = window.setInterval;
    const _origSetTimeout = window.setTimeout;
    window.setInterval = makeNativeLook(function setInterval2(fn, delay, ...args) {
      if (window.__WFB_ENABLED && delay >= 500 && delay <= 6e4) {
        return _origSetInterval(fn, 50, ...args);
      }
      return _origSetInterval(fn, delay, ...args);
    }, _origSetInterval);
    window.setTimeout = makeNativeLook(function setTimeout2(fn, delay, ...args) {
      if (window.__WFB_ENABLED && delay >= 2e3 && delay <= 6e4) {
        return _origSetTimeout(fn, 100, ...args);
      }
      return _origSetTimeout(fn, delay, ...args);
    }, _origSetTimeout);
    function isEmpireStepButton(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const text = (el.textContent || el.innerText || el.value || "").toLowerCase().trim();
      const cls = (el.className || "").toString().toLowerCase();
      const id = (el.id || "").toLowerCase();
      const href = (el.getAttribute("href") || "").toLowerCase();
      if (EMPIRE_STEP_EXCLUSION_CLASSES.some((exc) => cls.includes(exc))) return false;
      if (text === "accueil" || text === "home" || text === "retour" || text === "back") return false;
      if (href.startsWith("/") && !href.includes("ad") && !href.includes("pub")) return false;
      if (cls.includes("slick-") || el.getAttribute("aria-label") === "Next slide") return false;
      if (cls.includes("btn-play") || cls.includes("btn-search") || cls.includes("btn-close")) return false;
      if (text.length > 100) return false;
      if (text === "" && !el.hasAttribute("data-step") && !el.hasAttribute("data-ad")) return false;
      const hasStepKeyword = EMPIRE_STEP_KEYWORDS.some((k) => text.includes(k));
      const hasStepClass = cls.includes("step") || cls.includes("pub") || cls.includes("ad-btn") || cls.includes("unlock");
      const hasStepId = id.includes("step") || id.includes("pub") || id.includes("ad-") || id.includes("unlock");
      const hasStepData = el.hasAttribute("data-step") || el.hasAttribute("data-ad") || el.hasAttribute("data-pub");
      const hasStepPattern = /(?:étape|step|pub)\s*\d+/i.test(text);
      return hasStepKeyword || hasStepClass || hasStepId || hasStepData || hasStepPattern;
    }
    function removeEmpireCountdowns() {
      const countdownPatterns = /\d+\s*(?:s|sec|second|seconde)/i;
      document.querySelectorAll('[class*="count"], [class*="timer"], [class*="second"], [id*="count"], [id*="timer"]').forEach((el) => {
        if (countdownPatterns.test(el.textContent || "")) {
          el.textContent = "0";
        }
      });
    }
    function autoClickEmpireSteps() {
      if (!window.__WFB_ENABLED || empireBypassed) return;
      empireBypassAttempts++;
      if (empireBypassAttempts > 60) {
        console.log("[StreamBlocker/MAIN] Empire: timeout bypass (60 tentatives)");
        empireBypassed = true;
        return;
      }
      removeEmpireCountdowns();
      const allElements = document.querySelectorAll(EMPIRE_STEP_SELECTORS.join(", "));
      let foundStep = false;
      for (const el of allElements) {
        if (!isEmpireStepButton(el)) continue;
        const text = (el.textContent || el.innerText || "").trim().slice(0, 60);
        console.log("[StreamBlocker/MAIN] Empire: bouton \xE9tape trouv\xE9 \u2192", text, el);
        try {
          nativeClick.call(el);
          foundStep = true;
          empireStepsCompleted++;
          console.log("[StreamBlocker/MAIN] Empire: \xE9tape", empireStepsCompleted, "cliqu\xE9e automatiquement");
          window.dispatchEvent(new CustomEvent("__wfb_user_click__"));
          break;
        } catch (err) {
          console.warn("[StreamBlocker/MAIN] Empire: erreur click \xE9tape:", err);
        }
      }
      if (!foundStep && empireStepsCompleted > 0) tryLaunchEmpirePlayer();
      if (!foundStep) bypassEmpirePinstallOverlay();
    }
    function bypassEmpirePinstallOverlay() {
      if (!window.__WFB_ENABLED) return;
      const pinstallBtns = document.querySelectorAll('button.pinstall-card, [class*="pinstall"]');
      if (pinstallBtns.length > 0 && !pinstallHandled) {
        const regarderBtn = pinstallBtns[1] || pinstallBtns[0];
        const styleR = window.getComputedStyle(regarderBtn);
        if (styleR.display !== "none" && styleR.visibility !== "hidden") {
          console.log('[StreamBlocker/MAIN] Empire: pinstall-card \u2192 clic "Regarder"');
          pinstallHandled = true;
          try {
            nativeClick.call(regarderBtn);
          } catch (e) {
            regarderBtn.click();
          }
          return;
        }
      }
      const allBtns = document.querySelectorAll('button, a.btn, a[class*="btn"]');
      for (const btn of allBtns) {
        const txt = (btn.innerText || btn.textContent || "").trim().toLowerCase();
        if (txt.includes("installer") || txt.includes("install")) {
          const container = btn.closest('[class*="card"], [class*="modal"], [class*="pinstall"], [class*="overlay"]') || btn.parentElement;
          if (!container) continue;
          let regarderBtn = null;
          for (const wb of container.querySelectorAll("button, a")) {
            const wt = (wb.innerText || "").trim().toLowerCase();
            if (wt.includes("regarder") || wt.includes("continuer") || wt.includes("voir") || wt.includes("video")) {
              regarderBtn = wb;
              break;
            }
          }
          if (regarderBtn && !pinstallHandled) {
            console.log('[StreamBlocker/MAIN] Empire: PWA-install overlay \u2192 clic "Regarder":', regarderBtn.innerText?.trim());
            pinstallHandled = true;
            try {
              nativeClick.call(regarderBtn);
            } catch (e) {
              regarderBtn.click();
            }
          } else if (!pinstallHandled) {
            console.log("[StreamBlocker/MAIN] Empire: PWA-install overlay \u2192 suppression forc\xE9e");
            pinstallHandled = true;
            const outerContainer = container.parentElement || container;
            try {
              outerContainer.remove();
            } catch (e) {
              outerContainer.style.display = "none";
            }
            _origSetTimeout(() => {
              pinstallHandled = false;
              tryLaunchEmpirePlayer();
            }, 500);
          }
          return;
        }
      }
      if (!pinstallHandled) {
        const allLinks = document.querySelectorAll('a[href*="empire-streaming"]');
        for (const link of allLinks) {
          const card = link.closest('[class*="card"], div[style*="background"]') || link.parentElement?.parentElement;
          if (card && card !== document.body) {
            const cardTxt = card.innerText || "";
            if (cardTxt.includes("Installer") || cardTxt.includes("install")) {
              console.log("[StreamBlocker/MAIN] Empire: card empire-streaming \u2192 suppression");
              pinstallHandled = true;
              try {
                card.remove();
              } catch (e) {
                card.style.display = "none";
              }
              _origSetTimeout(() => {
                pinstallHandled = false;
                tryLaunchEmpirePlayer();
              }, 500);
              return;
            }
          }
        }
      }
    }
    function tryLaunchEmpirePlayer() {
      if (empirePlayerLaunched) return;
      const btnPlay = document.querySelector("button.btn-play");
      if (btnPlay) {
        const s = window.getComputedStyle(btnPlay);
        if (s.display !== "none" && s.visibility !== "hidden") {
          console.log("[StreamBlocker/MAIN] Empire: btn-play trouv\xE9 \u2192 clic");
          try {
            nativeClick.call(btnPlay);
            empirePlayerLaunched = true;
            empireBypassed = true;
            console.log("[StreamBlocker/MAIN] Empire: player lanc\xE9 via btn-play \u2705");
          } catch (e) {
          }
          return;
        }
      }
      bypassEmpirePinstallOverlay();
      const iframe = document.querySelector(
        'iframe[src*="player"], iframe[src*="embed"], iframe[src*="stream"], iframe[src*="watch"]'
      );
      if (iframe && iframe.src && !isAdUrl(iframe.src)) {
        console.log("[StreamBlocker/MAIN] Empire: iframe player trouv\xE9e \u2192", iframe.src);
        empirePlayerLaunched = true;
        empireBypassed = true;
        return;
      }
      const video = document.querySelector("video[src], video source[src]");
      if (video) {
        const vid = video.tagName === "VIDEO" ? video : video.closest("video");
        if (vid && vid.paused) {
          try {
            vid.play();
          } catch {
          }
        }
        empirePlayerLaunched = true;
        empireBypassed = true;
        return;
      }
      const loader = document.querySelector(".loader.adapt, .loader-player");
      if (loader && window.getComputedStyle(loader).display !== "none") {
        return;
      }
    }
    function cleanEmpireDom() {
      if (!window.__WFB_ENABLED) return;
      document.querySelectorAll("[onclick]").forEach((el) => {
        const onclick = el.getAttribute("onclick") || "";
        if (onclick.includes("window.open") || onclick.includes("open(")) {
          const tag = el.tagName.toLowerCase();
          if (!["button", "a", "input", "select", "label"].includes(tag)) {
            el.removeAttribute("onclick");
            console.log("[StreamBlocker/MAIN] Empire: onclick pi\xE8ge supprim\xE9 sur <" + tag + ">");
          }
        }
      });
      document.querySelectorAll("iframe[src]").forEach((iframe) => {
        const src = iframe.getAttribute("src") || "";
        if (src && isAdUrl(src)) {
          console.log("[StreamBlocker/MAIN] Empire: iframe pub supprim\xE9e \u2192", src);
          iframe.remove();
        }
      });
      document.querySelectorAll("a, div").forEach((el) => {
        if (!el.parentElement) return;
        const href = el.getAttribute("href") || "";
        if (!href || !isAdUrl(href)) return;
        const style = window.getComputedStyle(el);
        if (style.display === "none") return;
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.4 || rect.height > window.innerHeight * 0.4) {
          console.log("[StreamBlocker/MAIN] Empire: overlay pub g\xE9ant supprim\xE9 \u2192", href);
          el.remove();
        }
      });
    }
    document.addEventListener("click", function empireClickGuard(e) {
      if (!window.__WFB_ENABLED) return;
      let el = e.target;
      while (el && el.tagName !== "A") el = el.parentElement;
      if (!el) return;
      const href = el.getAttribute("href") || "";
      const target = el.getAttribute("target") || "";
      if (target === "_blank") {
        try {
          const u = new URL(href, window.location.href);
          if (u.hostname !== location.hostname) {
            e.preventDefault();
            console.log("[StreamBlocker/MAIN] Empire: lien _blank bloqu\xE9 :", href);
            window.dispatchEvent(new CustomEvent("__wfb_popup_blocked__", { detail: { url: href } }));
          }
        } catch {
        }
        return;
      }
      if (href && isAdUrl(href)) {
        e.preventDefault();
        console.log("[StreamBlocker/MAIN] Empire: lien pub bloqu\xE9 :", href);
        window.dispatchEvent(new CustomEvent("__wfb_popup_blocked__", { detail: { url: href } }));
      }
    }, true);
    const empireObserver = new MutationObserver((mutations) => {
      if (!window.__WFB_ENABLED) return;
      cleanEmpireDom();
      for (const m of mutations) {
        if (m.addedNodes.length === 0) continue;
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const cls = (node.className || "").toString();
          if (cls.includes("pinstall") || node.querySelector?.('[class*="pinstall"]')) {
            console.log("[StreamBlocker/MAIN] Empire: pinstall-card inject\xE9 \u2192 bypass imm\xE9diat");
            pinstallHandled = false;
            setTimeout(() => bypassEmpirePinstallOverlay(), 50);
            setTimeout(() => bypassEmpirePinstallOverlay(), 300);
          }
          if (cls.includes("btn-play") || node.querySelector?.("button.btn-play")) {
            console.log("[StreamBlocker/MAIN] Empire: btn-play inject\xE9 dans le DOM");
            setTimeout(() => tryLaunchEmpirePlayer(), 100);
          }
        }
      }
    });
    empireObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "onclick", "style", "class"]
    });
    const empireHeartbeat = setInterval(() => {
      if (!window.__WFB_ENABLED) {
        clearInterval(empireHeartbeat);
        return;
      }
      window.dispatchEvent(new CustomEvent("__wfb_user_click__"));
    }, 800);
    function startEmpireBypass() {
      cleanEmpireDom();
      bypassEmpirePinstallOverlay();
      const bypassLoop = setInterval(() => {
        if (!window.__WFB_ENABLED) {
          clearInterval(bypassLoop);
          return;
        }
        if (empireBypassed) {
          clearInterval(bypassLoop);
          return;
        }
        autoClickEmpireSteps();
        bypassEmpirePinstallOverlay();
        cleanEmpireDom();
      }, 400);
      _origSetTimeout(() => tryLaunchEmpirePlayer(), 300);
      _origSetTimeout(() => tryLaunchEmpirePlayer(), 800);
      _origSetTimeout(() => tryLaunchEmpirePlayer(), 1500);
      _origSetTimeout(() => tryLaunchEmpirePlayer(), 3e3);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startEmpireBypass);
    } else {
      _origSetTimeout(startEmpireBypass, 100);
    }
    console.log("[StreamBlocker/MAIN] Empire Streaming \u2705 bypass complet activ\xE9 (v2.0)");
  }

  // src/content/main_world/sites/senpai.js
  var senpaiBypassed = false;
  var senpaiFallbackAttempts = 0;
  var senpaiWaitAttempts = 0;
  async function bypassSenpaiStream() {
    if (!window.__WFB_ENABLED) return;
    if (senpaiBypassed) return;
    if (!location.hostname.includes("senpai-stream")) return;
    if (typeof window.Livewire === "undefined") {
      senpaiWaitAttempts++;
      if (senpaiWaitAttempts < 10) return;
    }
    if (typeof window.Livewire !== "undefined") {
      try {
        const watchComponent = window.Livewire.all().find((c) => c.name === "watch-component" || c.id);
        if (watchComponent && typeof watchComponent.incrementSteps === "function") {
          console.log("[StreamBlocker/MAIN] Livewire watch-component trouv\xE9. Injection du bypass...");
          for (let i = 0; i < 5; i++) {
            try {
              await watchComponent.incrementSteps();
            } catch (e) {
            }
            await new Promise((r) => setTimeout(r, 800));
          }
          console.log("[StreamBlocker/MAIN] 5 \xE9tapes valid\xE9es via API ! Lancement de la vid\xE9o...");
          setTimeout(() => {
            const playBtn = document.querySelector('#watch-preloader button[type="submit"]');
            if (playBtn) {
              console.log("[StreamBlocker/MAIN] Clic sur Play dans 1.5s...");
              setTimeout(() => {
                try {
                  nativeClick.call(playBtn);
                } catch (e) {
                  playBtn.click();
                }
              }, 1500);
            }
          }, 500);
          senpaiBypassed = true;
          return;
        }
      } catch (e) {
        console.warn("[StreamBlocker/MAIN] Erreur Livewire API:", e);
      }
    }
    const btnContinuer = Array.from(document.querySelectorAll("button, .btn, [wire\\:click]")).find(
      (b) => ((b.textContent || "").toUpperCase().includes("CONTINUER") || (b.innerText || "").toUpperCase().includes("CONTINUER")) && window.getComputedStyle(b).display !== "none" && !b.disabled && !b.hasAttribute("disabled") && !b.classList.contains("disabled")
    );
    if (btnContinuer) {
      console.log("[StreamBlocker/MAIN] Fallback Senpai : Bouton Continuer trouv\xE9. Auto-clic...");
      const form = btnContinuer.closest("form");
      if (form && !form.dataset.wfbSecured) {
        form.addEventListener("submit", (e) => e.preventDefault(), false);
        form.dataset.wfbSecured = "true";
      }
      try {
        nativeClick.call(btnContinuer);
      } catch (e) {
        btnContinuer.click();
      }
      senpaiFallbackAttempts++;
      if (senpaiFallbackAttempts > 30) {
        console.log("[StreamBlocker/MAIN] Fallback Senpai : Timeout (boucle infinie \xE9vit\xE9e).");
        senpaiBypassed = true;
      }
    } else {
      const playBtn = document.querySelector('#watch-preloader button[type="submit"]');
      if (playBtn && window.getComputedStyle(playBtn).display !== "none" && !playBtn.disabled) {
        console.log("[StreamBlocker/MAIN] Fallback Senpai : Bouton Play cliqu\xE9 !");
        setTimeout(() => {
          try {
            nativeClick.call(playBtn);
          } catch (e) {
            playBtn.click();
          }
        }, 1500);
        senpaiBypassed = true;
      }
    }
  }
  function isSenpaiBypassed() {
    return senpaiBypassed;
  }
  function initSenpai() {
    let attempts = 0;
    const retryInterval = setInterval(() => {
      if (!window.__WFB_ENABLED) {
        clearInterval(retryInterval);
        return;
      }
      bypassSenpaiStream();
      attempts++;
      if (senpaiBypassed || attempts > 50) clearInterval(retryInterval);
    }, 500);
    document.addEventListener("livewire:load", bypassSenpaiStream);
    document.addEventListener("livewire:init", bypassSenpaiStream);
  }

  // src/content/main_world/sites/webflix.js
  var webflixBypassed = false;
  function bypassWebflix() {
    if (!window.__WFB_ENABLED) return;
    if (webflixBypassed) return;
    if (!location.hostname.includes("webflix.lol")) return;
    hideAdOverlays();
    const playIcon = document.querySelector("svg.lucide-play");
    if (playIcon) {
      const playBtn = playIcon.closest("button");
      if (playBtn) {
        playBtn.style.position = "relative";
        playBtn.style.zIndex = "9999999";
        webflixBypassed = true;
      }
    }
  }
  function isWebflixBypassed() {
    return webflixBypassed;
  }

  // src/content/main_world/sites/wavewatch.js
  var wwembedBypassed = false;
  function bypassWWEMBED() {
    if (!window.__WFB_ENABLED) return;
    if (wwembedBypassed) return;
    if (!location.hostname.includes("wavewatch")) return;
    const btn1 = document.querySelector(".bt.bp:not(.hi)");
    if (btn1 && !btn1.classList.contains("hi")) {
      console.log("[StreamBlocker/MAIN] WWEMBED : auto-clic \xC9TAPE 1/2");
      nativeClick.call(btn1);
    }
    setTimeout(() => {
      const btn2Now = document.querySelector(".bt.bp2:not(.hi)");
      if (btn2Now) {
        console.log("[StreamBlocker/MAIN] WWEMBED : auto-clic \xC9TAPE 2/2");
        nativeClick.call(btn2Now);
      }
      setTimeout(() => {
        const modalNow = document.querySelector(".mo.sh");
        if (modalNow) {
          modalNow.classList.remove("sh");
          modalNow.style.display = "none";
          console.log("[StreamBlocker/MAIN] WWEMBED : overlay masqu\xE9");
        }
        wwembedBypassed = true;
      }, 400);
    }, 600);
  }
  function isWavewatchBypassed() {
    return wwembedBypassed;
  }
  function initWavewatch() {
    let attempts = 0;
    const retryInterval = setInterval(() => {
      if (!window.__WFB_ENABLED) {
        clearInterval(retryInterval);
        return;
      }
      bypassWWEMBED();
      attempts++;
      if (wwembedBypassed || attempts > 30) clearInterval(retryInterval);
    }, 300);
  }

  // src/content/main_world/index.js
  (function() {
    "use strict";
    const hostname = location.hostname;
    patchWebSocket();
    const observer = new MutationObserver(() => {
      if (!window.__WFB_ENABLED) return;
      if (hostname.includes("wavewatch")) {
        if (!isWavewatchBypassed()) bypassWWEMBED();
      } else if (hostname.includes("senpai-stream")) {
        if (!isSenpaiBypassed()) bypassSenpaiStream();
      } else if (hostname.includes("webflix.lol")) {
        if (!isWebflixBypassed()) bypassWebflix();
      } else if (!hostname.includes("empire-streaming")) {
        bypassGenericStepOverlay();
        hideAdOverlays();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
    function init() {
      if (!window.__WFB_ENABLED) return;
      if (hostname.includes("wavewatch")) {
        initWavewatch();
      } else if (hostname.includes("senpai-stream")) {
        initSenpai();
      } else if (hostname.includes("empire-streaming")) {
        setupEmpireStreamingAntiPopup();
      } else {
        let attempts = 0;
        const retryInterval = setInterval(() => {
          if (!window.__WFB_ENABLED) {
            clearInterval(retryInterval);
            return;
          }
          bypassGenericStepOverlay();
          hideAdOverlays();
          attempts++;
          if (attempts > 20) clearInterval(retryInterval);
        }, 500);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    if (window.__WFB_ENABLED === false) {
      console.log("[StreamBlocker/MAIN] \u23F8\uFE0F Protection MAIN WORLD charg\xE9e mais D\xC9SACTIV\xC9E sur", hostname);
    } else {
      console.log("[StreamBlocker/MAIN] \u2705 Protection MAIN WORLD active sur", hostname);
    }
  })();
})();
