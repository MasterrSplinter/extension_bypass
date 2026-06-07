# 🛡️ Rapport de Sécurité — Streaming AdBlocker Pro v1.6.0

**Date** : 2026-06-07  
**Périmètre** : Révision statique complète du code source (aucune modification)  
**Fichiers analysés** : `manifest.chrome.json`, `manifest.firefox.json`, `background/background.js`, `content/content.js`, `content/main_world.js`, `content/player_cleaner.js`, `popup/popup.html`, `popup/popup.js`, `options/options.html`, `options/options.js`, `rules/rules.json`

---

## Résumé exécutif

L'extension est un bloqueur de publicités ciblant des sites de streaming francophones. Son code est globalement bien structuré, utilise Manifest V3, et respecte plusieurs bonnes pratiques. Cependant, **plusieurs problèmes de sécurité ont été identifiés**, allant de critiques à informatifs, qui pourraient exposer les utilisateurs à des risques réels.

| Sévérité | Nombre |
|---|---|
| 🔴 Critique | 2 |
| 🟠 Haute | 3 |
| 🟡 Moyenne | 4 |
| 🟢 Faible / Informatif | 5 |

---

## 🔴 Problèmes CRITIQUES

### C1 — Mise à jour de règles distantes sans vérification d'intégrité

**Fichier** : `background/background.js` — ligne 20, 246–267  
**Code concerné** :
```js
const REMOTE_RULES_URL = 'https://raw.githubusercontent.com/webflix-adblocker/rules/main/rules.json';
// ...
const remoteRules = await response.json();
if (!Array.isArray(remoteRules) || remoteRules.length === 0) throw new Error('Format invalide');
// Les règles sont appliquées directement sans aucune validation du contenu
await chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: existingIds,
  addRules: numberedRules
});
```

**Risque** : Si le dépôt GitHub `webflix-adblocker/rules` est compromis (prise de contrôle du compte, attaque de supply chain), un attaquant peut pousser des règles DNR malveillantes qui seront automatiquement téléchargées et appliquées sur le navigateur de tous les utilisateurs. Ces règles pourraient :
- Bloquer l'accès à des banques ou sites sensibles (`||paypal.com^`)
- Rediriger des requêtes vers un serveur contrôlé par l'attaquant
- Exfiltrer des informations de navigation

**Validation actuellement en place** : uniquement `Array.isArray()` et `length > 0` — totalement insuffisant.

**Recommandation** :
- Signer les règles avec une clé cryptographique (HMAC ou signature Ed25519) et vérifier la signature côté extension avant d'appliquer les règles.
- Ou, ne pas utiliser de règles distantes du tout et livrer les règles bundlées avec l'extension (mise à jour via le store).
- Ajouter un schéma de validation strict des règles (vérifier que les actions sont uniquement `block`, pas `redirect` vers des URL externes, etc.)

---

### C2 — `web_accessible_resources` expose `main_world.js` à toutes les origines

**Fichier** : `manifest.chrome.json` et `manifest.firefox.json` — lignes 80–89  
**Code concerné** :
```json
"web_accessible_resources": [
  {
    "resources": ["icons/*.png", "content/main_world.js"],
    "matches": ["<all_urls>"]
  }
]
```

**Risque** : `main_world.js` est accessible depuis **n'importe quel site web** via `chrome.runtime.getURL()`. Ce script modifie des prototypes natifs critiques (`Function.prototype.toString`, `HTMLElement.prototype.click`, `window.open`, `window.location.assign`). N'importe quelle page malveillante peut charger ce script dans un `<iframe>` ou via une balise `<script>`, injecter les modifications de prototype dans son propre contexte, et potentiellement exploiter ces détournements.

De plus, si une vulnérabilité XSS existe sur l'un des sites ciblés, l'attaquant peut charger ce script pour désactiver des protections (`window.__WFB_ENABLED = false`) ou exploiter les Map/fonctions internes.

**Recommandation** :
- Restreindre les `matches` de `web_accessible_resources` aux seuls domaines de streaming ciblés :
  ```json
  "matches": [
    "*://*.webflix.lol/*",
    "*://*.senpai-stream.quest/*",
    ...
  ]
  ```
