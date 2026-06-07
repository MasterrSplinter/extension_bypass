/**
 * popup.js — Streaming AdBlocker Pro v1.7
 * Améliorations :
 *  [S4] Stats avancées : MB économisés, temps économisé, sparkline 7 jours
 *  [S5] Toggle désactivation site par site
 *  [S2] Suggestion d'activation sur site inconnu détecté
 *  [S12] Lecture depuis chrome.storage.sync pour les préférences
 */

import { STREAMING_SITES } from '../shared/domains.js';

'use strict';

const DEBUG = false;
function log(...args) { if (DEBUG) console.log(...args); }

document.addEventListener('DOMContentLoaded', async () => {
  // ─── Références DOM ──────────────────────────────────────────────────────────
  const blockedCountEl    = document.getElementById('blockedCount');
  const savedDataEl       = document.getElementById('savedData');
  const savedTimeEl       = document.getElementById('savedTime');
  const rulesCountEl      = document.getElementById('rulesCount');
  const statusDot         = document.getElementById('statusDot');
  const statusText        = document.getElementById('statusText');
  const mainToggle        = document.getElementById('mainToggle');
  const resetBtn          = document.getElementById('resetBtn');
  const openGithubBtn     = document.getElementById('openGithub');
  const toast             = document.getElementById('toast');
  const siteInfo          = document.getElementById('siteInfo');
  const notProtected      = document.getElementById('notProtected');
  const siteStatusText    = document.getElementById('siteStatusText');
  const historyList       = document.getElementById('historyList');
  const updateRulesBtn    = document.getElementById('updateRulesBtn');
  const rulesInfo         = document.getElementById('rulesInfo');
  const addDomainBtn      = document.getElementById('addDomainBtn');
  const currentDomainLabel = document.getElementById('currentDomainLabel');
  const siteToggleBtn     = document.getElementById('siteToggleBtn');  // [S5]
  const sparklineCanvas   = document.getElementById('sparklineCanvas'); // [S4]
  const suggestBanner     = document.getElementById('suggestBanner');   // [S2]
  const suggestText       = document.getElementById('suggestText');     // [S2]
  const suggestYes        = document.getElementById('suggestYes');      // [S2]
  const suggestNo         = document.getElementById('suggestNo');       // [S2]

  // ─── État local ──────────────────────────────────────────────────────────────
  let currentEnabled = true;
  let currentHostname = '';
  let currentSiteDisabled = false;

  // ─── [S4] Constantes pour les stats économies ────────────────────────────────
  const AVG_AD_SIZE_KB   = 150;   // Taille moyenne d'une pub réseau
  const AVG_AD_TIME_S    = 4;     // Temps moyen d'une pub publicitaire

  // ─── Chargement initial ──────────────────────────────────────────────────────
  async function loadState() {
    try {
      const stats = await sendMessageSafe({ type: 'GET_STATS' });
      if (stats) {
        applyStats(stats);
        currentEnabled = stats.enabled !== false;
      }
    } catch {}

    // [S12] Lire les préférences depuis sync
    const syncData = await chrome.storage.sync.get(['enabled', 'disabled_sites']).catch(() => ({}));
    const localData = await chrome.storage.local.get(['blockedCount', 'blockedHistory', 'lastRulesUpdate', 'rulesCount', 'suggestedSite']).catch(() => ({}));

    currentEnabled = syncData.enabled !== false;
    applyLocalData(localData);
    updateToggleUI(currentEnabled);
    await checkActiveTab(currentEnabled, syncData.disabled_sites || []);

    // [S2] Afficher suggestion si pertinente
    const suggested = localData.suggestedSite;
    if (suggested && suggested.hostname && Date.now() - suggested.detectedAt < 3600000) {
      showSuggestBanner(suggested.hostname);
    }
  }

  // ─── [S4] Calculer et afficher les économies ─────────────────────────────────
  function computeSavings(blockedCount) {
    const dataMB  = ((blockedCount * AVG_AD_SIZE_KB) / 1024).toFixed(1);
    const timeSec = blockedCount * AVG_AD_TIME_S;
    const timeStr = timeSec >= 60
      ? Math.round(timeSec / 60) + ' min'
      : timeSec + ' s';
    return { dataMB, timeStr };
  }

  function applyStats(stats) {
    const count = stats.blockedCount || 0;
    if (blockedCountEl) blockedCountEl.textContent = formatNumber(count);

    // [S4] Économies
    const { dataMB, timeStr } = computeSavings(count);
    if (savedDataEl) savedDataEl.textContent = dataMB + ' MB';
    if (savedTimeEl) savedTimeEl.textContent = timeStr;

    if (rulesCountEl) rulesCountEl.textContent = String(stats.rulesCount || 40);
    if (rulesInfo) {
      const lastUpdate = stats.lastRulesUpdate
        ? new Date(stats.lastRulesUpdate).toLocaleDateString('fr-FR')
        : 'jamais';
      rulesInfo.textContent = `${stats.rulesCount || 40} règles · MàJ : ${lastUpdate}`;
    }
    renderHistory(stats.blockedHistory || {});

    // [S4] Sparkline 7 jours
    if (sparklineCanvas && stats.dailyStats) {
      drawSparkline(stats.dailyStats);
    }
  }

  function applyLocalData(data) {
    const count   = data.blockedCount || 0;
    const history = data.blockedHistory || {};
    const rules   = data.rulesCount || 40;

    if (blockedCountEl) blockedCountEl.textContent = formatNumber(count);

    // [S4]
    const { dataMB, timeStr } = computeSavings(count);
    if (savedDataEl) savedDataEl.textContent = dataMB + ' MB';
    if (savedTimeEl) savedTimeEl.textContent = timeStr;

    if (rulesCountEl) rulesCountEl.textContent = String(rules);
    if (rulesInfo) {
      const lastUpdate = data.lastRulesUpdate
        ? new Date(data.lastRulesUpdate).toLocaleDateString('fr-FR')
        : 'jamais';
      rulesInfo.textContent = `${rules} règles · MàJ : ${lastUpdate}`;
    }
    renderHistory(history);
  }

  // ─── [S4] Sparkline canvas 7 jours ──────────────────────────────────────────
  function drawSparkline(dailyStats) {
    if (!sparklineCanvas) return;
    const ctx = sparklineCanvas.getContext('2d');
    const w = sparklineCanvas.width;
    const h = sparklineCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(dailyStats[key] || 0);
    }

    const maxVal = Math.max(...days, 1);
    const step = w / (days.length - 1);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(124,58,237,0.5)');
    grad.addColorStop(1, 'rgba(124,58,237,0)');

    ctx.beginPath();
    ctx.moveTo(0, h - (days[0] / maxVal) * (h - 4) - 2);
    days.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / maxVal) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill area
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ─── Écoute des changements storage ─────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.blockedCount) {
        const count = changes.blockedCount.newValue || 0;
        if (blockedCountEl) blockedCountEl.textContent = formatNumber(count);
        const { dataMB, timeStr } = computeSavings(count);
        if (savedDataEl) savedDataEl.textContent = dataMB + ' MB';
        if (savedTimeEl) savedTimeEl.textContent = timeStr;
      }
      if (changes.blockedHistory) renderHistory(changes.blockedHistory.newValue || {});
      if (changes.rulesCount) {
        if (rulesCountEl) rulesCountEl.textContent = String(changes.rulesCount.newValue || 40);
      }
    }
    if (area === 'sync') {
      if (changes.enabled !== undefined) {
        const newEnabled = changes.enabled.newValue !== false;
        if (newEnabled !== currentEnabled) {
          currentEnabled = newEnabled;
          updateToggleUI(newEnabled);
        }
      }
    }
  });

  // ─── Toggle ON/OFF global ────────────────────────────────────────────────────
  mainToggle.addEventListener('change', async () => {
    const isEnabled = mainToggle.checked;
    currentEnabled = isEnabled;
    updateToggleUI(isEnabled);
    showToast(isEnabled ? '✅ Protection activée' : '⏸️ Protection désactivée');

    try {
      const response = await sendMessageSafe({ type: 'TOGGLE_PROTECTION', enabled: isEnabled });
      if (!response || !response.ok) throw new Error('SW response failed');
    } catch {
      // Fallback
      await chrome.storage.sync.set({ enabled: isEnabled }).catch(() =>
        chrome.storage.local.set({ enabled: isEnabled })
      );
    }

    if (siteStatusText && siteInfo && siteInfo.style.display !== 'none') {
      updateSiteToggleBtn();
    }
  });

  // ─── [S5] Toggle site par site ───────────────────────────────────────────────
  if (siteToggleBtn) {
    siteToggleBtn.addEventListener('click', async () => {
      if (!currentHostname) return;
      currentSiteDisabled = !currentSiteDisabled;
      siteToggleBtn.disabled = true;

      try {
        await sendMessageSafe({
          type: 'TOGGLE_SITE_PROTECTION',
          hostname: currentHostname,
          disabled: currentSiteDisabled
        });
        updateSiteToggleBtn();
        showToast(currentSiteDisabled
          ? `⏸️ Désactivé sur ${currentHostname}`
          : `✅ Réactivé sur ${currentHostname}`);
      } catch {
        currentSiteDisabled = !currentSiteDisabled; // Annuler
        showToast('❌ Erreur lors du changement');
      } finally {
        siteToggleBtn.disabled = false;
      }
    });
  }

  function updateSiteToggleBtn() {
    if (!siteToggleBtn) return;
    const effectivelyEnabled = currentEnabled && !currentSiteDisabled;
    siteToggleBtn.textContent = currentSiteDisabled ? '▶️ Réactiver ici' : '⏸️ Désactiver ici';
    siteToggleBtn.title = currentSiteDisabled
      ? 'Réactiver la protection sur ce site'
      : 'Désactiver la protection uniquement sur ce site';
    if (siteStatusText) {
      siteStatusText.textContent = effectivelyEnabled ? 'Protection complète' : 'Protection désactivée ici';
    }
  }

  // ─── Reset stats ─────────────────────────────────────────────────────────────
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ blockedCount: 0, blockedHistory: {}, dailyStats: {} });
    if (blockedCountEl) blockedCountEl.textContent = '0';
    if (savedDataEl) savedDataEl.textContent = '0 MB';
    if (savedTimeEl) savedTimeEl.textContent = '0 s';
    renderHistory({});
    if (sparklineCanvas) {
      const ctx = sparklineCanvas.getContext('2d');
      ctx.clearRect(0, 0, sparklineCanvas.width, sparklineCanvas.height);
    }
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
    optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }

  // ─── Mettre à jour les règles ────────────────────────────────────────────────
  if (updateRulesBtn) {
    updateRulesBtn.addEventListener('click', async () => {
      updateRulesBtn.textContent = '🔄...';
      updateRulesBtn.disabled = true;
      try {
        const result = await sendMessageSafe({ type: 'UPDATE_RULES_NOW' });
        if (result && result.rulesCount) {
          if (rulesCountEl) rulesCountEl.textContent = String(result.rulesCount);
        }
        showToast('✅ Règles mises à jour !');
      } catch {
        showToast('⚠️ Règles locales conservées');
      } finally {
        updateRulesBtn.textContent = '🔄';
        updateRulesBtn.disabled = false;
      }
    });
  }

  // ─── [S2] Bannière de suggestion ─────────────────────────────────────────────
  function showSuggestBanner(hostname) {
    if (!suggestBanner || !suggestText) return;
    suggestText.textContent = `🔎 "${escapeHtml(hostname)}" ressemble à un site de streaming. Activer la protection ?`;
    suggestBanner.style.display = 'flex';

    if (suggestYes) {
      suggestYes.onclick = async () => {
        suggestBanner.style.display = 'none';
        await sendMessageSafe({ type: 'ADD_CUSTOM_DOMAIN', domain: hostname }).catch(() => {});
        await chrome.storage.local.remove('suggestedSite');
        showToast('✅ Protection activée !');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) setTimeout(() => chrome.tabs.reload(tab.id), 1000);
      };
    }
    if (suggestNo) {
      suggestNo.onclick = async () => {
        suggestBanner.style.display = 'none';
        await chrome.storage.local.remove('suggestedSite');
      };
    }
  }

  // ─── Vérifier l'onglet actif ─────────────────────────────────────────────────
  async function checkActiveTab(enabled, disabledSites = []) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) return;

      let hostname = '';
      try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
      if (!hostname) return;
      currentHostname = hostname;

      const data = await chrome.storage.sync.get(['custom_domains']).catch(() => ({}));
      const customDomains = data.custom_domains || [];

      const isProtected = STREAMING_SITES.some(d => hostname === d || hostname.endsWith('.' + d)) ||
                          customDomains.some(d => hostname === d || hostname.endsWith('.' + d));

      // [S5] Vérifier si ce site est désactivé individuellement
      currentSiteDisabled = disabledSites.some(d =>
        hostname === d.replace(/^www\./, '') || hostname.endsWith('.' + d.replace(/^www\./, ''))
      );

      if (isProtected) {
        if (siteInfo)     siteInfo.style.display    = 'flex';
        if (notProtected) notProtected.style.display = 'none';
        const siteLabel = document.getElementById('siteLabel');
        if (siteLabel) siteLabel.textContent = hostname;

        // Afficher les stats par site
        const siteBlockedEl = document.getElementById('siteBlockedCount');
        if (siteBlockedEl && stats.siteStats) {
          const cleanHost = hostname.replace(/^www\./, '');
          const siteData = stats.siteStats[cleanHost];
          if (siteData && siteData.blocked > 0) {
            siteBlockedEl.textContent = `🛡️ ${siteData.blocked} bloquée${siteData.blocked > 1 ? 's' : ''}`;
          } else {
            siteBlockedEl.textContent = '';
          }
        }

        updateSiteToggleBtn();
      } else {
        if (siteInfo)     siteInfo.style.display    = 'none';
        if (notProtected) notProtected.style.display = 'block';
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

    if (isEnabled) {
      statusDot.classList.remove('inactive');
      statusText.classList.remove('inactive');
      statusText.textContent = 'Protection active';
    } else {
      statusDot.classList.add('inactive');
      statusText.classList.add('inactive');
      statusText.textContent = 'Protection désactivée';
    }

    const featureStatuses = document.querySelectorAll('.feature-status');
    featureStatuses.forEach(el => {
      el.textContent = isEnabled ? '✅ Actif' : '⏸️ Off';
      el.style.color   = isEnabled ? 'var(--success)' : 'var(--text-secondary)';
      el.style.opacity = isEnabled ? '1' : '0.5';
    });

    const featuresSection = document.querySelector('.features-section');
    if (featuresSection) {
      featuresSection.style.opacity   = isEnabled ? '1' : '0.45';
      featuresSection.style.transition = 'opacity 0.3s ease';
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      const safeDomain  = escapeHtml(domain);
      const shortDomain = domain.length > 24 ? escapeHtml(domain.slice(0, 22)) + '…' : safeDomain;
      return `<div class="history-item">
        <span class="history-domain" title="${safeDomain}">${shortDomain}</span>
        <div class="history-bar-wrap"><div class="history-bar" style="width:${pct}%"></div></div>
        <span class="history-count">${Number(count)}</span>
      </div>`;
    }).join('');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function sendMessageSafe(message, timeoutMs = 1500) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || '';
            if (err.includes('receiving end') || err.includes('Could not establish')) {
              resolve(null);
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
