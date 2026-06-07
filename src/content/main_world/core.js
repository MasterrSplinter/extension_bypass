/**
 * main_world/core.js — Protections génériques (tous les sites)
 *
 * Contient :
 *  - Flags d'activation + synchronisation (nonce, DOM fallback)
 *  - Faux window.open
 *  - Interception HTMLElement.prototype.click
 *  - Masquage overlays pub (CSS/DOM)
 *  - Blocage redirections location.assign/replace
 *  - Signal USER_CLICK vers le Service Worker
 */
import { makeNativeLook, nativeClick, isWhitelisted, isAdUrl } from './utils.js';

// ══════════════════════════════════════════════════════════════════
// FLAGS D'ACTIVATION — sync via CustomEvent + DOM fallback
// ══════════════════════════════════════════════════════════════════
window.__WFB_MAIN_LOADED = true;

if (typeof window.__WFB_ENABLED === 'undefined') {
  const initiallyDisabled = document.documentElement.classList.contains('wfb-disabled');
  window.__WFB_ENABLED = !initiallyDisabled;
}

// ── Nonce de sécurité ────────────────────────────────────────────
let _wfbNonce = null;

window.addEventListener('__wfb_init__', (e) => {
  if (e.detail && e.detail.nonce && !_wfbNonce) {
    _wfbNonce = e.detail.nonce;
    console.log('[StreamBlocker/MAIN] Nonce reçu ✅');
  }
});

window.addEventListener('__wfb_set_enabled__', (e) => {
  if (!e.detail || typeof e.detail !== 'object') return;

  if (_wfbNonce) {
    if (e.detail.nonce !== _wfbNonce) {
      console.warn('[StreamBlocker/MAIN] ⚠️ Event __wfb_set_enabled__ rejeté : nonce invalide');
      return;
    }
  } else {
    console.warn('[StreamBlocker/MAIN] ⚠️ Nonce non initialisé — event accepté (fallback)');
  }

  window.__WFB_ENABLED = e.detail.enabled === true;
  console.log('[StreamBlocker/MAIN] État protection mis à jour :', window.__WFB_ENABLED);
}, { capture: true });

// ── DOM fallback (MutationObserver sur la classe wfb-disabled) ───
const _wfbClassObserver = new MutationObserver(() => {
  const disabled = document.documentElement.classList.contains('wfb-disabled');
  const newState = !disabled;
  if (window.__WFB_ENABLED !== newState) {
    window.__WFB_ENABLED = newState;
    console.log('[StreamBlocker/MAIN] État protection mis à jour (via DOM) :', newState);
  }
});
_wfbClassObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
});

// ══════════════════════════════════════════════════════════════════
// FAUX window.open — bloque les popups publicitaires
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
// INTERCEPTION HTMLElement.prototype.click
// ══════════════════════════════════════════════════════════════════
HTMLElement.prototype.click = makeNativeLook(function click() {
  if (window.__WFB_ENABLED && (this.tagName === 'A' || this.tagName === 'a')) {
    const href   = this.getAttribute('href') || (typeof this.href === 'string' ? this.href : '');
    const target = this.getAttribute('target') || this.target || '';
    if (target === '_blank' && href && !isWhitelisted(href)) {
      console.log('[StreamBlocker/MAIN] .click() sur <a _blank> bloqué :', href);
      return;
    }
  }
  return nativeClick.call(this);
}, nativeClick);

// ══════════════════════════════════════════════════════════════════
// MASQUER LES OVERLAYS PUB PAR CSS/DOM
// ══════════════════════════════════════════════════════════════════
export function hideAdOverlays() {
  if (!window.__WFB_ENABLED) return;
  const elements = document.querySelectorAll('a, div, iframe');
  elements.forEach(el => {
    if (el.tagName === 'A' && el.href && isAdUrl(el.href)) {
      el.remove();
      return;
    }

    const rect = el.getBoundingClientRect();
    const isGiant = rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8;

    if (isGiant) {
      const style = window.getComputedStyle(el);
      const isClickable = (el.tagName === 'A' || style.cursor === 'pointer');
      const isOverlay = (style.position === 'absolute' || style.position === 'fixed' || style.position === 'relative');
      const isTransparent = (style.opacity < 0.1 || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent');
      const isHighZIndex = parseInt(style.zIndex, 10) > 1000;

      if (isClickable || (isOverlay && isTransparent && isHighZIndex)) {
        const elId = (el.id || '').toLowerCase();
        const elClass = (el.className || '').toString().toLowerCase();
        const isPlayButton = elId === 'bigplay' || elClass.includes('big-play') || elId === 'play-btn';

        if (!el.querySelector('video') && !el.classList.contains('jwplayer') && !isPlayButton) {
          console.log('[StreamBlocker/MAIN] Overlay géant/transparent publicitaire supprimé', el);
          el.remove();
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// BLOQUER LES REDIRECTIONS location.assign/replace
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
// BYPASS GÉNÉRIQUE "ÉTAPES PUB"
// ══════════════════════════════════════════════════════════════════
export function bypassGenericStepOverlay() {
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
      try { nativeClick.call(btn); } catch (e) {}
    }
  });
  return found;
}

// ══════════════════════════════════════════════════════════════════
// SIGNAL USER_CLICK → Service Worker
// ══════════════════════════════════════════════════════════════════
document.addEventListener('click', () => {
  try {
    window.dispatchEvent(new CustomEvent('__wfb_user_click__'));
  } catch {}
}, { capture: true, passive: true });
