/**
 * main_world/sites/senpai.js — Bypass Senpai Stream (Livewire)
 *
 * Bypass via API Livewire directe ou fallback auto-clic sur "Continuer".
 */
import { nativeClick } from '../utils.js';

let senpaiBypassed = false;
let senpaiFallbackAttempts = 0;
let senpaiWaitAttempts = 0;

export async function bypassSenpaiStream() {
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
              try { nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
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

    try { nativeClick.call(btnContinuer); } catch (e) { btnContinuer.click(); }
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
        try { nativeClick.call(playBtn); } catch (e) { playBtn.click(); }
      }, 1500); // Attendre un peu avant de cliquer Play pour éviter 405
      senpaiBypassed = true;
    }
  }
}

export function isSenpaiBypassed() {
  return senpaiBypassed;
}

/**
 * Initialise le bypass Senpai avec retry + listeners Livewire
 */
export function initSenpai() {
  let attempts = 0;
  const retryInterval = setInterval(() => {
    if (!window.__WFB_ENABLED) { clearInterval(retryInterval); return; }
    bypassSenpaiStream();
    attempts++;
    if (senpaiBypassed || attempts > 50) clearInterval(retryInterval);
  }, 500);
  document.addEventListener('livewire:load', bypassSenpaiStream);
  document.addEventListener('livewire:init', bypassSenpaiStream);
}
