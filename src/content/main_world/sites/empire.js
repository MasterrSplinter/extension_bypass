/**
 * main_world/sites/empire.js — Bypass Empire Streaming (empire-streaming.us)
 *
 * Architecture multi-couches :
 *  1. Interception WebSocket universelle (via defineProperty)
 *  2. Interception réseau (fetch/XHR) — fausse validation pub
 *  3. Accélération timers pub (setInterval/setTimeout)
 *  4. Auto-bypass des étapes pub — click automatique + skip timers
 *  5. Anti-popup — bloque tout window.open vers l'extérieur
 *  6. Nettoyage DOM — supprime overlays et iframes pub
 *  7. Auto-lancement player — lance la vidéo après bypass
 */
import { makeNativeLook, nativeClick, isAdUrl } from '../utils.js';

// ══════════════════════════════════════════════════════════════════
// INTERCEPTION WEBSOCKET UNIVERSELLE
// ══════════════════════════════════════════════════════════════════
//
// PROBLÈME: Socket.io capture window.WebSocket dans une closure.
// SOLUTION: Object.defineProperty(globalThis, 'WebSocket', { get: ... })
//
// Protocole Socket.io EIO=4 :
//   0{...}              = Engine.io OPEN
//   40                  = Socket.io CONNECT namespace /
//   42/ns,[event,data]  = EVENT sur namespace
// ══════════════════════════════════════════════════════════════════

