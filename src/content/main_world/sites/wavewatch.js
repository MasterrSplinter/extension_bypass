/**
 * main_world/sites/wavewatch.js — Bypass WWEMBED (wavewatch.top)
 *
 * Auto-clic sur les boutons d'étapes du lecteur WWEMBED
 * et suppression de l'overlay modal.
 */
import { nativeClick } from '../utils.js';

let wwembedBypassed = false;

export function bypassWWEMBED() {
  if (!window.__WFB_ENABLED) return;
  if (wwembedBypassed) return;
  if (!location.hostname.includes('wavewatch')) return;

  const btn1 = document.querySelector('.bt.bp:not(.hi)');
  if (btn1 && !btn1.classList.contains('hi')) {
    console.log('[StreamBlocker/MAIN] WWEMBED : auto-clic ÉTAPE 1/2');
    nativeClick.call(btn1);
  }

  setTimeout(() => {
    const btn2Now = document.querySelector('.bt.bp2:not(.hi)');
    if (btn2Now) {
      console.log('[StreamBlocker/MAIN] WWEMBED : auto-clic ÉTAPE 2/2');
      nativeClick.call(btn2Now);
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

export function isWavewatchBypassed() {
  return wwembedBypassed;
}

/**
 * Initialise le bypass Wavewatch avec retry
 */
export function initWavewatch() {
  let attempts = 0;
  const retryInterval = setInterval(() => {
    if (!window.__WFB_ENABLED) { clearInterval(retryInterval); return; }
    bypassWWEMBED();
    attempts++;
    if (wwembedBypassed || attempts > 30) clearInterval(retryInterval);
  }, 300);
}