- Les `icons/*.png` peuvent rester sur `<all_urls>`, mais `main_world.js` ne devrait jamais l'être.

---

## 🟠 Problèmes HAUTS

### H1 — Injection de domaines personnalisés sans validation suffisante

**Fichier** : `options/options.js` — lignes 44–83 / `background/background.js` — lignes 474–486  
**Code concerné** :
```js
// options.js
let val = domainInput.value.trim().toLowerCase();
// Nettoyage basique seulement
if (!val.includes('.')) {
  showToast('⚠️ Veuillez entrer un domaine valide.', true);
  return;
}
// Envoyé directement au SW
chrome.runtime.sendMessage({ type: 'ADD_CUSTOM_DOMAIN', domain: val }, resolve);

// background.js
const domain = message.domain;
// Aucune validation — domain est ajouté et utilisé tel quel
const matches = domains.map(d => `*://*.${d}/*`);
await chrome.scripting.registerContentScripts(scripts);
```

**Risque** : Un domaine mal formé (ex: `*.evil.com`, `evil.com/path`, ou une longue chaîne) pourrait causer des comportements inattendus avec `registerContentScripts`. Bien que l'impact soit limité au niveau de l'extension elle-même (pas d'exécution de code externe), une validation insuffisante est une surface d'attaque si le stockage `custom_domains` était manipulé par un autre vecteur.

**Recommandation** :
```js
// Validation stricte côté background.js
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/;
if (!DOMAIN_REGEX.test(domain)) {
  sendResponse({ ok: false, error: 'Domaine invalide' });
  return;
}
```

---

### H2 — XSS potentiel via `innerHTML` dans `popup.js`

**Fichier** : `popup/popup.js` — lignes 302–310  
**Code concerné** :
```js
historyList.innerHTML = entries.map(([domain, count]) => {
  const pct = Math.round((count / max) * 100);
  const shortDomain = domain.length > 24 ? domain.slice(0, 22) + '…' : domain;
  return `<div class="history-item">
    <span class="history-domain" title="${domain}">${shortDomain}</span>
    ...
  </div>`;
}).join('');
```

**Risque** : La variable `domain` provient de `chrome.storage.local` (`blockedHistory`). Si un nom de domaine malveillant contient du HTML (ex: `<img src=x onerror=alert(1)>`), il sera injecté directement dans le DOM via `innerHTML` sans échappement. En théorie, si un site parvient à enregistrer un nom de domaine comme clé dans `blockedHistory` contenant du HTML (via `incrementBlockedCount`), cela déclencherait un XSS dans le popup de l'extension (contexte privilegié).

**Recommandation** :
```js
// Utiliser textContent ou échapper le HTML
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Puis dans le template :
return `<div class="history-item">
  <span class="history-domain" title="${escapeHtml(domain)}">${escapeHtml(shortDomain)}</span>
  ...`;
```

---

### H3 — `__wfb_set_enabled__` peut être déclenché par n'importe quel script de la page

**Fichier** : `content/content.js` — ligne 56 / `main_world.js` — lignes 36–39  
**Code concerné** :
```js
// content.js — envoie via window.dispatchEvent
window.dispatchEvent(new CustomEvent('__wfb_set_enabled__', { detail: enabled }));

