/**
 * content.js — Script injecté (ISOLATED WORLD) sur les sites de streaming
 * v1.5 — Gère l'état enabled et le communique au MAIN WORLD via CustomEvent
 *
 * RÔLE PRINCIPAL :
 *  1. Lire l'état `enabled` depuis chrome.storage
 *  2. Dispatcher __wfb_set_enabled__ pour que main_world.js respecte le toggle
 *  3. Écouter storage.onChanged pour les mises à jour en temps réel
 *  4. Nettoyer les éléments DOM publicitaires (overlays, liens)
 *  5. Relayer USER_CLICK du MAIN world vers le Service Worker
 */

(function () {
  'use strict';

  // Injection dynamique de main_world.js pour la compatibilité mobile (Kiwi, Orion)
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/main_world.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error("[StreamBlocker] Erreur injection main_world:", e);
    }
  }

  injectMainWorldScript();

  // ══════════════════════════════════════════════════════════════════
  // #0 — ÉTAT DE PROTECTION (SOURCE DE VÉRITÉ)
  // ══════════════════════════════════════════════════════════════════

  let protectionEnabled = true; // Défaut: actif

  // Charger l'état depuis le storage et l'envoyer au MAIN world
  function loadAndSyncEnabledState() {
    chrome.storage.local.get(['enabled'], (data) => {
      protectionEnabled = data.enabled !== false;
      syncEnabledToMainWorld(protectionEnabled);

      if (protectionEnabled) {
        // Nettoyage initial uniquement si protection active
        removeAdElements();
        removeAntiAdblockStyles();
        removeAntiAdblockMessages();
      }

      console.log(`[StreamBlocker] Protection ${protectionEnabled ? '✅ activée' : '⏸️ désactivée'} sur ${location.hostname}`);
    });
  }

  // Envoyer l'état au MAIN world via CustomEvent
  function syncEnabledToMainWorld(enabled) {
    try {
      window.dispatchEvent(new CustomEvent('__wfb_set_enabled__', { detail: enabled }));
    } catch {}
  }

  // Écouter les changements de storage en temps réel (toggle dans le popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled !== undefined) {
      const newEnabled = changes.enabled.newValue !== false;
      if (newEnabled !== protectionEnabled) {
        protectionEnabled = newEnabled;
        syncEnabledToMainWorld(protectionEnabled);
        console.log(`[StreamBlocker] Protection mise à jour: ${protectionEnabled ? '✅ ON' : '⏸️ OFF'}`);

        // Démarrer/arrêter l'observer
        if (protectionEnabled) {
          observer.observe(document.documentElement, observerConfig);
        } else {
          observer.disconnect();
        }
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // #1 — BLOQUER LES LIENS _BLANK (capture phase)
  // ══════════════════════════════════════════════════════════════════
  document.addEventListener('click', (e) => {
    if (!protectionEnabled) return;

    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;

    const href   = el.getAttribute('href') || '';
    const target = el.getAttribute('target') || '';

    if (target === '_blank' && href && !href.startsWith('#') && !href.startsWith('javascript')) {
      if (location.hostname.includes('senpai-stream') && (el.hasAttribute('wire:click') || el.closest('[wire\\:click]'))) {
        e.preventDefault();
        el.removeAttribute('target');
        console.log('[StreamBlocker] Senpai Stream: Lien _blank neutralisé (autorisé pour Livewire)');
        return;
      }
      try {
        const u = new URL(href, window.location.href);
        if (!isWhitelisted(u.hostname)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.log('[StreamBlocker] Lien _blank bloqué :', href);
          return;
        }
      } catch {}
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
    document.querySelectorAll('style').forEach(style => {
      if (style.textContent.includes('adblock') || style.textContent.includes('adblocker')) {
        style.remove();
        console.log('[StreamBlocker] Style anti-adblock supprimé');
      }
    });
  }

  function removeAntiAdblockMessages() {
    if (!protectionEnabled) return;
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
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // #4 — BLOQUER LES CLICS PUB
  // ══════════════════════════════════════════════════════════════════
  document.addEventListener('click', (e) => {
    if (!protectionEnabled) return;

    

    const target = e.target.closest('a[href]');
    if (target) {
        if (location.hostname.includes('senpai-stream') && target.closest('[wire\\:click]')) {
            // Laissez passer
        } else if (isAdUrl(target.href)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('[StreamBlocker] Clic pub bloqué vers :', target.href);
            return;
        }
    }
    if (!target) return;
    if (!e.isTrusted) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[StreamBlocker] Clic programmatique bloqué vers :', target.href);
      return;
    }

    try {
      const rect = target.getBoundingClientRect();
      const isHuge = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5;
      if (isHuge && target.href) {
        e.preventDefault();
        e.stopImmediatePropagation();
        target.remove();
        console.log('[StreamBlocker] Overlay géant bloqué et supprimé vers :', target.href);
        return;
      }

      if (window !== window.top && target.target === '_blank') {
        const linkHost = new URL(target.href).hostname;
        if (linkHost !== location.hostname) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.log('[StreamBlocker] Clic externe depuis iframe bloqué vers :', target.href);
          return;
        }
      }
    } catch (err) {}
    
    if (location.hostname.includes('senpai-stream') && e.target.closest('[wire\\:click]')) {
      e.preventDefault();
      target.removeAttribute('target');
      console.log('[StreamBlocker] Senpai Stream: Clic pub neutralisé mais autorisé pour Livewire');
      return;
    }

    if (isAdUrl(target.href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[StreamBlocker] Clic bloqué vers :', target.href);
    }
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (!protectionEnabled) return;

    

    if (e.button === 1) {
      const target = e.target.closest('a[href]');
      if (target) {
        if (location.hostname.includes('senpai-stream') && e.target.closest('[wire\\:click]')) { return; }
        if (isAdUrl(target.href)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    }
  }, true);

  // ══════════════════════════════════════════════════════════════════
  // #5 — RELAIS USER_CLICK → Service Worker
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
    'otieu.com', 'foreignabnormality.com', 'adnium.com', 'plugrush.com',
    'northseize.com', 'exe.io', 'short.pe', 'gplinks.co', 'realsrv.com'
  ];

  const WHITELIST_DOMAINS = [
    'google.com', 'accounts.google.com', 'facebook.com', 'paypal.com',
    'github.com', 'youtube.com', 'vimeo.com', 'dailymotion.com',
    'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
    'stripe.com', 'apple.com', 'microsoft.com'
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url, window.location.href);
      return AD_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return false; }
  }

  function isWhitelisted(hostname) {
    if (!hostname) return false;
    return WHITELIST_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  }

  // ══════════════════════════════════════════════════════════════════
  // DÉMARRAGE
  // ══════════════════════════════════════════════════════════════════

  // 1. Charger l'état et synchroniser avec le MAIN world
  loadAndSyncEnabledState();

  // 2. Démarrer l'observer si protection active (après loadAndSyncEnabledState)
  chrome.storage.local.get(['enabled'], (data) => {
    if (data.enabled !== false) {
      observer.observe(document.documentElement, observerConfig);
    }
  });

  // 3. Nettoyage périodique (seulement si actif)
  setInterval(() => {
    if (!protectionEnabled) return;
    removeAdElements();
    removeAntiAdblockMessages();
    cleanSenpaiStreamScams();
  }, 2000);

})();
