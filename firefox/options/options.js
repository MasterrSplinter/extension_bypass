'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const domainList = document.getElementById('domainList');
  const addForm = document.getElementById('addForm');
  const domainInput = document.getElementById('domainInput');
  const toast = document.getElementById('toast');

  // Afficher la liste
  async function renderDomains() {
    const data = await chrome.storage.local.get(['custom_domains']);
    const customDomains = data.custom_domains || [];

    if (customDomains.length === 0) {
      domainList.innerHTML = `
        <div class="empty-state">
          Aucun site personnalisé ajouté.<br><br>
          <em>Note: Les sites de streaming principaux (webflix.lol, etc.) sont gérés automatiquement en arrière-plan et n'apparaissent pas ici.</em>
        </div>`;
      return;
    }

    domainList.innerHTML = '';
    customDomains.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'domain-item';
      
      const name = document.createElement('div');
      name.className = 'domain-name';
      name.textContent = domain;
      
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = 'Supprimer';
      delBtn.onclick = () => removeDomain(domain);
      
      item.appendChild(name);
      item.appendChild(delBtn);
      domainList.appendChild(item);
    });
  }

  // Ajouter un domaine
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let val = domainInput.value.trim().toLowerCase();
    if (!val) return;

    // Nettoyage basique (retirer http://, https://, www., et les paths)
    try {
      if (val.startsWith('http')) {
        val = new URL(val).hostname;
      }
      val = val.replace(/^www\./, '');
      if (val.includes('/')) {
        val = val.split('/')[0];
      }
    } catch {}

    if (!val.includes('.')) {
      showToast('⚠️ Veuillez entrer un domaine valide.', true);
      return;
    }

    const btn = addForm.querySelector('button');
    btn.textContent = '...';
    btn.disabled = true;

    try {
      // Envoie au SW pour gérer le chrome.scripting.registerContentScripts
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

  // Supprimer un domaine
  async function removeDomain(domain) {
    if (!confirm(`Supprimer ${domain} de la liste de protection ?`)) return;

    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'REMOVE_CUSTOM_DOMAIN', domain: domain }, resolve);
      });
      showToast('🗑️ Domaine supprimé');
      await renderDomains();
    } catch {
      showToast('❌ Erreur lors de la suppression', true);
    }
  }

  // Utilitaire Toast
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }

  // Init
  await renderDomains();
});