// main_world.js — écoute sans vérification de l'expéditeur
window.addEventListener('__wfb_set_enabled__', (e) => {
  window.__WFB_ENABLED = e.detail === true || e.detail === 'true';
});
```

**Risque** : N'importe quel script malveillant sur la page (pub, XSS tiers) peut déclencher `window.dispatchEvent(new CustomEvent('__wfb_set_enabled__', { detail: false }))` et **désactiver entièrement la protection** de l'extension dans le MAIN WORLD, sans que l'utilisateur le sache. L'extension semblerait active (le popup affiche "Protection active"), mais `main_world.js` aurait sa protection désactivée.

**Recommandation** : Utiliser un canal de communication plus sécurisé. Depuis `content.js` (ISOLATED), injecter directement la valeur dans `window.__WFB_ENABLED` via `chrome.scripting.executeScript` avec `world: 'MAIN'`, plutôt que de passer par un CustomEvent observable par la page.

Ou, à défaut, utiliser un secret partagé lors de l'initialisation :
```js
// Générer un token aléatoire au démarrage
const SECRET = crypto.randomUUID();
// Dispatcher avec le token
window.dispatchEvent(new CustomEvent('__wfb_set_enabled__', { detail: { enabled, secret: SECRET } }));
// Vérifier le token à la réception
window.addEventListener('__wfb_set_enabled__', (e) => {
  if (!e.detail || e.detail.secret !== SECRET) return; // Ignorer
  window.__WFB_ENABLED = e.detail.enabled === true;
});
```

---

## 🟡 Problèmes MOYENS

### M1 — Heuristique de timing côté Service Worker facilement exploitable

**Fichier** : `background/background.js` — lignes 361–370  
**Code concerné** :
```js
if (lastUserClickTime > 0) {
  const timeSinceClick = Date.now() - lastUserClickTime;
  if (timeSinceClick >= 0 && timeSinceClick < HEURISTIC_WINDOW_MS) {
    // Fermer l'onglet
  }
}
```

**Risque** : L'heuristique de 800ms après un clic est trop agressive. Si un utilisateur clique sur un lien légitime d'un site streaming qui ouvre un onglet sur un site non listé dans la whitelist, cet onglet sera fermé automatiquement. Plus problématique : le `USER_CLICK` est envoyé depuis le MAIN WORLD pour **tout clic** sur la page, sans distinguer si c'est sur un lien de navigation légitime ou une pub. Cela peut provoquer des fermetures intempestives d'onglets légitimes.

**Recommandation** : Affiner la source du signal `USER_CLICK` pour ne l'envoyer que lors de clics sur des liens identifiés comme publicitaires, pas sur tout clic de page.

---

### M2 — Absence de Content Security Policy (CSP) dans les pages HTML de l'extension

**Fichiers** : `popup/popup.html`, `options/options.html`  
**Détail** : Aucune balise `<meta http-equiv="Content-Security-Policy">` n'est définie dans les pages HTML de l'extension, ni dans le manifest.

**Risque** : Sans CSP, si une vulnérabilité XSS venait à être exploitée dans le popup ou les options, du JavaScript arbitraire pourrait s'exécuter dans le contexte privilégié de l'extension (accès à `chrome.storage`, `chrome.tabs`, `chrome.scripting`, etc.).

**Recommandation** : Ajouter au `<head>` de chaque page HTML :
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self';">
```
Note : La police Google Fonts est chargée depuis `fonts.googleapis.com`, ce qui doit être autorisé explicitement.

---

### M3 — Suppression agressive de DOM pouvant casser l'expérience utilisateur

**Fichier** : `content/content.js` — lignes 160–178  
**Code concerné** :
```js
document.querySelectorAll('style').forEach(style => {
  if (style.textContent.includes('adblock') || style.textContent.includes('adblocker')) {
    style.remove();
  }
});

document.querySelectorAll('div, section, aside, p').forEach(el => {
  const text = el.textContent.toLowerCase();
  if (keywords.some(k => text.includes(k)) && el.children.length < 5) {
    el.remove();
  }
});
```

