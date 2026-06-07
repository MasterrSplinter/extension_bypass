/**
 * content.js — Script injecté (ISOLATED WORLD) sur les sites de streaming
 * v1.6 — Refactorisé : listeners fusionnés, dead code nettoyé, bug opérateur corrigé
 *
 * RÔLE PRINCIPAL :
 *  1. Lire l'état `enabled` depuis chrome.storage
 *  2. Dispatcher __wfb_set_enabled__ pour que main_world.js respecte le toggle
 *  3. Écouter storage.onChanged pour les mises à jour en temps réel
 *  4. Nettoyer les éléments DOM publicitaires (overlays, liens)
 *  5. Relayer USER_CLICK du MAIN world vers le Service Worker
 */

import { AD_DOMAINS, WHITELIST_DOMAINS, isAdUrl, isWhitelisted } from '../shared/domains.js';

(function () {
  'use strict';

  // ─── Flag de debug — contrôlé depuis les options (chrome.storage.sync.debug_mode) ──
  let _debugMode = false;
  function log(...args) { if (_debugMode) console.log(...args); }
  chrome.storage.sync.get(['debug_mode']).then(data => { _debugMode = data.debug_mode === true; }).catch(() => {});

  // ─── Nonce de sécurité — généré une seule fois par chargement de page ─────────
  // Ce nonce est transmis à main_world.js via __wfb_init__.
  // Toutes les mises à jour ultérieures doivent inclure ce nonce pour être validées.
  // Cela empêche un script malveillant de la page de désactiver la protection (correctif H3).
  const WFB_NONCE = crypto.randomUUID();

  // Injection dynamique de main_world.js pour la compatibilité mobile (Kiwi, Orion)
  // Si le script est déjà chargé via le manifest (world: "MAIN"), on évite la double injection
  function injectMainWorldScript() {
    // Vérifier si main_world.js est déjà actif (injecté via le manifest MV3 world:MAIN)
    if (window.__WFB_MAIN_LOADED) {
      log('[StreamBlocker] main_world.js déjà chargé via manifest — skip injection dynamique');
      // Envoyer quand même le nonce pour activer la protection
      window.dispatchEvent(new CustomEvent('__wfb_init__', { detail: { nonce: WFB_NONCE } }));
      return;
    }
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/main_world.js');
      script.onload = () => {
        script.remove();
        // Transmettre le nonce au MAIN world juste après l'injection du script
        // (le script écoute __wfb_init__ avec { once: true })
        window.dispatchEvent(new CustomEvent('__wfb_init__', { detail: { nonce: WFB_NONCE } }));
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      log('[StreamBlocker] Erreur injection main_world:', e);
    }
  }

  injectMainWorldScript();

  // ══════════════════════════════════════════════════════════════════
  // #0 — ÉTAT DE PROTECTION (SOURCE DE VÉRITÉ)
  // ══════════════════════════════════════════════════════════════════

  let protectionEnabled = true; // Défaut: actif

  // Charger l'état depuis le storage et l'envoyer au MAIN world
  // [S12] On lit depuis sync en priorité (préférences syncées entre appareils)
  function loadAndSyncEnabledState() {
    // Essayer sync d'abord, fallback sur local
    const doLoad = (data) => {
      protectionEnabled = data.enabled !== false;
      // syncEnabledToMainWorld met à jour AUSSI la classe CSS
      syncEnabledToMainWorld(protectionEnabled);

      if (protectionEnabled) {
        removeAdElements();
        removeAntiAdblockStyles();
        removeAntiAdblockMessages();
      }

      console.log(`[StreamBlocker] Protection ${protectionEnabled ? '✅ activée' : '⏸️ désactivée'} sur ${location.hostname}`);
    };

    if (chrome.storage.sync) {
      chrome.storage.sync.get(['enabled'], (syncData) => {
        if (chrome.runtime.lastError || syncData.enabled === undefined) {
          chrome.storage.local.get(['enabled'], doLoad);
        } else {
          doLoad(syncData);
        }
      });
    } else {
      chrome.storage.local.get(['enabled'], doLoad);
    }
  }

  // Envoyer l'état au MAIN world via DEUX canaux :
  //  1) Classe CSS sur <html> — PRIMAIRE, toujours fiable (MutationObserver dans main_world.js)
  //  2) CustomEvent — SECONDAIRE, peut ne pas traverser la frontière ISOLATED → MAIN
  function syncEnabledToMainWorld(enabled) {
    // Canal primaire : classe CSS (traverse toujours la frontière car c'est du DOM)
    updateCssToggle(enabled);
    // Canal secondaire : CustomEvent (au cas où main_world.js l'écoute)
    try {
      window.dispatchEvent(new CustomEvent('__wfb_set_enabled__', { detail: { enabled, nonce: WFB_NONCE } }));
    } catch {}
  }

  // Activer/désactiver les règles CSS de content.css via la classe .wfb-disabled sur <html>
  // IMPORTANT: cette classe est aussi observée par main_world.js comme signal de toggle
  function updateCssToggle(enabled) {
    if (enabled) {
      document.documentElement.classList.remove('wfb-disabled');
    } else {
      document.documentElement.classList.add('wfb-disabled');
    }
  }

  // Écouter les changements de storage en temps réel (toggle dans le popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    // [S12] Réagir aux changements sync ET local
    if (area !== 'sync' && area !== 'local') return;
    if (changes.enabled !== undefined) {
      const newEnabled = changes.enabled.newValue !== false;
      if (newEnabled !== protectionEnabled) {
        protectionEnabled = newEnabled;
        // IMPORTANT: syncEnabledToMainWorld met à jour AUSSI la classe CSS
        syncEnabledToMainWorld(protectionEnabled);
        console.log(`[StreamBlocker] Protection mise à jour: ${protectionEnabled ? '✅ ON' : '⏸️ OFF'}`);
        if (protectionEnabled) {
          observer.observe(document.documentElement, observerConfig);
        } else {
          observer.disconnect();
        }
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // #1 — BLOQUER LES CLICS PUB (listener unique fusionné, capture phase)
  // ══════════════════════════════════════════════════════════════════
  document.addEventListener('click', (e) => {
    if (!protectionEnabled) return;

    const target = e.target.closest('a[href]');
    if (!target) return;

    const href   = target.getAttribute('href') || '';
    const tgt    = target.getAttribute('target') || '';

    // Senpai Stream : laisser passer les interactions Livewire
    const isSenpai = location.hostname.includes('senpai-stream');
    const isLivewire = isSenpai && target.closest('[wire\\:click]');

    // Bloquer les clics programmatiques (non-trusted) vers des liens
    if (!e.isTrusted) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[StreamBlocker] Clic programmatique bloqué vers :', href);
      return;
    }

    // Bloquer les liens vers des domaines pub connus
    if (isAdUrl(href)) {
      if (isLivewire) {
        // Senpai : neutraliser le lien mais laisser Livewire s'exécuter
        e.preventDefault();
        target.removeAttribute('target');
        console.log('[StreamBlocker] Senpai Stream: Clic pub neutralisé mais autorisé pour Livewire');
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[StreamBlocker] Clic pub bloqué vers :', href);
      return;
    }

    // Bloquer les liens _blank vers des domaines non-whitelistés
    if (tgt === '_blank' && href && !href.startsWith('#') && !href.startsWith('javascript')) {
      if (isLivewire) {
        // Senpai : neutraliser target _blank mais laisser le lien fonctionner
        e.preventDefault();
        target.removeAttribute('target');
        console.log('[StreamBlocker] Senpai Stream: Lien _blank neutralisé (autorisé pour Livewire)');
        return;
      }

      try {
        const u = new URL(href, window.location.href);
        if (!isWhitelisted(u.hostname)) {
          e.preventDefault();
          // Empire Streaming : NE PAS appeler stopImmediatePropagation()
          // Le handler React du bouton doit continuer à s'exécuter pour incrémenter le compteur.
          if (!location.hostname.includes('empire-streaming')) {
            e.stopImmediatePropagation();
          }
          console.log('[StreamBlocker] Lien _blank bloqué :', href);
          return;
        }
      } catch {}
    }

    // Bloquer les overlays géants (liens transparents couvrant toute la page)
    try {
      const rect = target.getBoundingClientRect();
      const isHuge = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
      if (isHuge) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.remove();
        console.log('[StreamBlocker] Overlay géant bloqué et supprimé vers :', href);
        return;
      }

      // Bloquer les liens externes depuis les iframes
      if (window !== window.top && tgt === '_blank') {
        const linkHost = new URL(href, window.location.href).hostname;
        if (linkHost !== location.hostname) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.log('[StreamBlocker] Clic externe depuis iframe bloqué vers :', href);
          return;
        }
      }
    } catch {}
  }, true);

  // Bloquer les clics molette (bouton du milieu) vers des pubs
  document.addEventListener('mousedown', (e) => {
    if (!protectionEnabled) return;
    if (e.button !== 1) return;

    const target = e.target.closest('a[href]');
    if (!target) return;

    // Senpai : laisser passer les interactions Livewire
    if (location.hostname.includes('senpai-stream') && e.target.closest('[wire\\:click]')) return;

    if (isAdUrl(target.href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // ══════════════════════════════════════════════════════════════════
  // #2 — NETTOYAGE DOM (overlays, scripts pub, éléments ad)
  // ══════════════════════════════════════════════════════════════════
  const AD_SELECTORS = [
    'div[class*="popup"]',
    'div[class*="modal"]:not([class*="player"])',
    'div[class*="overlay"]:not([class*="video"])',
    'div[id*="popup"]', 'div[id*="overlay"]',
    'div[id*="ad-"]', 'div[id*="-ad"]',
    'div[class*="advert"]', 'div[class*="sponsor"]',
    'iframe[src*="popads"]', 'iframe[src*="popcash"]',
    'iframe[src*="exoclick"]', 'iframe[src*="adsterra"]',
    'iframe[src*="propellerads"]', 'iframe[src*="juicyads"]',
    'iframe[src*="tsyndicate"]', 'iframe[src*="pupupul"]',
    'iframe[src*="clkme"]', 'iframe[src*="adspyglass"]',
    'iframe[src*="moonads"]', 'iframe[src*="clickaine"]',
    'script[src*="popads"]', 'script[src*="popcash"]',
    'script[src*="exoclick"]', 'script[src*="tsyndicate"]',
    'script[src*="pupupul"]', 'script[src*="moonads"]',
    'ins.adsbygoogle', '[id^="google_ads"]',
    '[data-ad-client]', '[data-ad-slot]',
    '.mgid-widget', '.taboola-widget',
    '[id*="taboola"]', '[class*="taboola"]',
    '[id*="outbrain"]', '[class*="outbrain"]'
  ];

  function removeAdElements() {
      if (!protectionEnabled) return;
      // Ne pas exécuter la suppression générique d'éléments dans les lecteurs vidéo
      // car cela risque de supprimer des contrôles légitimes (ex: .loading-overlay)
      if (location.pathname.includes('player') || location.hostname.includes('player') || location.hostname.includes('fastflux') || location.hostname.includes('embed')) return;
      // Empire Streaming : nettoyage générique désactivé — géré par main_world.js (anti-popup)
      if (location.hostname.includes('empire-streaming')) return;
    let removed = 0;
    AD_SELECTORS.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (el.closest('#player-container') || el.closest('.video-player') || el.closest('video')) return;
          el.remove();
          removed++;
        });
      } catch (e) {}
    });
    if (removed > 0) {
      console.log(`[StreamBlocker] ${removed} élément(s) publicitaire(s) supprimé(s)`);
    }
  }

  function removeAntiAdblockStyles() {
    if (!protectionEnabled) return;
    // Empire Streaming : ne pas supprimer les styles — certains sont nécessaires au lecteur
    if (location.hostname.includes('empire-streaming')) return;
    document.querySelectorAll('style').forEach(style => {
      if (style.textContent.includes('adblock') || style.textContent.includes('adblocker')) {
        style.remove();
        console.log('[StreamBlocker] Style anti-adblock supprimé');
      }
    });
  }

  function removeAntiAdblockMessages() {
    if (!protectionEnabled) return;
    // Empire Streaming : ne pas supprimer les messages génériques — risque de casser l'UI
    if (location.hostname.includes('empire-streaming')) return;
    const keywords = ['adblock', 'adblocker', 'désactiver votre bloqueur', 'disable your ad', 'whitelist'];
    document.querySelectorAll('div, section, aside, p').forEach(el => {
      const text = el.textContent.toLowerCase();
      if (keywords.some(k => text.includes(k)) && el.children.length < 5) {
        el.remove();
        console.log('[StreamBlocker] Message anti-adblock supprimé');
      }
    });
  }

  function cleanSenpaiStreamScams() {
    if (!protectionEnabled) return;
    if (!location.hostname.includes('senpai-stream')) return;

    // Supprimer les liens Telegram et VIP
    document.querySelectorAll('a[href*="t.me"], a[href*="telegram.me"], a[href*="vip"], a[href*="premium"], a[href*="abonnement"]').forEach(el => {
      el.remove();
      console.log('[StreamBlocker] Lien Telegram/VIP supprimé');
    });

    // Supprimer la bannière image (qui contient le texte cuit dans les pixels)
    document.querySelectorAll('img[src*="abonnements.png"], img[src*="banners/abonnement"]').forEach(el => {
      const link = el.closest('a');
      if (link) {
        link.remove();
        console.log('[StreamBlocker] Bannière image (lien) supprimée');
      } else {
        el.remove();
        console.log('[StreamBlocker] Bannière image supprimée');
      }
    });

    // Supprimer la bannière d'abonnement (détection agressive sans espaces)
    document.querySelectorAll('div, a, section, p, span').forEach(el => {
      if (el.children.length > 15) return; // Sécurité pour ne pas supprimer la page entière
      const text = (el.innerText || el.textContent || '').toLowerCase().replace(/\s+/g, '');
      if (text.includes('abonnementdisponible') || text.includes('cryptomonnaies') || text.includes("t'abonner")) {
        el.remove();
        console.log('[StreamBlocker] Bannière abonnement supprimée (détection texte agressive)');
      }
    });
  }

  // Empire Streaming : nettoyage DOM ciblé
  // Supprime les scripts pub et iframes pub sans toucher à l'interface du site
  function cleanEmpireStreamingSafe() {
    if (!protectionEnabled) return;
    if (!location.hostname.includes('empire-streaming')) return;

    // Supprimer les scripts pub injectés dynamiquement
    document.querySelectorAll('script[src]').forEach(el => {
      const src = el.getAttribute('src') || '';
      if (!src) return;
      if (isAdUrl(src)) {
        el.remove();
        log('[StreamBlocker] Empire Streaming : script pub supprimé', src);
      }
    });

    // Supprimer les iframes pub (sauf celles du lecteur vidéo)
    document.querySelectorAll('iframe[src]').forEach(el => {
      const src = el.getAttribute('src') || '';
      if (!src) return;
      // Garder les iframes des lecteurs vidéo légitimes
      if (src.includes('player') || src.includes('embed') || src.includes('stream') || src.includes('watch')) return;
      if (isAdUrl(src)) {
        el.remove();
        log('[StreamBlocker] Empire Streaming : iframe pub supprimée', src);
      }
    });

    // Supprimer les scripts pub inline qui créent des popups ou redirections
    // BUG FIX: parenthèses ajoutées pour corriger la précédence des opérateurs
    document.querySelectorAll('script:not([src])').forEach(el => {
      const content = el.textContent || '';
      const isAdScript = (
        content.includes('popads') || content.includes('popcash') ||
        content.includes('exoclick') ||
        (content.includes('window.open') && content.includes('random'))
      );
      if (isAdScript) {
        el.remove();
        log('[StreamBlocker] Empire Streaming : script pub inline supprimé');
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // #3 — OBSERVER DOM (nettoyage dynamique)
  // ══════════════════════════════════════════════════════════════════
  const observerConfig = { childList: true, subtree: true };

  const observer = new MutationObserver((mutations) => {
    if (!protectionEnabled) return;
    let shouldClean = false;
    for (const mut of mutations) {
      if (mut.addedNodes.length > 0) { shouldClean = true; break; }
    }
    if (shouldClean) {
      removeAdElements();
      cleanSenpaiStreamScams();
      cleanEmpireStreamingSafe();
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // #4 — RELAIS USER_CLICK → Service Worker
  // ══════════════════════════════════════════════════════════════════
  window.addEventListener('__wfb_user_click__', (e) => {
    try {
      // Si le clic concerne le bouton Play de Webflix
      if (location.hostname.includes('webflix.lol') && e.detail && e.detail.isPlayBtn) {
          console.log('[StreamBlocker] Webflix : Clic manuel sur Play loggé');
      }
      chrome.runtime.sendMessage({ type: 'USER_CLICK' });
    } catch {}
  }, { capture: true, passive: true });



  // ══════════════════════════════════════════════════════════════════
  // DÉMARRAGE
  // ══════════════════════════════════════════════════════════════════

  // 1. Envoyer le nonce au MAIN world — PLUSIEURS FOIS pour garantir la réception
  //    (race condition possible entre manifest injection et content.js)
  const sendNonce = () => {
    window.dispatchEvent(new CustomEvent('__wfb_init__', { detail: { nonce: WFB_NONCE } }));
  };
  setTimeout(sendNonce, 0);
  setTimeout(sendNonce, 50);
  setTimeout(sendNonce, 200);

  // 2. Charger l'état et synchroniser avec le MAIN world
  loadAndSyncEnabledState();

  // 3. Démarrer l'observer si protection active
  chrome.storage.local.get(['enabled'], (data) => {
    if (data.enabled !== false) {
      observer.observe(document.documentElement, observerConfig);
    }
  });

  // 4. Nettoyage périodique
  setInterval(() => {
    if (!protectionEnabled) return;
    removeAdElements();
    removeAntiAdblockMessages();
    cleanSenpaiStreamScams();
    cleanEmpireStreamingSafe();
  }, 2000);

  // 5. [S7] Toast léger : afficher en bas à droite quand un popup est bloqué
  // Reçoit le signal depuis le MAIN world (__wfb_popup_blocked__)
  // Respecte le niveau de notification configuré dans les options
  let _notifLevel = 'minimal';
  chrome.storage.sync.get(['notification_level']).then(data => {
    _notifLevel = data.notification_level || 'minimal';
  }).catch(() => {});

  window.addEventListener('__wfb_popup_blocked__', (e) => {
    if (!protectionEnabled) return;
    if (_notifLevel === 'silent') return; // Pas de toast en mode silencieux

    const url = (e.detail && e.detail.url) || '';
    let shortUrl = '';
    try { shortUrl = new URL(url).hostname; } catch { shortUrl = url.slice(0, 30); }

    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
      'background:rgba(12,12,30,0.92)', 'color:#a855f7',
      'padding:8px 14px', 'border-radius:8px', 'font-size:12px',
      "font-family:'Inter',sans-serif", 'pointer-events:none',
      'border:1px solid rgba(124,58,237,0.4)',
      'backdrop-filter:blur(8px)', 'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
      'transition:opacity 0.4s', 'opacity:1'
    ].join(';');

    if (_notifLevel === 'verbose') {
      toast.textContent = `🚫 Popup bloqué : ${shortUrl || 'inconnu'} — ${url.slice(0, 60)}`;
    } else {
      toast.textContent = `🚫${shortUrl ? ' ' + shortUrl : ' popup'} bloqué`;
    }

    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2200);
  }, { passive: true });

  // 6. [S2] Détection heuristique de site de streaming inconnu
  // Si le score est ≥ 3/5 signaux, on envoie SUGGEST_SITE au SW pour que le popup
  // propose d'activer la protection.
  function detectUnknownStreamingSite() {
    if (!location.hostname) return;
    const signals = [
      !!document.querySelector('video, video[src]'),                                        // Lecteur vidéo
      !!document.querySelector('iframe[src*="player"], iframe[src*="embed"]'),              // Iframe de lecteur
      document.querySelectorAll('iframe').length >= 2,                                     // Beaucoup d'iframes
      document.querySelectorAll('[class*="overlay"], [class*="popup"]').length >= 2,       // Overlays
      document.title.toLowerCase().match(/streaming|film|série|episode|vf|vostfr|anime/) !== null // Titre streaming
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 3) {
      log('[StreamBlocker] Site inconnu ressemble à du streaming (score:', score, ') → envoi SUGGEST_SITE');
      try { chrome.runtime.sendMessage({ type: 'SUGGEST_SITE', hostname: location.hostname }); } catch {}
    }
  }

  // Lancer la détection après chargement du DOM (les éléments sont présents)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectUnknownStreamingSite);
  } else {
    setTimeout(detectUnknownStreamingSite, 1500);
  }

})();
