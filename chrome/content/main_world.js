/**
 * main_world.js — Injecté dans le MAIN WORLD (world: "MAIN")
 * v1.6 — Anti-détection Cloudflare + respecte window.__WFB_ENABLED
 *
 * IMPORTANT: Ce script s'exécute dans le MAIN WORLD.
 * Il lit window.__WFB_ENABLED pour savoir si la protection est active.
 * content.js (ISOLATED WORLD) met à jour ce flag depuis chrome.storage.
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  // ANTI-DÉTECTION : toString() spoofing
  // ══════════════════════════════════════════════════════════════════
  const _nativeToString = Function.prototype.toString;
  const _nativeFnMap    = new Map();

  function makeNativeLook(fn, nativeFn) {
    _nativeFnMap.set(fn, _nativeToString.call(nativeFn));
    return fn;
  }

  Function.prototype.toString = function () {
    if (_nativeFnMap.has(this)) return _nativeFnMap.get(this);
    return _nativeToString.call(this);
  };
  _nativeFnMap.set(Function.prototype.toString, _nativeToString.call(_nativeToString));

  // ══════════════════════════════════════════════════════════════════
  // FLAG D'ACTIVATION — positionné par content.js via CustomEvent
  // ══════════════════════════════════════════════════════════════════
  if (typeof window.__WFB_ENABLED === 'undefined') {
    window.__WFB_ENABLED = true;
  }

  window.addEventListener('__wfb_set_enabled__', (e) => {
    window.__WFB_ENABLED = e.detail === true || e.detail === 'true';
    console.log('[StreamBlocker/MAIN] État protection mis à jour :', window.__WFB_ENABLED);
  }, { capture: true });

  // ══════════════════════════════════════════════════════════════════
  // SECTION A : Faux window.open
  // ══════════════════════════════════════════════════════════════════
  const _nativeOpen = window.open;

  const _fakeOpen = makeNativeLook(function open(url, target, features) {
    if (!window.__WFB_ENABLED) {
      return _nativeOpen.call(window, url, target, features);
    }

    console.log('[StreamBlocker/MAIN] window.open intercepté :', url);

    const fakeWin = {
      closed:    false,
      opener:    window,
      name:      target || '',
      location:  { href: url || 'about:blank', assign: () => {}, replace: () => {} },
      document:  {
        write:     () => {},
        writeln:   () => {},
        close:     () => {},
        body:      { innerHTML: '' }
      },
      focus:     () => {},
      blur:      () => {},
      close:     () => { fakeWin.closed = true; },
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout:  (fn, d) => setTimeout(fn, d),
      clearTimeout: (id) => clearTimeout(id)
    };
    setTimeout(() => { fakeWin.closed = true; }, 200);
    return fakeWin;
  }, _nativeOpen);

  window.open = _fakeOpen;

  // ══════════════════════════════════════════════════════════════════
  // SECTION B : Intercepter HTMLElement.prototype.click
  // ══════════════════════════════════════════════════════════════════
  const _nativeClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = makeNativeLook(function click() {
    if (window.__WFB_ENABLED && (this.tagName === 'A' || this.tagName === 'a')) {
      const href   = this.getAttribute('href') || (typeof this.href === 'string' ? this.href : '');
      const target = this.getAttribute('target') || this.target || '';
      if (target === '_blank' && href && !isWhitelisted(href)) {
        console.log('[StreamBlocker/MAIN] .click() sur <a _blank> bloqué :', href);
        return;
      }
    }
    return _nativeClick.call(this);
  }, _nativeClick);

  // NOTE: document.createElement override supprimé (v1.6) — détectable par Cloudflare.

  // ══════════════════════════════════════════════════════════════════
  // SECTION D : Bypass de l'overlay WWEMBED (wavewatch.top)
  // ══════════════════════════════════════════════════════════════════
  let wwembedBypassed = false;

  function bypassWWEMBED() {
    if (!window.__WFB_ENABLED) return;
    if (wwembedBypassed) return;
    if (!location.hostname.includes('wavewatch')) return;

    const btn1 = document.querySelector('.bt.bp:not(.hi)');
    if (btn1 && !btn1.classList.contains('hi')) {
      console.log('[StreamBlocker/MAIN] WWEMBED : auto-clic ÉTAPE 1/2');
      _nativeClick.call(btn1);
    }

    setTimeout(() => {
      const btn2Now = document.querySelector('.bt.bp2:not(.hi)');
      if (btn2Now) {
        console.log('[StreamBlocker/MAIN] WWEMBED : auto-clic ÉTAPE 2/2');
        _nativeClick.call(btn2Now);
      }
      setTimeout(() => {
        const modalNow = document.querySelector('.mo.sh');
        if (modalNow) {
          modalNow.classList.remove('sh');
          modalNow.style.display = 'none';
          console.log('[StreamBlocker/MAIN] WWEMBED : overlay masqué');
        }
        wwembedBypassed = true;
      }, 400);
    }, 600);
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION E : Bypass générique "étapes pub"
  // ══════════════════════════════════════════════════════════════════
  function bypassGenericStepOverlay() {
    if (!window.__WFB_ENABLED) return false;
    const allBtns = document.querySelectorAll('button, .btn, [class*="btn"], a[class*="btn"]');
    let found = false;
    allBtns.forEach(btn => {
      const text  = (btn.textContent || btn.innerText || '').trim().toUpperCase();
      const style = window.getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      const isStepBtn = (
        text.includes('ÉTAPE') || text.includes('ETAPE') || text.includes('STEP') ||
        text.includes('UNLOCK') || text.includes('DÉBLOQUER') || text.includes('DEBLOCK') ||
        text.includes('AUTORISER') || text.includes('CONTINUER') || text.includes('ACCÉDER') ||
        (text.includes('PUB') && (text.includes('1') || text.includes('2')))
      );
      if (isStepBtn) {
        console.log('[StreamBlocker/MAIN] Bouton étape détecté :', text);
        found = true;
        try { _nativeClick.call(btn); } catch (e) {}
      }
    });
    return found;
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION E2 : Bypass Senpai Stream (Livewire)
  // ══════════════════════════════════════════════════════════════════
  let senpaiBypassed = false;
  let senpaiFallbackAttempts = 0;
  let senpaiWaitAttempts = 0;

  async function bypassSenpaiStream() {
    if (!window.__WFB_ENABLED) return;
    if (senpaiBypassed) return;
    if (!location.hostname.includes('senpai-stream')) return;

    if (typeof window.Livewire === 'undefined') {
      senpaiWaitAttempts++;
      if (senpaiWaitAttempts < 10) return; // Attendre jusqu'à 5s l'initialisation de Livewire
    }

    // Approche 1: API Livewire directe
    if (typeof window.Livewire !== 'undefined') {
      try {
        const watchComponent = window.Livewire.all().find(c => c.name === 'watch-component' || c.id);
        if (watchComponent && typeof watchComponent.incrementSteps === 'function') {
          console.log('[StreamBlocker/MAIN] Livewire watch-component trouvé. Injection du bypass...');
          for (let i = 0; i < 5; i++) {
            try { await watchComponent.incrementSteps(); } catch(e){}
            await new Promise(r => setTimeout(r, 800)); // Ralentir pour éviter la 405
          }
          console.log('[StreamBlocker/MAIN] 5 étapes validées via API ! Lancement de la vidéo...');
          
          setTimeout(() => {
            const playBtn = document.querySelector('#watch-preloader button[type="submit"]');
            if (playBtn) {
              console.log('[StreamBlocker/MAIN] Clic sur Play dans 1.5s...');
              setTimeout(() => {
                try { _nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
              }, 1500);
            }
          }, 500);

          senpaiBypassed = true;
          return;
        }
      } catch (e) {
        console.warn('[StreamBlocker/MAIN] Erreur Livewire API:', e);
      }
    }

    // Approche 2: Fallback (Simulation de clic physique sécurisé)
    const btnContinuer = Array.from(document.querySelectorAll('button, .btn, [wire\\:click]')).find(b => 
      ((b.textContent || '').toUpperCase().includes('CONTINUER') || 
      (b.innerText || '').toUpperCase().includes('CONTINUER')) &&
      window.getComputedStyle(b).display !== 'none' &&
      !b.disabled && 
      !b.hasAttribute('disabled') &&
      !b.classList.contains('disabled')
    );

    if (btnContinuer) {
      console.log('[StreamBlocker/MAIN] Fallback Senpai : Bouton Continuer trouvé. Auto-clic...');
      
      // Sécurité anti-405: empêcher la soumission native du formulaire
      const form = btnContinuer.closest('form');
      if (form && !form.dataset.wfbSecured) {
        form.addEventListener('submit', (e) => e.preventDefault(), false);
        form.dataset.wfbSecured = 'true';
      }

      try { _nativeClick.call(btnContinuer); } catch (e) { btnContinuer.click(); }
      senpaiFallbackAttempts++;
      
      if (senpaiFallbackAttempts > 30) {
        console.log('[StreamBlocker/MAIN] Fallback Senpai : Timeout (boucle infinie évitée).');
        senpaiBypassed = true;
      }
    } else {
      const playBtn = document.querySelector('#watch-preloader button[type="submit"]');
      if (playBtn && window.getComputedStyle(playBtn).display !== 'none' && !playBtn.disabled) {
        console.log('[StreamBlocker/MAIN] Fallback Senpai : Bouton Play cliqué !');
        setTimeout(() => {
          try { _nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
        }, 1500); // Attendre un peu avant de cliquer Play pour éviter 405
        senpaiBypassed = true;
      } else if (senpaiFallbackAttempts > 0) {
        // Le bouton continuer a disparu et pas de play (Livewire update en cours)
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION E3 : Bypass Webflix (Vidzy)
  // ══════════════════════════════════════════════════════════════════
  let webflixBypassed = false;
  function bypassWebflix() {
    if (!window.__WFB_ENABLED) return;
    if (webflixBypassed) return;
    if (!location.hostname.includes('webflix.lol')) return;

    // Cherche le bouton avec l'icône Play spécifique à Webflix
    const playIcon = document.querySelector('svg.lucide-play');
    if (!playIcon) return;
    
    const playBtn = playIcon.closest('button');
    if (playBtn && !playBtn.dataset.wfClicked) {
      playBtn.dataset.wfClicked = 'true';
      console.log('[StreamBlocker/MAIN] Webflix : Bouton Play détecté ! Lancement du bypass automatique...');
      
      // Clic 1
      try { playBtn.dispatchEvent(new CustomEvent('__wfb_user_click__', { bubbles: true, detail: { isPlayBtn: true } })); _nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
      
      // Clic 2 (après un délai pour laisser le temps à React et à l'intercepteur de popups)
      setTimeout(() => {
        console.log('[StreamBlocker/MAIN] Webflix : Auto-clic 2/2...');
        try { playBtn.dispatchEvent(new CustomEvent('__wfb_user_click__', { bubbles: true, detail: { isPlayBtn: true } })); _nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
        webflixBypassed = true;
      }, 500);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION F : Masquer les overlays pub par CSS/DOM
  // ══════════════════════════════════════════════════════════════════
  function hideAdOverlays() {
    if (!window.__WFB_ENABLED) return;
    const OVERLAY_SELECTORS = [
      '.mo.sh',
      '[class*="unlock"][class*="show"]',
      '[class*="ad-gate"]', '[class*="ad-wall"]',
      '[class*="adgate"]', '[class*="popup-overlay"]',
      '[class*="interstitial"]',
      'div[style*="position: fixed"][style*="z-index: 9"]',
      'div[style*="position:fixed"][style*="z-index:9"]'
    ];
    OVERLAY_SELECTORS.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (el.closest('video') || el.closest('.player-controls') || el.closest('nav')) return;
          const rect = el.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 100) {
            el.style.setProperty('display', 'none', 'important');
            el.classList.remove('sh', 'show', 'active', 'visible');
            console.log('[StreamBlocker/MAIN] Overlay masqué :', sel);
          }
        });
      } catch (e) {}
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION G : Bloquer les redirections location
  // ══════════════════════════════════════════════════════════════════
  try {
    const _origAssign  = window.location.assign.bind(window.location);
    const _origReplace = window.location.replace.bind(window.location);

    window.location.assign = function (url) {
      if (window.__WFB_ENABLED && isAdUrl(url)) {
        console.log('[StreamBlocker/MAIN] location.assign bloqué :', url);
        return;
      }
      return _origAssign(url);
    };

    window.location.replace = function (url) {
      if (window.__WFB_ENABLED && isAdUrl(url)) {
        console.log('[StreamBlocker/MAIN] location.replace bloqué :', url);
        return;
      }
      return _origReplace(url);
    };
  } catch (e) {}

  // ══════════════════════════════════════════════════════════════════
  // SECTION H : Observer les mutations DOM
  // ══════════════════════════════════════════════════════════════════
  const observer = new MutationObserver(() => {
    if (!window.__WFB_ENABLED) return;
    if (!wwembedBypassed && location.hostname.includes('wavewatch')) {
      bypassWWEMBED();
    }
    if (location.hostname.includes('senpai-stream')) {
      if (!senpaiBypassed) bypassSenpaiStream();
    } else if (location.hostname.includes('webflix.lol')) {
      if (!webflixBypassed) bypassWebflix();
    } else {
      bypassGenericStepOverlay();
      hideAdOverlays();
    }
  });

  observer.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'style']
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION I : Initialisation
  // ══════════════════════════════════════════════════════════════════
  function init() {
    if (!window.__WFB_ENABLED) return;
    if (location.hostname.includes('wavewatch')) {
      let attempts = 0;
      const retryInterval = setInterval(() => {
        bypassWWEMBED();
        attempts++;
        if (wwembedBypassed || attempts > 30) clearInterval(retryInterval);
      }, 300);
    } else if (location.hostname.includes('senpai-stream')) {
      let attempts = 0;
      const retryInterval = setInterval(() => {
        if (!window.__WFB_ENABLED) { clearInterval(retryInterval); return; }
        bypassSenpaiStream();
        attempts++;
        if (senpaiBypassed || attempts > 50) clearInterval(retryInterval);
      }, 500);
      document.addEventListener('livewire:load', bypassSenpaiStream);
      document.addEventListener('livewire:init', bypassSenpaiStream);
    } else {
      let attempts = 0;
      const retryInterval = setInterval(() => {
        if (!window.__WFB_ENABLED) { clearInterval(retryInterval); return; }
        bypassGenericStepOverlay();
        hideAdOverlays();
        attempts++;
        if (attempts > 20) clearInterval(retryInterval);
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ══════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════
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
    'galaksion.com', 'kadam.net', 'richpush.co'
  ];

  const WHITELIST = [
    'google.com', 'accounts.google.com', 'facebook.com', 'paypal.com',
    'github.com', 'youtube.com', 'vimeo.com', 'dailymotion.com',
    'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
    'stripe.com', 'apple.com', 'microsoft.com'
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('javascript:') || url.startsWith('#') || url === '') return false;
    try {
      const u = new URL(url, window.location.href);
      return AD_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return false; }
  }

  function isWhitelisted(url) {
    if (!url || typeof url !== 'string') return true;
    if (url.includes('smartlink')) return false; // Bloquer les popups internes de Webflix
    if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('/') || url.startsWith('blob:')) return true;
    try {
      const u = new URL(url, window.location.href);
      if (u.hostname === location.hostname) return true;
      return WHITELIST.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return true; }
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION J : Signal USER_CLICK → Service Worker
  // ══════════════════════════════════════════════════════════════════
  document.addEventListener('click', () => {
    try {
      window.dispatchEvent(new CustomEvent('__wfb_user_click__'));
    } catch {}
  }, { capture: true, passive: true });

  console.log('[StreamBlocker/MAIN] ✅ Protection MAIN WORLD active sur', location.hostname);
})();