export function patchWebSocket() {
  if (!location.hostname.includes('empire-streaming')) return;

  const _NativeWS = window.WebSocket;
  const _nativeST = window.setTimeout;

  // ── Fake Socket.io WebSocket ──────────────────────────────────────
  function FakeEmpireSocket(url, protocols) {
    const urlStr = typeof url === 'string' ? url : String(url);

    const defProp = (key, val) => Object.defineProperty(this, key, {
      value: val, writable: true, configurable: true, enumerable: true
    });

    defProp('url', urlStr);
    defProp('readyState', 0);
    defProp('bufferedAmount', 0);
    defProp('extensions', '');
    defProp('protocol', '');
    defProp('binaryType', 'blob');
    defProp('onopen', null);
    defProp('onmessage', null);
    defProp('onerror', null);
    defProp('onclose', null);

    this._listeners = {};
    this._namespaces = new Set();

    console.log('[StreamBlocker/MAIN] Empire: WS intercepté (universelle) →', urlStr);

    _nativeST(() => this._startHandshake(), 10);
  }

  FakeEmpireSocket.prototype._startHandshake = function() {
    Object.defineProperty(this, 'readyState', { value: 1, writable: true, configurable: true });
    this._fire('open', new Event('open'));

    const sid = 'bp_' + Math.random().toString(36).slice(2, 14);
    this._recv('0' + JSON.stringify({ sid, upgrades: [], pingInterval: 25000, pingTimeout: 20000 }));

    _nativeST(() => {
      this._recv('40');
      _nativeST(() => {
        const tk = 'bypass_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        this._recv('42' + JSON.stringify(['travelFinish', { status: true, token: tk, ip: '1.2.3.4', valid: true }]));
        console.log('[StreamBlocker/MAIN] Empire: travelFinish / émis ✅ tk=', tk);
      }, 200);
    }, 50);
  };

  FakeEmpireSocket.prototype.send = function(rawData) {
    const data = typeof rawData === 'string' ? rawData : '';
    if (!data) return;
    console.log('[StreamBlocker/MAIN] Empire: client→server:', data.slice(0, 120));

    if (data === '3') return; // Pong

    const nsMatch = data.match(/^40(\/[^,]+),(.*)/);
    if (nsMatch) {
      const ns = nsMatch[1];
      const params = nsMatch[2];
      if (!this._namespaces.has(ns)) {
        this._namespaces.add(ns);
        _nativeST(() => {
          this._recv(`40${ns},{}`);
          console.log('[StreamBlocker/MAIN] Empire: namespace', ns, 'confirmé ✅');
          _nativeST(() => this._fireTravelFinish(ns, params), 150);
        }, 30);
      }
      return;
    }
  };

  FakeEmpireSocket.prototype._fireTravelFinish = function(ns, params) {
    let p = {};
    try { p = JSON.parse(params || '{}'); } catch(e) {}
    const tk = 'bypass_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const ip = p.ip || '1.2.3.4';

    const pkt = `42${ns},` + JSON.stringify(['travelFinish', {
      status: true, token: tk, ip, valid: true, completed: true, steps_remaining: 0
    }]);
    this._recv(pkt);
    console.log('[StreamBlocker/MAIN] Empire: travelFinish', ns, '✅ tk=', tk);

    _nativeST(() => {
      this._recv('42' + JSON.stringify(['travelFinish', { status: true, token: tk, ip, valid: true }]));
    }, 80);
  };

  FakeEmpireSocket.prototype._recv = function(data) {
    const evt = new MessageEvent('message', { data });
    if (typeof this.onmessage === 'function') { try { this.onmessage(evt); } catch(e) {} }
    (this._listeners['message'] || []).forEach(fn => { try { fn(evt); } catch(e) {} });
  };

  FakeEmpireSocket.prototype._fire = function(type, ev) {
    if (typeof this['on' + type] === 'function') { try { this['on' + type](ev); } catch(e) {} }
    (this._listeners[type] || []).forEach(fn => { try { fn(ev); } catch(e) {} });
  };

  FakeEmpireSocket.prototype.close = function() {
    try { this.readyState = 3; } catch(e) {
      Object.defineProperty(this, 'readyState', { value: 3, writable: true, configurable: true });
    }
    this._fire('close', new CloseEvent('close', { wasClean: true, code: 1000 }));
  };

  FakeEmpireSocket.prototype.addEventListener = function(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  };

  FakeEmpireSocket.prototype.removeEventListener = function(type, fn) {
    if (this._listeners[type])
      this._listeners[type] = this._listeners[type].filter(h => h !== fn);
  };

  FakeEmpireSocket.CONNECTING = 0;
  FakeEmpireSocket.OPEN       = 1;
  FakeEmpireSocket.CLOSING    = 2;
  FakeEmpireSocket.CLOSED     = 3;

  // ── Constructeur WebSocket wrapper ─────────────────────────────────
  function WFBWebSocket(url, protocols) {
    const urlStr = typeof url === 'string' ? url : String(url);
    const isEmpire = (
      urlStr.includes('empire-socket') ||
      urlStr.includes('ws-premium') ||
      (urlStr.includes('socket.io') && !urlStr.includes(location.hostname))
    );
    if (isEmpire && window.__WFB_ENABLED !== false) {
      return new FakeEmpireSocket(urlStr, protocols);
    }
    return new _NativeWS(url, protocols);
  }

  WFBWebSocket.prototype  = _NativeWS.prototype;
  WFBWebSocket.CONNECTING = 0;
  WFBWebSocket.OPEN       = 1;
  WFBWebSocket.CLOSING    = 2;
  WFBWebSocket.CLOSED     = 3;

  // ── INTERCEPTION UNIVERSELLE via Object.defineProperty ────────────
  try {
    Object.defineProperty(globalThis, 'WebSocket', {
      get() {
        if (window.__WFB_ENABLED === false) return _NativeWS;
        return WFBWebSocket;
      },
      set(v) {
        console.log('[StreamBlocker/MAIN] Empire: tentative de reset WebSocket ignorée');
      },
      configurable: true
    });
    if (window.__WFB_ENABLED !== false) {
      console.log('[StreamBlocker/MAIN] Empire: WebSocket intercepté via defineProperty ✅');
    }
  } catch(e) {
    window.WebSocket = makeNativeLook(WFBWebSocket, _NativeWS);
    if (window.__WFB_ENABLED !== false) {
      console.log('[StreamBlocker/MAIN] Empire: WebSocket intercepté via assignment (fallback)');
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// BYPASS COMPLET EMPIRE STREAMING
// ══════════════════════════════════════════════════════════════════

// ─── Patterns de détection des APIs pub ────────────────────
const EMPIRE_AD_API_PATTERNS = [
  'empire-socket-streaming', '/certify_token', '/certify_ads',
  '/ad_viewed', '/pub_viewed', '/step_complete',
  '/unlock_player', '/unlock_access', 'ws.empire-socket-streaming',
];

const EMPIRE_STEP_SELECTORS = [
  'button', 'a[href]', '[role="button"]', '[onclick]',
  '[class*="btn"]', '[class*="button"]', '[class*="step"]',
  '[class*="pub"]', '[class*="ad-"]', '[class*="unlock"]',
  '[class*="watch"]', '[id*="step"]', '[id*="btn"]',
  '[data-step]', '[data-ad]', '[data-pub]'
];

const EMPIRE_STEP_KEYWORDS = [
  'étape', 'etape', 'step ', 'pub ', 'publicité', 'publicite',
  'continuer', 'suivant', 'unlock', 'débloquer', 'debloquer',
  'accéder', 'acceder', 'autoriser', 'valider'
];

const EMPIRE_STEP_EXCLUSION_CLASSES = [
  'slick-', 'swiper-', 'carousel-', 'slider-', 'nav-', 'navbar-',
  'pagination', 'breadcrumb', 'menu-', 'header-', 'footer-',
  'search-', 'filter-', 'sort-', 'tab-', 'accordion-'
];

// État du bypass
let empireBypassed = false;
let empireStepsCompleted = 0;
let empireBypassAttempts = 0;
let empirePlayerLaunched = false;
let pinstallHandled = false;

export function setupEmpireStreamingAntiPopup() {
  if (!window.__WFB_ENABLED) return;
  if (!location.hostname.includes('empire-streaming')) return;

  // ── Helpers ──────────────────────────────────────────────────
  function makeFakeAdResponse(url) {
    console.log('[StreamBlocker/MAIN] Empire: API pub interceptée →', url);
    return Promise.resolve(new Response(
      JSON.stringify({
        success: true, certified: true, valid: true,
        status: 'ok', verified: true, completed: true,
        step_done: true, unlocked: true, steps_remaining: 0
      }),
      { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } }
    ));
  }

  function isEmpireAdApiUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return EMPIRE_AD_API_PATTERNS.some(p => url.includes(p));
  }

  // ── Intercept fetch ──────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = makeNativeLook(function fetch(resource, init) {
    if (window.__WFB_ENABLED === false) return _origFetch.apply(this, arguments);

    const url = (typeof resource === 'string') ? resource
              : (resource && resource.url) ? resource.url : '';

    if (isEmpireAdApiUrl(url)) return makeFakeAdResponse(url);

    const isSocketServer = url.includes('empire-socket-streaming') ||
                           (url.includes('socket.io') && !url.includes('empire-streaming.us'));
    if (isSocketServer) {
      console.log('[StreamBlocker/MAIN] Empire: socket-streaming intercepté →', url.slice(0,80));
      return makeFakeAdResponse(url);
    }

    if (init && init.method === 'POST' && url.includes('empire-streaming.us')) {
      const isValidationEndpoint = url.includes('/certify') || url.includes('/validate') ||
        url.includes('/verify') || url.includes('/certify_token') || url.includes('/unlock') ||
        url.includes('/certify_ads') || url.includes('certify_token') ||
        url.includes('/pub_viewed') || url.includes('/ad_viewed') || url.includes('/step_complete');
      if (isValidationEndpoint) {
        console.log('[StreamBlocker/MAIN] Empire: validation endpoint intercepté →', url);
        return makeFakeAdResponse(url);
      }
      console.log('[StreamBlocker/MAIN] Empire: POST API →', url.slice(0,100), '(non intercepté)');
    }

    return _origFetch.apply(this, arguments);
  }, _origFetch);

  // ── Intercept XHR ────────────────────────────────────────────
  const _origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (window.__WFB_ENABLED === false) return _origXHROpen.apply(this, arguments);

    const urlStr = String(url || '');
    if (isEmpireAdApiUrl(urlStr)) {
      this._empireAdApi = true;
      this._empireAdUrl = url;
    }
    const isSocketPolling = urlStr.includes('empire-socket-streaming') ||
                            urlStr.includes('ws-premium') ||
                            urlStr.includes('socket.io?EIO') ||
                            (urlStr.includes('socket.io') && !urlStr.includes('empire-streaming.us'));
    if (isSocketPolling) {
      this._empirePollingBypass = true;
    }
    return _origXHROpen.apply(this, arguments);
  };

  const _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    if (this._empireAdApi) {
      console.log('[StreamBlocker/MAIN] Empire: XHR pub intercepté →', this._empireAdUrl);
      const fakeResp = JSON.stringify({ success: true, certified: true, status: 'ok', steps_remaining: 0 });
      Object.defineProperty(this, 'readyState',   { configurable: true, get: () => 4 });
      Object.defineProperty(this, 'status',       { configurable: true, get: () => 200 });
      Object.defineProperty(this, 'statusText',   { configurable: true, get: () => 'OK' });
      Object.defineProperty(this, 'response',     { configurable: true, get: () => fakeResp });
      Object.defineProperty(this, 'responseText', { configurable: true, get: () => fakeResp });
      setTimeout(() => {
        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
        if (typeof this.onload === 'function') this.onload(new Event('load'));
      }, 30);
      return;
    }
    if (this._empirePollingBypass) {
      const fakeData = '1:0';
      Object.defineProperty(this, 'status',       { configurable: true, get: () => 200 });
      Object.defineProperty(this, 'readyState',   { configurable: true, get: () => 4 });
      Object.defineProperty(this, 'responseText', { configurable: true, get: () => fakeData });
      Object.defineProperty(this, 'response',     { configurable: true, get: () => fakeData });
      setTimeout(() => {
        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
        if (typeof this.onload === 'function') this.onload(new Event('load'));
      }, 20);
      return;
    }
    return _origXHRSend.apply(this, arguments);
  };

  // ── Accélération timers pub ──────────────────────────────────
  const _origSetInterval = window.setInterval;
  const _origSetTimeout  = window.setTimeout;

  window.setInterval = makeNativeLook(function setInterval(fn, delay, ...args) {
    if (window.__WFB_ENABLED && delay >= 500 && delay <= 60000) {
      return _origSetInterval(fn, 50, ...args);
    }
    return _origSetInterval(fn, delay, ...args);
  }, _origSetInterval);

  window.setTimeout = makeNativeLook(function setTimeout(fn, delay, ...args) {
    if (window.__WFB_ENABLED && delay >= 2000 && delay <= 60000) {
      return _origSetTimeout(fn, 100, ...args);
    }
    return _origSetTimeout(fn, delay, ...args);
  }, _origSetTimeout);

  // ── Détection boutons d'étapes ──────────────────────────────
  function isEmpireStepButton(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    const text = (el.textContent || el.innerText || el.value || '').toLowerCase().trim();
    const cls  = (el.className || '').toString().toLowerCase();
    const id   = (el.id || '').toLowerCase();
    const href = (el.getAttribute('href') || '').toLowerCase();

    if (EMPIRE_STEP_EXCLUSION_CLASSES.some(exc => cls.includes(exc))) return false;
    if (text === 'accueil' || text === 'home' || text === 'retour' || text === 'back') return false;
    if (href.startsWith('/') && !href.includes('ad') && !href.includes('pub')) return false;
    if (cls.includes('slick-') || el.getAttribute('aria-label') === 'Next slide') return false;
    if (cls.includes('btn-play') || cls.includes('btn-search') || cls.includes('btn-close')) return false;
    if (text.length > 100) return false;
    if (text === '' && !el.hasAttribute('data-step') && !el.hasAttribute('data-ad')) return false;

    const hasStepKeyword = EMPIRE_STEP_KEYWORDS.some(k => text.includes(k));
    const hasStepClass   = cls.includes('step') || cls.includes('pub') || cls.includes('ad-btn') || cls.includes('unlock');
    const hasStepId      = id.includes('step') || id.includes('pub') || id.includes('ad-') || id.includes('unlock');
    const hasStepData    = el.hasAttribute('data-step') || el.hasAttribute('data-ad') || el.hasAttribute('data-pub');
    const hasStepPattern = /(?:étape|step|pub)\s*\d+/i.test(text);

    return hasStepKeyword || hasStepClass || hasStepId || hasStepData || hasStepPattern;
  }

  // ── Suppression countdowns visuels ──────────────────────────
  function removeEmpireCountdowns() {
    const countdownPatterns = /\d+\s*(?:s|sec|second|seconde)/i;
    document.querySelectorAll('[class*="count"], [class*="timer"], [class*="second"], [id*="count"], [id*="timer"]').forEach(el => {
      if (countdownPatterns.test(el.textContent || '')) {
        el.textContent = '0';
      }
    });
  }

  // ── Auto-click étapes ───────────────────────────────────────
  function autoClickEmpireSteps() {
    if (!window.__WFB_ENABLED || empireBypassed) return;

    empireBypassAttempts++;
    if (empireBypassAttempts > 60) {
      console.log('[StreamBlocker/MAIN] Empire: timeout bypass (60 tentatives)');
      empireBypassed = true;
      return;
    }

    removeEmpireCountdowns();

    const allElements = document.querySelectorAll(EMPIRE_STEP_SELECTORS.join(', '));
    let foundStep = false;

    for (const el of allElements) {
      if (!isEmpireStepButton(el)) continue;

      const text = (el.textContent || el.innerText || '').trim().slice(0, 60);
      console.log('[StreamBlocker/MAIN] Empire: bouton étape trouvé →', text, el);

      try {
        nativeClick.call(el);
        foundStep = true;
        empireStepsCompleted++;
        console.log('[StreamBlocker/MAIN] Empire: étape', empireStepsCompleted, 'cliquée automatiquement');
        window.dispatchEvent(new CustomEvent('__wfb_user_click__'));
        break;
      } catch(err) {
        console.warn('[StreamBlocker/MAIN] Empire: erreur click étape:', err);
      }
    }

    if (!foundStep && empireStepsCompleted > 0) tryLaunchEmpirePlayer();
    if (!foundStep) bypassEmpirePinstallOverlay();
  }

  // ── Bypass overlay pinstall ─────────────────────────────────
  function bypassEmpirePinstallOverlay() {
    if (!window.__WFB_ENABLED) return;

    const pinstallBtns = document.querySelectorAll('button.pinstall-card, [class*="pinstall"]');
    if (pinstallBtns.length > 0 && !pinstallHandled) {
      const regarderBtn = pinstallBtns[1] || pinstallBtns[0];
      const styleR = window.getComputedStyle(regarderBtn);
      if (styleR.display !== 'none' && styleR.visibility !== 'hidden') {
        console.log('[StreamBlocker/MAIN] Empire: pinstall-card → clic "Regarder"');
        pinstallHandled = true;
        try { nativeClick.call(regarderBtn); } catch(e) { regarderBtn.click(); }
        return;
      }
    }

    const allBtns = document.querySelectorAll('button, a.btn, a[class*="btn"]');
    for (const btn of allBtns) {
      const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      if (txt.includes('installer') || txt.includes('install')) {
        const container = btn.closest('[class*="card"], [class*="modal"], [class*="pinstall"], [class*="overlay"]') || btn.parentElement;
        if (!container) continue;

        let regarderBtn = null;
        for (const wb of container.querySelectorAll('button, a')) {
          const wt = (wb.innerText || '').trim().toLowerCase();
          if (wt.includes('regarder') || wt.includes('continuer') || wt.includes('voir') || wt.includes('video')) {
            regarderBtn = wb;
            break;
          }
        }

        if (regarderBtn && !pinstallHandled) {
          console.log('[StreamBlocker/MAIN] Empire: PWA-install overlay → clic "Regarder":', regarderBtn.innerText?.trim());
          pinstallHandled = true;
          try { nativeClick.call(regarderBtn); } catch(e) { regarderBtn.click(); }
        } else if (!pinstallHandled) {
          console.log('[StreamBlocker/MAIN] Empire: PWA-install overlay → suppression forcée');
          pinstallHandled = true;
          const outerContainer = container.parentElement || container;
          try { outerContainer.remove(); } catch(e) { outerContainer.style.display = 'none'; }
          _origSetTimeout(() => { pinstallHandled = false; tryLaunchEmpirePlayer(); }, 500);
        }
        return;
      }
    }

    if (!pinstallHandled) {
      const allLinks = document.querySelectorAll('a[href*="empire-streaming"]');
      for (const link of allLinks) {
        const card = link.closest('[class*="card"], div[style*="background"]') || link.parentElement?.parentElement;
        if (card && card !== document.body) {
          const cardTxt = card.innerText || '';
          if (cardTxt.includes('Installer') || cardTxt.includes('install')) {
            console.log('[StreamBlocker/MAIN] Empire: card empire-streaming → suppression');
            pinstallHandled = true;
            try { card.remove(); } catch(e) { card.style.display = 'none'; }
            _origSetTimeout(() => { pinstallHandled = false; tryLaunchEmpirePlayer(); }, 500);
            return;
          }
        }
      }
    }
  }

  // ── Lancement player vidéo ──────────────────────────────────
  function tryLaunchEmpirePlayer() {
    if (empirePlayerLaunched) return;

    const btnPlay = document.querySelector('button.btn-play');
    if (btnPlay) {
      const s = window.getComputedStyle(btnPlay);
      if (s.display !== 'none' && s.visibility !== 'hidden') {
        console.log('[StreamBlocker/MAIN] Empire: btn-play trouvé → clic');
        try {
          nativeClick.call(btnPlay);
          empirePlayerLaunched = true;
          empireBypassed = true;
          console.log('[StreamBlocker/MAIN] Empire: player lancé via btn-play ✅');
        } catch(e) {}
        return;
      }
    }

    bypassEmpirePinstallOverlay();

    const iframe = document.querySelector(
      'iframe[src*="player"], iframe[src*="embed"], iframe[src*="stream"], iframe[src*="watch"]'
    );
    if (iframe && iframe.src && !isAdUrl(iframe.src)) {
      console.log('[StreamBlocker/MAIN] Empire: iframe player trouvée →', iframe.src);
      empirePlayerLaunched = true;
      empireBypassed = true;
      return;
    }

    const video = document.querySelector('video[src], video source[src]');
    if (video) {
      const vid = video.tagName === 'VIDEO' ? video : video.closest('video');
      if (vid && vid.paused) { try { vid.play(); } catch {} }
      empirePlayerLaunched = true;
      empireBypassed = true;
      return;
    }

    const loader = document.querySelector('.loader.adapt, .loader-player');
    if (loader && window.getComputedStyle(loader).display !== 'none') {
      return; // Player en cours de chargement
    }
  }

  // ── Nettoyage DOM ───────────────────────────────────────────
  function cleanEmpireDom() {
    if (!window.__WFB_ENABLED) return;

    document.querySelectorAll('[onclick]').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      if (onclick.includes('window.open') || onclick.includes('open(')) {
        const tag = el.tagName.toLowerCase();
        if (!['button', 'a', 'input', 'select', 'label'].includes(tag)) {
          el.removeAttribute('onclick');
          console.log('[StreamBlocker/MAIN] Empire: onclick piège supprimé sur <' + tag + '>');
        }
      }
    });

    document.querySelectorAll('iframe[src]').forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      if (src && isAdUrl(src)) {
        console.log('[StreamBlocker/MAIN] Empire: iframe pub supprimée →', src);
        iframe.remove();
      }
    });

    document.querySelectorAll('a, div').forEach(el => {
      if (!el.parentElement) return;
      const href = (el.getAttribute('href') || '');
      if (!href || !isAdUrl(href)) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return;
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.4 || rect.height > window.innerHeight * 0.4) {
        console.log('[StreamBlocker/MAIN] Empire: overlay pub géant supprimé →', href);
        el.remove();
      }
    });
  }

  // ── Anti-popup click guard ──────────────────────────────────
  document.addEventListener('click', function empireClickGuard(e) {
    if (!window.__WFB_ENABLED) return;

    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;

    const href   = el.getAttribute('href') || '';
    const target = el.getAttribute('target') || '';

    if (target === '_blank') {
      try {
        const u = new URL(href, window.location.href);
        if (u.hostname !== location.hostname) {
          e.preventDefault();
          console.log('[StreamBlocker/MAIN] Empire: lien _blank bloqué :', href);
          window.dispatchEvent(new CustomEvent('__wfb_popup_blocked__', { detail: { url: href } }));
        }
      } catch {}
      return;
    }

    if (href && isAdUrl(href)) {
      e.preventDefault();
      console.log('[StreamBlocker/MAIN] Empire: lien pub bloqué :', href);
      window.dispatchEvent(new CustomEvent('__wfb_popup_blocked__', { detail: { url: href } }));
    }
  }, true);

  // ── Observer DOM ────────────────────────────────────────────
  const empireObserver = new MutationObserver((mutations) => {
    if (!window.__WFB_ENABLED) return;
    cleanEmpireDom();

    for (const m of mutations) {
      if (m.addedNodes.length === 0) continue;
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;

        const cls = (node.className || '').toString();
        if (cls.includes('pinstall') || node.querySelector?.('[class*="pinstall"]')) {
          console.log('[StreamBlocker/MAIN] Empire: pinstall-card injecté → bypass immédiat');
          pinstallHandled = false;
          setTimeout(() => bypassEmpirePinstallOverlay(), 50);
          setTimeout(() => bypassEmpirePinstallOverlay(), 300);
        }

        if (cls.includes('btn-play') || node.querySelector?.('button.btn-play')) {
          console.log('[StreamBlocker/MAIN] Empire: btn-play injecté dans le DOM');
          setTimeout(() => tryLaunchEmpirePlayer(), 100);
        }
      }
    }
  });

  empireObserver.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['src', 'href', 'onclick', 'style', 'class']
  });

  // ── Heartbeat SW ────────────────────────────────────────────
  const empireHeartbeat = setInterval(() => {
    if (!window.__WFB_ENABLED) { clearInterval(empireHeartbeat); return; }
    window.dispatchEvent(new CustomEvent('__wfb_user_click__'));
  }, 800);

  // ── Boucle principale ───────────────────────────────────────
  function startEmpireBypass() {
    cleanEmpireDom();
    bypassEmpirePinstallOverlay();

    const bypassLoop = setInterval(() => {
      if (!window.__WFB_ENABLED) { clearInterval(bypassLoop); return; }
      if (empireBypassed) { clearInterval(bypassLoop); return; }
      autoClickEmpireSteps();
      bypassEmpirePinstallOverlay();
      cleanEmpireDom();
    }, 400);

    _origSetTimeout(() => tryLaunchEmpirePlayer(), 300);
    _origSetTimeout(() => tryLaunchEmpirePlayer(), 800);
    _origSetTimeout(() => tryLaunchEmpirePlayer(), 1500);
    _origSetTimeout(() => tryLaunchEmpirePlayer(), 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEmpireBypass);
  } else {
    _origSetTimeout(startEmpireBypass, 100);
  }

  console.log('[StreamBlocker/MAIN] Empire Streaming ✅ bypass complet activé (v2.0)');
}