**Risque** : Ces suppressions fonctionnent sur la base du contenu texte. Si un article légitime parle de "adblock" (ex: un article de blog expliquant ce qu'est un adblocker), ses éléments DOM seront supprimés. Cela peut constituer une **censure involontaire de contenu** non publicitaire.

**Recommandation** : Restreindre les suppressions aux sites ciblés uniquement (vérifier `location.hostname`), et ajouter des critères de positionnement CSS (ex: `position: fixed`, z-index élevé) pour cibler uniquement les overlays.

---

### M4 — `Function.prototype.toString` est modifié globalement dans le MAIN WORLD

**Fichier** : `main_world.js` — lignes 15–27  
**Code concerné** :
```js
Function.prototype.toString = function () {
  if (_nativeFnMap.has(this)) return _nativeFnMap.get(this);
  return _nativeToString.call(this);
};
```

**Risque** : Cette modification de prototype globale peut interférer avec d'autres scripts légitimes sur la page (frameworks JavaScript, bibliothèques de débogage, outils de monitoring). Bien que l'intention soit défensive (anti-détection), cette approche est fragile et peut provoquer des comportements inattendus sur certains sites.

**Recommandation** : Limiter au maximum les modifications de prototypes globaux. Documenter clairement que cette modification est intentionnelle et surveiller les rapports de bugs liés à des dysfonctionnements de sites.

---

## 🟢 Problèmes FAIBLES / Informatifs

### F1 — Fuite d'informations via `console.log` excessif

**Fichiers** : Tous les scripts  
**Détail** : De nombreux `console.log` exposent des informations détaillées sur le comportement interne de l'extension (URLs bloquées, états internes, noms de composants). Ces logs sont visibles dans les DevTools par n'importe quel utilisateur ou script de la page (`main_world.js` exécute dans le MAIN WORLD donc ses logs sont visibles).

**Recommandation** : En production, désactiver ou conditionner les logs à un flag de debug :
```js
const DEBUG = false;
function log(...args) { if (DEBUG) console.log(...args); }
```

---

### F2 — Duplication des listes de domaines

**Fichiers** : `background.js`, `content.js`, `main_world.js`, `popup.js`  
**Détail** : Les listes `AD_DOMAINS`, `WHITELIST_DOMAINS`, et `STREAMING_SITES` sont définies plusieurs fois dans des fichiers différents, avec des différences entre elles (ex: `main_world.js` contient `stake.com` et `playafterdark.com` mais pas `content.js`).

**Risque** : Ces incohérences peuvent créer des angles morts où un domaine est bloqué par un script mais pas par un autre, réduisant l'efficacité de la protection.

**Recommandation** : Centraliser ces listes dans un fichier unique `shared/constants.js` et l'importer partout (ou générer les listes à la compilation via le script `build.ps1`).

---

### F3 — `all_frames: true` et `match_about_blank: true` dans le manifest

**Fichier** : `manifest.chrome.json` — lignes 59–61  
**Détail** : Le script `content.js` est injecté dans **toutes les iframes** de toutes les pages listées, y compris les iframes `about:blank`. Cela inclut les iframes créées par des widgets tiers légitimes.

**Risque** : Faible, mais cela augmente la surface d'exécution du script et peut provoquer des erreurs dans des iframes qui ne sont pas des lecteurs vidéo.

---

### F4 — Pas de vérification de l'expéditeur dans `chrome.runtime.onMessage`

**Fichier** : `background/background.js` — ligne 403  
**Code concerné** :
```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // sender.tab et sender.url ne sont jamais vérifiés
  if (type === 'USER_CLICK') { ... }
  if (type === 'TOGGLE_PROTECTION') { ... }
```

**Risque** : N'importe quel content script de l'extension (y compris injecté dans une page compromise) peut envoyer des messages au Service Worker, y compris `TOGGLE_PROTECTION` avec `enabled: false`. Dans le modèle actuel, comme seul le popup devrait envoyer `TOGGLE_PROTECTION`, il serait prudent de vérifier `sender.url` ou `sender.id`.

**Recommandation** :
```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Pour les actions sensibles, vérifier que l'expéditeur est le popup/options (pas une page externe)
  if (type === 'TOGGLE_PROTECTION' && sender.tab) {
    // Seuls les messages sans tab (popup, options) devraient pouvoir toggle
    sendResponse({ ok: false, error: 'Non autorisé' });
    return false;
  }
  ...
});
```

---

### F5 — Chargement de polices depuis Google Fonts (vie privée)

**Fichiers** : `popup/popup.html`, `options/options.html`  
**Code concerné** :
```html
<link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet">
```

**Risque vie privée** : Chaque ouverture du popup envoie une requête à `fonts.googleapis.com`, permettant à Google de savoir qu'un utilisateur a ouvert l'extension. Pour une extension de protection de la vie privée, cela est paradoxal.

**Recommandation** : Télécharger et bundler la police Inter localement dans le dossier `fonts/` de l'extension, et la référencer via CSS `@font-face` local.

---

## ✅ Bonnes pratiques observées

- **Manifest V3** correctement utilisé avec `declarativeNetRequest` — approche moderne et plus sécurisée que MV2.
- **`'use strict'`** présent dans tous les fichiers JavaScript.
- **Séparation ISOLATED / MAIN WORLD** correctement mise en œuvre.
- **Validation des URLs** avec `new URL()` dans un bloc `try/catch` pour éviter les crashes.
- **Pas d'`eval()`** ni de `new Function()` utilisés.
- **Pas de `innerHTML` avec des données non contrôlées** dans `options.js` (utilise `textContent` pour les noms de domaines dans la liste).
- **`isTrusted`** vérifié pour les clics (`e.isTrusted`) dans `content.js`, ce qui aide à différencier les clics utilisateurs des clics programmatiques.
- **Timeout sur `sendMessageSafe`** dans `popup.js` pour éviter les blocages.
- **Guard `data.enabled !== false`** pour le comportement par défaut (actif si non défini).

---

## Tableau récapitulatif

| ID | Sévérité | Fichier | Description | Recommandation prioritaire |
|---|---|---|---|---|
| C1 | 🔴 Critique | `background.js:20,246` | Règles distantes sans vérification d'intégrité | Signer + valider les règles |
| C2 | 🔴 Critique | `manifest.*.json:80` | `main_world.js` accessible à toutes les origines | Restreindre `web_accessible_resources` |
| H1 | 🟠 Haute | `options.js:44`, `background.js:474` | Validation insuffisante des domaines custom | Regex stricte côté SW |
| H2 | 🟠 Haute | `popup.js:302` | XSS potentiel via `innerHTML` avec noms de domaines | Échapper les données avant injection HTML |
| H3 | 🟠 Haute | `content.js:56`, `main_world.js:36` | Flag de protection désactivable par la page | Utiliser un secret ou un canal sécurisé |
| M1 | 🟡 Moyenne | `background.js:361` | Heuristique de timing trop agressive | Affiner le signal USER_CLICK |
| M2 | 🟡 Moyenne | `popup.html`, `options.html` | Absence de CSP dans les pages de l'extension | Ajouter balise CSP |
| M3 | 🟡 Moyenne | `content.js:160` | Suppression agressive de DOM légitime | Cibler selon position CSS, pas seulement le texte |
| M4 | 🟡 Moyenne | `main_world.js:23` | Modification globale de `Function.prototype.toString` | Documenter, tester sur plus de sites |
| F1 | 🟢 Faible | Tous | Logs verbeux visibles dans DevTools | Conditionner via flag DEBUG |
| F2 | 🟢 Faible | Tous | Duplication et incohérence des listes de domaines | Centraliser dans un fichier partagé |
| F3 | 🟢 Faible | `manifest.*.json:59` | `all_frames + match_about_blank` sur tous les iframes | Évaluer la nécessité |
| F4 | 🟢 Faible | `background.js:403` | Pas de vérification de l'expéditeur des messages | Vérifier `sender.tab` pour actions sensibles |
| F5 | 🟢 Faible | `popup.html`, `options.html` | Police chargée depuis Google Fonts | Bundler la police localement |

---

## Priorités d'action recommandées

1. **Immédiat — C2** : Restreindre `web_accessible_resources` pour `main_world.js` aux seuls domaines ciblés.
2. **Immédiat — H2** : Échapper les données HTML dans `renderHistory()` de `popup.js`.
3. **Court terme — C1** : Ajouter une validation cryptographique ou un schéma strict pour les règles distantes.
4. **Court terme — H3** : Sécuriser le canal de communication `__wfb_set_enabled__` avec un secret.
5. **Court terme — M2** : Ajouter des Content Security Policies aux pages HTML de l'extension.
6. **Moyen terme — H1** : Ajouter une validation regex stricte des domaines custom dans le Service Worker.
7. **Moyen terme — F2** : Centraliser les listes de domaines pour éviter les incohérences.

---

*Rapport généré par analyse statique manuelle du code source. Aucune modification du code n'a été effectuée.*
