/**
 * main_world/utils.js — Utilitaires partagés entre tous les modules MAIN WORLD
 *
 * Contient :
 *  - Anti-détection toString() spoofing
 *  - Fonction isWhitelisted() spécifique au MAIN world
 *  - Référence native à HTMLElement.prototype.click
 */
import { WHITELIST_DOMAINS, isAdUrl } from '../../shared/domains.js';

// ══════════════════════════════════════════════════════════════════
// ANTI-DÉTECTION : toString() spoofing
// ══════════════════════════════════════════════════════════════════
const _nativeToString = Function.prototype.toString;
const _nativeFnMap    = new Map();

export function makeNativeLook(fn, nativeFn) {
  _nativeFnMap.set(fn, _nativeToString.call(nativeFn));
  return fn;
}

// Patch Function.prototype.toString IMMÉDIATEMENT
Function.prototype.toString = function () {
  if (_nativeFnMap.has(this)) return _nativeFnMap.get(this);
  return _nativeToString.call(this);
};
_nativeFnMap.set(Function.prototype.toString, _nativeToString.call(_nativeToString));

// ══════════════════════════════════════════════════════════════════
// RÉFÉRENCE NATIVE À HTMLElement.prototype.click
// ══════════════════════════════════════════════════════════════════
export const nativeClick = HTMLElement.prototype.click;

// ══════════════════════════════════════════════════════════════════
// isWhitelisted — logique étendue pour le MAIN world
// ══════════════════════════════════════════════════════════════════
export function isWhitelisted(url) {
  if (!url || typeof url !== 'string') return true;
  if (url.includes('smartlink')) return false; // Bloquer les popups internes de Webflix
  if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('/') || url.startsWith('blob:')) return true;
  try {
    const u = new URL(url, window.location.href);
    if (u.hostname === location.hostname) return true;
    return WHITELIST_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return true; }
}

// Réexporter isAdUrl pour les modules site
export { isAdUrl };
