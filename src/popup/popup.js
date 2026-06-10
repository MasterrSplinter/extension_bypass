/**
 * popup.js — Streaming AdBlocker Pro
 *
 * - Toggle ON/OFF délégué au SW (TOGGLE_PROTECTION) avec fallback direct
 * - MAJ temps réel via chrome.storage.onChanged (pas de setInterval)
 * - Lecture initiale de l'état via GET_STATS (inclut `enabled` depuis le SW)
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // ─── Références DOM ──────────────────────────────────────────────────────────
  const blockedCountEl = document.getElementById('blockedCount');
  const rulesCountEl   = document.getElementById('rulesCount');
  const statusDot      = document.getElementById('statusDot');
  const statusText     = document.getElementById('statusText');
  const mainToggle     = document.getElementById('mainToggle');
  const resetBtn       = document.getElementById('resetBtn');
  const openGithubBtn  = document.getElementById('openGithub');
  const toast          = document.getElementById('toast');
  const siteInfo       = document.getElementById('siteInfo');
  const notProtected   = document.getElementById('notProtected');
  const siteStatusText = document.getElementById('siteStatusText');
  const historyList    = document.getElementById('historyList');
  const rulesInfo      = document.getElementById('rulesInfo');
  const addDomainBtn   = document.getElementById('addDomainBtn');
  const currentDomainLabel = document.getElementById('currentDomainLabel');

  // Liste partagée : shared/blocklists.js, chargé avant popup.js dans popup.html
  const STREAMING_SITES = WFB_STREAMING_SITES;

  // ─── État local ──────────────────────────────────────────────────────────────
  let currentEnabled = true;

  // ─── Chargement initial depuis le storage (source de vérité) ─────────────────
  async function loadState() {
    try {
      // Essayer d'abord via le SW (inclut l'état en cache du SW)
      const stats = await sendMessageSafe({ type: 'GET_STATS' });
      if (stats) {
        applyStats(stats);
        currentEnabled = stats.enabled !== false;
      }
    } catch {}

    // Toujours lire le storage directement pour s'assurer de l'état actuel
    const data = await chrome.storage.local.get(['enabled', 'blockedCount', 'blockedHistory', 'rulesCount']);
    currentEnabled = data.enabled !== false;

    applyStorageData(data);
    updateToggleUI(currentEnabled);

    // Vérifier l'onglet actif
    await checkActiveTab(currentEnabled);
  }

  function applyStats(stats) {
    if (blockedCountEl) blockedCountEl.textContent = formatNumber(stats.blockedCount || 0);
    const rules = stats.rulesCount || WFB_DEFAULT_RULES_COUNT;
    if (rulesCountEl) rulesCountEl.textContent = String(rules);
    if (rulesInfo)    rulesInfo.textContent    = `${rules} règles actives`;
    renderHistory(stats.blockedHistory || {});
  }

  function applyStorageData(data) {
    const count   = data.blockedCount || 0;
    const history = data.blockedHistory || {};
    const rules   = data.rulesCount || WFB_DEFAULT_RULES_COUNT;

    if (blockedCountEl) blockedCountEl.textContent = formatNumber(count);
    if (rulesCountEl)   rulesCountEl.textContent   = String(rules);
    if (rulesInfo)      rulesInfo.textContent      = `${rules} règles actives`;
    renderHistory(history);
  }

  // ─── Écoute des changements storage (temps réel, sans setInterval) ───────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.blockedCount) {
      const count = changes.blockedCount.newValue || 0;
      if (blockedCountEl) blockedCountEl.textContent = formatNumber(count);
    }
    if (changes.blockedHistory) {
      renderHistory(changes.blockedHistory.newValue || {});
    }
    if (changes.rulesCount) {
      const rules = changes.rulesCount.newValue || WFB_DEFAULT_RULES_COUNT;
      if (rulesCountEl) rulesCountEl.textContent = String(rules);
      if (rulesInfo)    rulesInfo.textContent    = `${rules} règles actives`;
    }
    if (changes.enabled !== undefined) {
      const newEnabled = changes.enabled.newValue !== false;
      // Mettre à jour l'UI seulement si différent de l'état affiché
      if (newEnabled !== currentEnabled) {
        currentEnabled = newEnabled;
        updateToggleUI(newEnabled);
      }
    }
  });

  // ─── Toggle ON/OFF ───────────────────────────────────────────────────────────
  mainToggle.addEventListener('change', async () => {
    const isEnabled = mainToggle.checked;
    currentEnabled = isEnabled;

    // Mise à jour visuelle immédiate (avant la réponse du SW)
    updateToggleUI(isEnabled);
    showToast(isEnabled ? '✅ Protection activée' : '⏸️ Protection désactivée');

    // Déléguer au SW
    try {
      const response = await sendMessageSafe({ type: 'TOGGLE_PROTECTION', enabled: isEnabled });
      if (!response || !response.ok) throw new Error('SW response failed');
    } catch {
      // Fallback : écrire directement en storage + DNR
      await chrome.storage.local.set({ enabled: isEnabled });
      try {
        await chrome.declarativeNetRequest.updateEnabledRulesets(
          isEnabled
            ? { enableRulesetIds: ['ruleset_main'], disableRulesetIds: [] }
            : { enableRulesetIds: [], disableRulesetIds: ['ruleset_main'] }
        );
      } catch {}
    }

    // Mettre à jour le texte de statut du site
    if (siteStatusText && siteInfo && siteInfo.style.display !== 'none') {
      siteStatusText.textContent = isEnabled ? 'Protection complète' : 'Protection désactivée';
    }
  });

  // ─── Reset stats ─────────────────────────────────────────────────────────────
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ blockedCount: 0, blockedHistory: {} });
    if (blockedCountEl) blockedCountEl.textContent = '0';
    renderHistory({});
    try { await sendMessageSafe({ type: 'RESET_STATS' }); } catch {}
    showToast('✅ Stats réinitialisées !');
  });

  // ─── Ouvrir GitHub ───────────────────────────────────────────────────────────
  openGithubBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/MasterrSplinter/extension_bypass' });
  });

  // ─── Ouvrir la page d'options ────────────────────────────────────────────────
  const optionsBtn = document.getElementById('optionsBtn');
  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // ─── Vérifier l'onglet actif ─────────────────────────────────────────────────
  async function checkActiveTab(enabled) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) return;
      
      let hostname = '';
      try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
      if (!hostname) return;

      const data = await chrome.storage.local.get(['custom_domains']);
      const customDomains = data.custom_domains || [];

      const isProtected = STREAMING_SITES.some(d => hostname === d || hostname.endsWith('.' + d)) || 
                          customDomains.some(d => hostname === d || hostname.endsWith('.' + d));

      if (isProtected) {
        if (siteInfo)    siteInfo.style.display    = 'flex';
        if (notProtected)  notProtected.style.display  = 'none';
        if (siteStatusText) {
          siteStatusText.textContent = enabled ? 'Protection complète' : 'Protection désactivée';
        }
        const siteLabel = document.getElementById('siteLabel');
        if (siteLabel) siteLabel.textContent = hostname;
      } else {
        if (siteInfo)    siteInfo.style.display    = 'none';
        if (notProtected)  notProtected.style.display  = 'block';
        if (currentDomainLabel) currentDomainLabel.textContent = hostname;
        
        if (addDomainBtn) {
          addDomainBtn.onclick = async () => {
            addDomainBtn.textContent = '⏳ Activation...';
            addDomainBtn.disabled = true;
            try {
              await sendMessageSafe({ type: 'ADD_CUSTOM_DOMAIN', domain: hostname });
              showToast('✅ Protection activée pour ce site !');
              setTimeout(() => chrome.tabs.reload(tab.id), 1000);
            } catch {
              showToast('❌ Erreur lors de l\'activation');
              addDomainBtn.textContent = '⚡ Activer sur ce site';
              addDomainBtn.disabled = false;
            }
          };
        }
      }
    } catch {}
  }

  // ─── Utilitaires UI ──────────────────────────────────────────────────────────

  function updateToggleUI(isEnabled) {
    mainToggle.checked = isEnabled;

    // ─── En-tête statut ────────────────────────────────────────
    if (isEnabled) {
      statusDot.classList.remove('inactive');
      statusText.classList.remove('inactive');
      statusText.textContent = 'Protection active';
    } else {
      statusDot.classList.add('inactive');
      statusText.classList.add('inactive');
      statusText.textContent = 'Protection désactivée';
    }

    // ─── Feature items : changer le statut ─────────────────────
    const featureStatuses = document.querySelectorAll('.feature-status');
    featureStatuses.forEach(el => {
      if (isEnabled) {
        el.textContent = '✅ Actif';
        el.style.color = 'var(--success)';
        el.style.opacity = '1';
      } else {
        el.textContent = '⏸️ Off';
        el.style.color = 'var(--text-secondary)';
        el.style.opacity = '0.5';
      }
    });

    // ─── Opacité globale de la section features ─────────────────
    const featuresSection = document.querySelector('.features-section');
    if (featuresSection) {
      featuresSection.style.opacity = isEnabled ? '1' : '0.45';
      featuresSection.style.transition = 'opacity 0.3s ease';
    }
  }

  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function renderHistory(history) {
    if (!historyList) return;
    const entries = Object.entries(history)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (entries.length === 0) {
      historyList.innerHTML = '<div class="history-empty">Aucun domaine bloqué pour l\'instant</div>';
      return;
    }

    const max = entries[0][1];
    historyList.innerHTML = entries.map(([domain, count]) => {
      const pct = Math.round((count / max) * 100);
      const shortDomain = domain.length > 24 ? domain.slice(0, 22) + '…' : domain;
      return `<div class="history-item">
        <span class="history-domain" title="${domain}">${shortDomain}</span>
        <div class="history-bar-wrap"><div class="history-bar" style="width:${pct}%"></div></div>
        <span class="history-count">${count}</span>
      </div>`;
    }).join('');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Envoyer un message au SW avec timeout pour éviter le blocage
  function sendMessageSafe(message, timeoutMs = 1500) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            // Ignorer l'erreur "receiving end does not exist" (SW dormant)
            const err = chrome.runtime.lastError.message || '';
            if (err.includes('receiving end') || err.includes('Could not establish')) {
              resolve(null); // SW dormant, fallback va gérer
            } else {
              reject(new Error(err));
            }
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });
  }

  // ─── Démarrage ───────────────────────────────────────────────────────────────
  await loadState();
});
