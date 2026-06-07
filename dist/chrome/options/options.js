"use strict";
(() => {
  // src/options/options.js
  document.addEventListener("DOMContentLoaded", async () => {
    const domainList = document.getElementById("domainList");
    const disabledSitesList = document.getElementById("disabledSitesList");
    const addForm = document.getElementById("addForm");
    const domainInput = document.getElementById("domainInput");
    const toast = document.getElementById("toast");
    const exportBtn = document.getElementById("exportBtn");
    const importBtn = document.getElementById("importBtn");
    const importInput = document.getElementById("importInput");
    async function renderDomains() {
      const syncData = await chrome.storage.sync.get(["custom_domains", "disabled_sites"]).catch(() => ({}));
      const customDomains = syncData.custom_domains || [];
      const disabledSites = syncData.disabled_sites || [];
      if (customDomains.length === 0) {
        domainList.innerHTML = `
        <div class="empty-state">
          Aucun site personnalis\xE9 ajout\xE9.<br><br>
          <em>Note: Les sites de streaming int\xE9gr\xE9s sont g\xE9r\xE9s automatiquement et n'apparaissent pas ici.</em>
        </div>`;
      } else {
        domainList.innerHTML = "";
        customDomains.forEach((domain) => {
          const item = document.createElement("div");
          item.className = "domain-item";
          const name = document.createElement("div");
          name.className = "domain-name";
          name.textContent = domain;
          const delBtn = document.createElement("button");
          delBtn.className = "btn btn-danger";
          delBtn.textContent = "Supprimer";
          delBtn.onclick = () => removeDomain(domain);
          item.appendChild(name);
          item.appendChild(delBtn);
          domainList.appendChild(item);
        });
      }
      if (!disabledSitesList) return;
      if (disabledSites.length === 0) {
        disabledSitesList.innerHTML = `
        <div class="empty-state">
          Aucun site d\xE9sactiv\xE9 individuellement.
        </div>`;
      } else {
        disabledSitesList.innerHTML = "";
        disabledSites.forEach((hostname) => {
          const item = document.createElement("div");
          item.className = "disabled-site-item";
          const name = document.createElement("div");
          name.className = "disabled-site-name";
          name.innerHTML = `\u23F8\uFE0F <span>${hostname}</span>`;
          const reBtn = document.createElement("button");
          reBtn.className = "btn-re-enable";
          reBtn.textContent = "\u25B6\uFE0F R\xE9activer";
          reBtn.onclick = () => reEnableSite(hostname);
          item.appendChild(name);
          item.appendChild(reBtn);
          disabledSitesList.appendChild(item);
        });
      }
    }
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let val = domainInput.value.trim().toLowerCase();
      if (!val) return;
      try {
        if (val.startsWith("http")) val = new URL(val).hostname;
        val = val.replace(/^www\./, "");
        if (val.includes("/")) val = val.split("/")[0];
      } catch {
      }
      if (!val.includes(".")) {
        showToast("\u26A0\uFE0F Veuillez entrer un domaine valide.", true);
        return;
      }
      const btn = addForm.querySelector("button");
      btn.textContent = "...";
      btn.disabled = true;
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "ADD_CUSTOM_DOMAIN", domain: val }, resolve);
        });
        domainInput.value = "";
        showToast("\u2705 Domaine ajout\xE9 !");
        await renderDomains();
      } catch {
        showToast("\u274C Erreur lors de l'ajout", true);
      } finally {
        btn.textContent = "Ajouter";
        btn.disabled = false;
      }
    });
    async function removeDomain(domain) {
      if (!confirm(`Supprimer ${domain} de la liste de protection ?`)) return;
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "REMOVE_CUSTOM_DOMAIN", domain }, resolve);
        });
        showToast("\u{1F5D1}\uFE0F Domaine supprim\xE9");
        await renderDomains();
      } catch {
        showToast("\u274C Erreur lors de la suppression", true);
      }
    }
    async function reEnableSite(hostname) {
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "TOGGLE_SITE_PROTECTION", hostname, disabled: false }, resolve);
        });
        showToast(`\u2705 Protection r\xE9activ\xE9e sur ${hostname}`);
        await renderDomains();
      } catch {
        showToast("\u274C Erreur lors de la r\xE9activation", true);
      }
    }
    exportBtn.addEventListener("click", async () => {
      try {
        const syncData = await chrome.storage.sync.get(["custom_domains"]).catch(() => ({}));
        const domains = syncData.custom_domains || [];
        if (domains.length === 0) {
          showToast("\u2139\uFE0F Aucun domaine \xE0 exporter", false);
          return;
        }
        const payload = {
          version: "1.0",
          exported: (/* @__PURE__ */ new Date()).toISOString(),
          extension: "Streaming AdBlocker Pro",
          custom_domains: domains
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `streaming-adblocker-domains-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`\u2705 ${domains.length} domaine(s) export\xE9(s)`);
      } catch (e) {
        showToast("\u274C Erreur lors de l'export", true);
      }
    });
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const domains = data.custom_domains;
        if (!Array.isArray(domains)) throw new Error("Format invalide : custom_domains manquant");
        const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
        const validDomains = domains.filter(
          (d) => typeof d === "string" && DOMAIN_REGEX.test(d.toLowerCase()) && d.length <= 253
        );
        if (validDomains.length === 0) throw new Error("Aucun domaine valide dans le fichier");
        const syncData = await chrome.storage.sync.get(["custom_domains"]).catch(() => ({}));
        const existing = syncData.custom_domains || [];
        const merged = [.../* @__PURE__ */ new Set([...existing, ...validDomains.map((d) => d.toLowerCase())])];
        let added = 0;
        for (const domain of validDomains.map((d) => d.toLowerCase())) {
          if (!existing.includes(domain)) {
            await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: "ADD_CUSTOM_DOMAIN", domain }, resolve);
            });
            added++;
          }
        }
        showToast(`\u2705 ${added} nouveau(x) domaine(s) import\xE9(s)`);
        await renderDomains();
      } catch (err) {
        showToast(`\u274C Import \xE9chou\xE9 : ${err.message}`, true);
      } finally {
        importInput.value = "";
      }
    });
    function showToast(msg, isError = false) {
      toast.textContent = msg;
      toast.className = "toast show" + (isError ? " error" : "");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 3e3);
    }
    const debugToggle = document.getElementById("debugToggle");
    const debugSlider = document.getElementById("debugSlider");
    const notifLevel = document.getElementById("notificationLevel");
    const cookieCleaningToggle = document.getElementById("cookieCleaningToggle");
    const cookieSlider = document.getElementById("cookieSlider");
    const cookieStats = document.getElementById("cookieStats");
    const cleanNowBtn = document.getElementById("cleanNowBtn");
    const advancedSettings = await chrome.storage.sync.get(["debug_mode", "notification_level", "cookie_cleaning"]).catch(() => ({}));
    if (advancedSettings.debug_mode) {
      debugToggle.checked = true;
      debugSlider.style.transform = "translateX(20px)";
      debugSlider.style.background = "var(--accent-light)";
    }
    if (advancedSettings.notification_level) {
      notifLevel.value = advancedSettings.notification_level;
    }
    if (advancedSettings.cookie_cleaning) {
      cookieCleaningToggle.checked = true;
      cookieSlider.style.transform = "translateX(20px)";
      cookieSlider.style.background = "var(--success)";
    }
    async function updateCookieStats() {
      const data = await chrome.storage.local.get(["cookiesCleanedTotal", "lastCookieClean"]).catch(() => ({}));
      if (cookieStats) {
        const total = data.cookiesCleanedTotal || 0;
        const lastClean = data.lastCookieClean;
        let text = `${total} cookie${total > 1 ? "s" : ""} supprim\xE9${total > 1 ? "s" : ""} au total`;
        if (lastClean) {
          const ago = Math.round((Date.now() - lastClean) / 6e4);
          text += ` \xB7 Dernier nettoyage : ${ago < 1 ? "\xE0 l'instant" : `il y a ${ago} min`}`;
        }
        cookieStats.textContent = total > 0 ? text : "";
      }
    }
    await updateCookieStats();
    debugToggle.addEventListener("change", async () => {
      const isDebug = debugToggle.checked;
      debugSlider.style.transform = isDebug ? "translateX(20px)" : "translateX(0)";
      debugSlider.style.background = isDebug ? "var(--accent-light)" : "var(--text-secondary)";
      await chrome.storage.sync.set({ debug_mode: isDebug });
      showToast(isDebug ? "\u{1F41B} Mode debug activ\xE9" : "\u{1F41B} Mode debug d\xE9sactiv\xE9");
    });
    notifLevel.addEventListener("change", async () => {
      await chrome.storage.sync.set({ notification_level: notifLevel.value });
      const labels = { silent: "\u{1F507} Silencieux", minimal: "\u{1F514} Minimal", verbose: "\u{1F4E2} Verbose" };
      showToast(`Notifications : ${labels[notifLevel.value]}`);
    });
    cookieCleaningToggle.addEventListener("change", async () => {
      const isOn = cookieCleaningToggle.checked;
      cookieSlider.style.transform = isOn ? "translateX(20px)" : "translateX(0)";
      cookieSlider.style.background = isOn ? "var(--success)" : "var(--text-secondary)";
      await chrome.storage.sync.set({ cookie_cleaning: isOn });
      showToast(isOn ? "\u{1F9F9} Nettoyage cookies activ\xE9" : "\u{1F9F9} Nettoyage cookies d\xE9sactiv\xE9");
    });
    cleanNowBtn.addEventListener("click", async () => {
      cleanNowBtn.textContent = "\u23F3 Nettoyage...";
      cleanNowBtn.disabled = true;
      try {
        const wasOff = !cookieCleaningToggle.checked;
        if (wasOff) await chrome.storage.sync.set({ cookie_cleaning: true });
        const response = await chrome.runtime.sendMessage({ type: "CLEAN_COOKIES" });
        if (wasOff) await chrome.storage.sync.set({ cookie_cleaning: false });
        const count = response?.cleaned || 0;
        showToast(count > 0 ? `\u{1F9F9} ${count} cookie(s) tracking supprim\xE9(s) !` : "\u2705 Aucun cookie tracking trouv\xE9");
        await updateCookieStats();
      } catch {
        showToast("\u274C Erreur lors du nettoyage", true);
      }
      cleanNowBtn.textContent = "\u{1F9F9} Maintenant";
      cleanNowBtn.disabled = false;
    });
    await renderDomains();
  });
})();
