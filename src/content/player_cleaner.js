/**
 * player_cleaner.js — Script injecté dans les iframes des lecteurs externes
 * (player4k, viperstream, filemoon, etc.)
 * Supprime les overlays publicitaires à l'intérieur du lecteur vidéo
 */

import { AD_DOMAINS_PLAYER, isAdDomain } from '../shared/domains.js';

(function () {
  'use strict';

  // ─── Bloquer window.open dans le lecteur ────────────────────────────────────
  window.open = function () {
    console.log('[StreamBlocker/Player] window.open bloqué');
    return null;
  };

  // ─── Sélecteurs des éléments pub à supprimer dans le lecteur ───────────────
  const PLAYER_AD_SELECTORS = [
    // Overlays génériques du lecteur
    '.jw-overlays [class*="ad"]',
    '.jw-ad-container',
    '.jw-ad-skip-button',
    '#jwplayer_wrapper > div:not(.jw-wrapper)',
    // Plyr
    '.plyr__ads',
    '.plyr__preview-scrubbing[data-ad]',
    // Vidstack
    '[data-media-ad]',
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
    PLAYER_AD_SELECTORS.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          el.remove();
          removed++;
        });
      } catch (e) {}
    });
    if (removed > 0) {
      console.log(`[StreamBlocker/Player] ${removed} élément(s) supprimé(s) dans le lecteur`);
    }
  }

  // ─── Observer les mutations dans le lecteur ─────────────────────────────────
  const observer = new MutationObserver(() => cleanPlayerAds());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ─── Intercepter les redirections ───────────────────────────────────────────


  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && isAdDomain(a.href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[StreamBlocker/Player] Clic pub bloqué :', a.href);
    }
  }, true);

  // ─── Supprimer les scripts pub injectés dynamiquement ──────────────────────
  const _origCreateElement = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = _origCreateElement(tag);
    if (tag.toLowerCase() === 'script') {
      const _origSetAttribute = el.setAttribute.bind(el);
      el.setAttribute = function (name, value) {
        if (name === 'src' && isAdDomain(value)) {
          console.log('[StreamBlocker/Player] Script pub bloqué :', value);
          return;
        }
        return _origSetAttribute(name, value);
      };
    }
    return el;
  };

  // ─── Nettoyage périodique ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanPlayerAds);
  } else {
    cleanPlayerAds();
  }

  setInterval(cleanPlayerAds, 1500);

  console.log('[StreamBlocker/Player] ✅ Nettoyeur de lecteur activé');
})();
