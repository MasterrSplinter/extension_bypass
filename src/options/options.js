'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const domainList       = document.getElementById('domainList');
  const disabledSitesList = document.getElementById('disabledSitesList');
  const addForm          = document.getElementById('addForm');
  const domainInput      = document.getElementById('domainInput');
  const toast            = document.getElementById('toast');
  const exportBtn        = document.getElementById('exportBtn');
  const importBtn        = document.getElementById('importBtn');
  const importInput      = document.getElementById('importInput');

  // ─── Afficher les domaines custom ────────────────────────────────────────────
  async function renderDomains() {
    // [S12] Depuis chrome.storage.sync
    const syncData = await chrome.storage.sync.get(['custom_domains', 'disabled_sites']).catch(() => ({}));
    const customDomains  = syncData.custom_domains  || [];
    const disabledSites  = syncData.disabled_sites  || [];

    // Sites sous protection custom
    if (customDomains.length === 0) {
      domainList.innerHTML = `
        <div class="empty-state">
          Aucun site personnalisé ajouté.<br><br>
          <em>Note: Les sites de streaming intégrés sont gérés automatiquement et n'apparaissent pas ici.</em>
        </div>`;
    } else {
      domainList.innerHTML = '';
      customDomains.forEach(domain => {
        const item    = document.createElement('div');
        item.className = 'domain-item';

        const name = document.createElement('div');
        name.className = 'domain-name';
        name.textContent = domain;

        const delBtn = document.createElement('button');
        delBtn.className   = 'btn btn-danger';
        delBtn.textContent = 'Supprimer';
        delBtn.onclick     = () => removeDomain(domain);

        item.appendChild(name);
        item.appendChild(delBtn);
        domainList.appendChild(item);
      });
    }

    // [S5] Sites où la protection est désactivée
    if (!disabledSitesList) return;
    if (disabledSites.length === 0) {
      disabledSitesList.innerHTML = `
        <div class="empty-state">
          Aucun site désactivé individuellement.
        </div>`;
    } else {
      disabledSitesList.innerHTML = '';
      disabledSites.forEach(hostname => {
        const item = document.createElement('div');
        item.className = 'disabled-site-item';

        const name = document.createElement('div');
        name.className = 'disabled-site-name';
        name.innerHTML = `⏸️ <span>${hostname}</span>`;

        const reBtn = document.createElement('button');
        reBtn.className   = 'btn-re-enable';
        reBtn.textContent = '▶️ Réactiver';
        reBtn.onclick     = () => reEnableSite(hostname);

        item.appendChild(name);
        item.appendChild(reBtn);
        disabledSitesList.appendChild(item);
      });
    }
  }

  // ─── Ajouter un domaine ──────────────────────────────────────────────────────
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let val = domainInput.value.trim().toLowerCase();
    if (!val) return;

    try {
      if (val.startsWith('http')) val = new URL(val).hostname;
      val = val.replace(/^www\./, '');
      if (val.includes('/')) val = val.split('/')[0];
    } catch {}

    if (!val.includes('.')) {
      showToast('⚠️ Veuillez entrer un domaine valide.', true);
      return;
    }

    const btn = addForm.querySelector('button');
    btn.textContent = '...';
    btn.disabled = true;

    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'ADD_CUSTOM_DOMAIN', domain: val }, resolve);
      });
      domainInput.value = '';
      showToast('✅ Domaine ajouté !');
      await renderDomains();
    } catch {
      showToast('❌ Erreur lors de l\'ajout', true);
    } finally {
      btn.textContent = 'Ajouter';
      btn.disabled = false;
    }
  });

  // ─── Supprimer un domaine ────────────────────────────────────────────────────
  async function removeDomain(domain) {
    if (!confirm(`Supprimer ${domain} de la liste de protection ?`)) return;
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'REMOVE_CUSTOM_DOMAIN', domain }, resolve);
      });
      showToast('🗑️ Domaine supprimé');
      await renderDomains();
    } catch {
      showToast('❌ Erreur lors de la suppression', true);
    }
  }

  // ─── [S5] Réactiver un site désactivé ───────────────────────────────────────
  async function reEnableSite(hostname) {
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PROTECTION', hostname, disabled: false }, resolve);
      });
      showToast(`✅ Protection réactivée sur ${hostname}`);
      await renderDomains();
    } catch {
      showToast('❌ Erreur lors de la réactivation', true);
    }
  }

  // ─── [S8] Export des domaines custom ────────────────────────────────────────
  exportBtn.addEventListener('click', async () => {
    try {
      const syncData = await chrome.storage.sync.get(['custom_domains']).catch(() => ({}));
      const domains = syncData.custom_domains || [];

      if (domains.length === 0) {
        showToast('ℹ️ Aucun domaine à exporter', false);
        return;
      }

      const payload = {
        version: '1.0',
        exported: new Date().toISOString(),
        extension: 'Streaming AdBlocker Pro',
        custom_domains: domains
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `streaming-adblocker-domains-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`✅ ${domains.length} domaine(s) exporté(s)`);
    } catch (e) {
      showToast('❌ Erreur lors de l\'export', true);
    }
  });

  // ─── [S8] Import des domaines custom ────────────────────────────────────────
  importBtn.addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Valider le format
      const domains = data.custom_domains;
      if (!Array.isArray(domains)) throw new Error('Format invalide : custom_domains manquant');

      // Valider chaque domaine
      const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
      const validDomains = domains.filter(d =>
        typeof d === 'string' && DOMAIN_REGEX.test(d.toLowerCase()) && d.length <= 253
      );

      if (validDomains.length === 0) throw new Error('Aucun domaine valide dans le fichier');

      // Merger avec les domaines existants
      const syncData = await chrome.storage.sync.get(['custom_domains']).catch(() => ({}));
      const existing = syncData.custom_domains || [];
      const merged   = [...new Set([...existing, ...validDomains.map(d => d.toLowerCase())])];

      // Envoyer chaque nouveau domaine au SW
      let added = 0;
      for (const domain of validDomains.map(d => d.toLowerCase())) {
        if (!existing.includes(domain)) {
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'ADD_CUSTOM_DOMAIN', domain }, resolve);
          });
          added++;
        }
      }

      showToast(`✅ ${added} nouveau(x) domaine(s) importé(s)`);
      await renderDomains();
    } catch (err) {
      showToast(`❌ Import échoué : ${err.message}`, true);
    } finally {
      importInput.value = ''; // Reset pour pouvoir réimporter
    }
  });

  // ─── Utilitaire Toast ────────────────────────────────────────────────────────
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }

  // ─── Paramètres avancés : Debug toggle ──────────────────────────────────────
  const debugToggle    = document.getElementById('debugToggle');
  const debugSlider    = document.getElementById('debugSlider');
  const notifLevel     = document.getElementById('notificationLevel');

  // Cookie cleaning
  const cookieCleaningToggle = document.getElementById('cookieCleaningToggle');
  const cookieSlider         = document.getElementById('cookieSlider');
  const cookieStats          = document.getElementById('cookieStats');
  const cleanNowBtn          = document.getElementById('cleanNowBtn');

  // Charger les valeurs sauvegardées
  const advancedSettings = await chrome.storage.sync.get(['debug_mode', 'notification_level', 'cookie_cleaning']).catch(() => ({}));

  if (advancedSettings.debug_mode) {
    debugToggle.checked = true;
    debugSlider.style.transform = 'translateX(20px)';
    debugSlider.style.background = 'var(--accent-light)';
  }
  if (advancedSettings.notification_level) {
    notifLevel.value = advancedSettings.notification_level;
  }
  if (advancedSettings.cookie_cleaning) {
    cookieCleaningToggle.checked = true;
    cookieSlider.style.transform = 'translateX(20px)';
    cookieSlider.style.background = 'var(--success)';
  }

  // Charger les stats cookies
  async function updateCookieStats() {
    const data = await chrome.storage.local.get(['cookiesCleanedTotal', 'lastCookieClean']).catch(() => ({}));
    if (cookieStats) {
      const total = data.cookiesCleanedTotal || 0;
      const lastClean = data.lastCookieClean;
      let text = `${total} cookie${total > 1 ? 's' : ''} supprimé${total > 1 ? 's' : ''} au total`;
      if (lastClean) {
        const ago = Math.round((Date.now() - lastClean) / 60000);
        text += ` · Dernier nettoyage : ${ago < 1 ? 'à l\'instant' : `il y a ${ago} min`}`;
      }
      cookieStats.textContent = total > 0 ? text : '';
    }
  }
  await updateCookieStats();

  debugToggle.addEventListener('change', async () => {
    const isDebug = debugToggle.checked;
    debugSlider.style.transform = isDebug ? 'translateX(20px)' : 'translateX(0)';
    debugSlider.style.background = isDebug ? 'var(--accent-light)' : 'var(--text-secondary)';
    await chrome.storage.sync.set({ debug_mode: isDebug });
    showToast(isDebug ? '🐛 Mode debug activé' : '🐛 Mode debug désactivé');
  });

  notifLevel.addEventListener('change', async () => {
    await chrome.storage.sync.set({ notification_level: notifLevel.value });
    const labels = { silent: '🔇 Silencieux', minimal: '🔔 Minimal', verbose: '📢 Verbose' };
    showToast(`Notifications : ${labels[notifLevel.value]}`);
  });

  cookieCleaningToggle.addEventListener('change', async () => {
    const isOn = cookieCleaningToggle.checked;
    cookieSlider.style.transform = isOn ? 'translateX(20px)' : 'translateX(0)';
    cookieSlider.style.background = isOn ? 'var(--success)' : 'var(--text-secondary)';
    await chrome.storage.sync.set({ cookie_cleaning: isOn });
    showToast(isOn ? '🧹 Nettoyage cookies activé' : '🧹 Nettoyage cookies désactivé');
  });

  cleanNowBtn.addEventListener('click', async () => {
    cleanNowBtn.textContent = '⏳ Nettoyage...';
    cleanNowBtn.disabled = true;
    try {
      // Activer temporairement si désactivé
      const wasOff = !cookieCleaningToggle.checked;
      if (wasOff) await chrome.storage.sync.set({ cookie_cleaning: true });

      const response = await chrome.runtime.sendMessage({ type: 'CLEAN_COOKIES' });

      if (wasOff) await chrome.storage.sync.set({ cookie_cleaning: false });

      const count = response?.cleaned || 0;
      showToast(count > 0 ? `🧹 ${count} cookie(s) tracking supprimé(s) !` : '✅ Aucun cookie tracking trouvé');
      await updateCookieStats();
    } catch {
      showToast('❌ Erreur lors du nettoyage', true);
    }
    cleanNowBtn.textContent = '🧹 Maintenant';
    cleanNowBtn.disabled = false;
  });

  // ─── Init ────────────────────────────────────────────────────────────────────
  await renderDomains();
});
