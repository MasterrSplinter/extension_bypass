/**
 * main_world/sites/webflix.js — Bypass Webflix (Vidzy)
 *
 * Renforcement nettoyage overlays + mise en avant du bouton Play.
 */
import { hideAdOverlays } from '../core.js';

let webflixBypassed = false;

export function bypassWebflix() {
  if (!window.__WFB_ENABLED) return;
  if (webflixBypassed) return;
  if (!location.hostname.includes('webflix.lol')) return;

  hideAdOverlays();

  const playIcon = document.querySelector('svg.lucide-play');
  if (playIcon) {
    const playBtn = playIcon.closest('button');
    if (playBtn) {
      playBtn.style.position = 'relative';
      playBtn.style.zIndex = '9999999';
      webflixBypassed = true;
    }
  }
}

export function isWebflixBypassed() {
  return webflixBypassed;
}
