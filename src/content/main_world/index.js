/**
 * main_world/index.js — Point d'entrée MAIN WORLD
 *
 * Ce fichier est le routeur : il charge le core générique,
 * puis active les modules spécifiques au site courant.
 *
 * Architecture :
 *   index.js ─┬─ core.js    (flags, window.open, click, overlays, location)
 *             ├─ utils.js   (makeNativeLook, isWhitelisted, nativeClick)
 *             └─ sites/
 *                ├─ empire.js    (WebSocket, fetch/XHR, timers, pinstall)
 *                ├─ senpai.js    (Livewire bypass)
 *                ├─ webflix.js   (Vidzy bypass)
 *                └─ wavewatch.js (WWEMBED bypass)
 */

// ── Core : protections génériques (actives sur TOUS les sites) ──
import { hideAdOverlays, bypassGenericStepOverlay } from './core.js';

// ── Modules sites ───────────────────────────────────────────────
import { patchWebSocket, setupEmpireStreamingAntiPopup } from './sites/empire.js';
import { bypassSenpaiStream, isSenpaiBypassed, initSenpai } from './sites/senpai.js';
import { bypassWebflix, isWebflixBypassed } from './sites/webflix.js';
import { bypassWWEMBED, isWavewatchBypassed, initWavewatch } from './sites/wavewatch.js';

(function () {
  'use strict';

  const hostname = location.hostname;

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 1 : Patches IMMÉDIATS (avant tout script du site)
  // ══════════════════════════════════════════════════════════════
  // Le WebSocket patch Empire doit s'exécuter AVANT que Socket.io
  // ne capture la référence à window.WebSocket dans une closure.
  patchWebSocket();

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 2 : Observer DOM — réagir aux mutations
  // ══════════════════════════════════════════════════════════════
  const observer = new MutationObserver(() => {
    if (!window.__WFB_ENABLED) return;

    if (hostname.includes('wavewatch')) {
      if (!isWavewatchBypassed()) bypassWWEMBED();
    } else if (hostname.includes('senpai-stream')) {
      if (!isSenpaiBypassed()) bypassSenpaiStream();
    } else if (hostname.includes('webflix.lol')) {
      if (!isWebflixBypassed()) bypassWebflix();
    } else if (!hostname.includes('empire-streaming')) {
      // Empire gère ses propres listeners
      bypassGenericStepOverlay();
      hideAdOverlays();
    }
  });

  observer.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'style']
  });

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 3 : Initialisation site-spécifique
  // ══════════════════════════════════════════════════════════════
  function init() {
    if (!window.__WFB_ENABLED) return;

    if (hostname.includes('wavewatch')) {
      initWavewatch();
    } else if (hostname.includes('senpai-stream')) {
      initSenpai();
    } else if (hostname.includes('empire-streaming')) {
      setupEmpireStreamingAntiPopup();
    } else {
      // Sites génériques : bypass overlay + nettoyage
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

  // ══════════════════════════════════════════════════════════════
  // Log d'état
  // ══════════════════════════════════════════════════════════════
  if (window.__WFB_ENABLED === false) {
    console.log('[StreamBlocker/MAIN] ⏸️ Protection MAIN WORLD chargée mais DÉSACTIVÉE sur', hostname);
  } else {
    console.log('[StreamBlocker/MAIN] ✅ Protection MAIN WORLD active sur', hostname);
  }
})();
