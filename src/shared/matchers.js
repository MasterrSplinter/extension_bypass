/**
 * matchers.js — Prédicats purs de correspondance d'hôtes.
 *
 * Source unique de la logique « ce hostname est-il dans cette liste ? », utilisée
 * par le service worker et le content script (monde ISOLATED). Chargé comme script
 * classique (globales `var`), exactement comme shared/blocklists.js.
 *
 * Ces fonctions sont pures et sans dépendance → couvertes par test/matchers.test.mjs.
 */
'use strict';

// Normalise un hostname : minuscule, sans préfixe « www. ».
var WFB_normalizeHost = function (h) {
  return (h || '').toLowerCase().replace(/^www\./, '');
};

// Vrai si `host` est exactement un domaine de `list` ou un de ses sous-domaines.
var WFB_hostInList = function (host, list) {
  var h = WFB_normalizeHost(host);
  if (!h || !Array.isArray(list)) return false;
  return list.some(function (d) { return h === d || h.endsWith('.' + d); });
};

// Vrai si l'un des motifs (sous-chaînes) apparaît dans le hostname.
var WFB_patternInHost = function (host, patterns) {
  var h = WFB_normalizeHost(host);
  if (!h || !Array.isArray(patterns)) return false;
  return patterns.some(function (p) { return h.includes(p); });
};

// Extrait le hostname d'une URL absolue ou relative ; null si invalide/non pertinent.
var WFB_hostnameFromUrl = function (url, base) {
  if (!url || typeof url !== 'string') return null;
  if (url === 'about:blank' || url.startsWith('chrome')) return null;
  try { return new URL(url, base).hostname; } catch (e) { return null; }
};
