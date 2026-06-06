<p align="center">
  <img src="chrome/icons/icon128.png" alt="Streaming AdBlocker Pro Logo" width="128">
</p>

<h1 align="center">Streaming AdBlocker Pro</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Google%20Chrome-4285F4?style=for-the-badge&logo=GoogleChrome&logoColor=white" alt="Chrome">
  <img src="https://img.shields.io/badge/Mozilla%20Firefox-FF7139?style=for-the-badge&logo=MozillaFirefox&logoColor=white" alt="Firefox">
  <img src="https://img.shields.io/badge/Microsoft%20Edge-0078D7?style=for-the-badge&logo=MicrosoftEdge&logoColor=white" alt="Edge">
  <img src="https://img.shields.io/badge/Brave-FF1B2D?style=for-the-badge&logo=Brave&logoColor=white" alt="Brave">
  <br>
  <img src="https://img.shields.io/badge/License-MIT-success?style=flat-square" alt="License: MIT">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" alt="Version: 1.0.0">
</p>

> [!NOTE]
> **Statut du projet** : Actuellement, cette extension est conçue et optimisée pour bloquer les publicités sur la majorité des plateformes de streaming et lecteurs vidéo tiers.

> [!TIP]
> **Recommandation optimale** : Pour vous assurer de n'avoir **absolument aucune publicité** sur l'ensemble des lecteurs vidéo, nous vous recommandons fortement de coupler cette extension avec un bloqueur de publicités généraliste classique, tel que **uBlock Origin** ou **Adblock**.

Ce dépôt contient l'extension Streaming AdBlocker Pro et son code source unifié (`src/`). L'extension est déclinée en deux versions adaptées à chaque moteur de navigateur et compilée dans le dossier `dist/` :
- Dossier `dist/chrome` (pour Google Chrome, Edge, Brave, Kiwi Browser, etc.)
- Dossier `dist/firefox` (pour Mozilla Firefox)

> **Information aux développeurs :** Pour générer l'extension après une modification du code, exécutez le script `build.ps1` à la racine du projet.

---

## ✨ Fonctionnalités

- 🚫 **Blocage natif** : Intercepte et bloque les scripts publicitaires intrusifs avant même qu'ils ne se chargent.
- ⚡ **Ultra-léger** : Conçu pour ne pas ralentir votre navigateur, optimisant ainsi le temps de chargement de vos vidéos.
- 🕵️ **Contournement intelligent** : Évite la détection par les systèmes anti-adblock basiques.
- 📱 **Multi-plateformes** : Fonctionne sur ordinateur (Windows, Mac, Linux) ainsi que sur mobile (via des navigateurs compatibles comme Kiwi ou Orion).

---

## 💻 1. Installation sur Ordinateur (Desktop)

### 🔵 Google Chrome / Microsoft Edge / Brave
L'installation sur les navigateurs basés sur Chromium est très simple et l'extension restera active tant que vous ne supprimez pas le dossier.

1. Ouvrez votre navigateur et allez sur la page de gestion des extensions :
   - Chrome : `chrome://extensions/`
   - Edge : `edge://extensions/`
   - Brave : `brave://extensions/`
2. Activez le **"Mode développeur"** (souvent un interrupteur en haut à droite ou à gauche).
3. Cliquez sur le bouton **"Charger l'extension non empaquetée"** (Load unpacked).
4. Sélectionnez le dossier `dist/chrome` présent sur votre ordinateur.
5. L'extension est installée ! 

### 🦊 Mozilla Firefox
Firefox possède des règles de sécurité très strictes qui interdisent l'installation permanente d'extensions non publiées sur leur boutique officielle, sur la version classique du navigateur.

**La méthode Manuelle :**
1. Téléchargez et installez manuellement **[Firefox Developer Edition](https://www.mozilla.org/fr/firefox/developer/)** ou Nightly.
2. Ouvrez ce navigateur, tapez `about:config` dans la barre d'adresse et acceptez l'avertissement.
3. Cherchez la ligne `xpinstall.signatures.required` et double-cliquez dessus pour la passer à **`false`**.
4. Compressez tout le *contenu* du dossier `dist/firefox` dans un fichier `.zip`. 
5. Allez dans le menu des extensions (tapez `about:addons` dans la barre d'adresse), cliquez sur l'icône en forme d'**engrenage** (⚙️) en haut à droite, puis choisissez **"Installer un module depuis un fichier..."**.
6. Sélectionnez votre fichier `.zip`. L'extension est désormais installée de manière **définitive** !

> [!WARNING]
> **Limitation Importante sur Firefox (Vidéos en 4K)**
> Firefox ne supporte pas nativement le format vidéo H.265 (HEVC) pour des raisons de licences payantes. Par conséquent, **les lecteurs 4K (HEVC) afficheront une erreur de lecture (`METADATA_ERR`) sur Firefox**. 
> 👉 *Solution :* Utilisez simplement un lecteur HD classique dans la liste, ou utilisez la version Chrome/Edge de l'extension si vous souhaitez absolument regarder en 4K.

**Pour un test rapide (Temporaire, sur Firefox classique) :**
- Tapez `about:debugging` > Cliquez sur "Ce Firefox" > **Charger un module complémentaire temporaire** > Sélectionnez le fichier `manifest.json` présent dans le dossier `dist/firefox`. *(Attention : l'extension disparaîtra dès que vous fermerez le navigateur).*

---

## 📱 2. Installation sur Smartphone & Tablette (Mobile)

> [!IMPORTANT]
> **Avant de commencer :** Sur mobile, il est impossible de sélectionner un dossier non compressé. Vous devez d'abord compresser le contenu du dossier `dist/chrome` (de préférence) en un fichier `.zip` et l'envoyer sur votre téléphone.

### 🍏 iOS (iPhone & iPad) — Via Orion Browser
Apple bloque les extensions sur Safari mobile et Chrome iOS. Cependant, le navigateur **Orion Browser** (disponible gratuitement sur l'App Store) permet d'installer les extensions Chrome et Firefox sur iPhone !

1. Téléchargez le navigateur **Orion** sur l'App Store.
2. Enregistrez le fichier `.zip` de l'extension dans l'application **Fichiers** de votre iPhone.
3. Ouvrez Orion, appuyez sur les trois points `...` en bas pour ouvrir le menu, et allez dans **Réglages** (Settings).
4. Descendez jusqu'à la section **Extensions**.
5. Appuyez sur le bouton **`+`** (en haut à droite) et choisissez **"Install from File"** (Installer depuis un fichier).
6. Sélectionnez votre fichier `.zip`. L'extension s'installera et sera fonctionnelle.

### 🤖 Android — Via Kiwi Browser
Sur Android, Google Chrome mobile ne supporte pas les extensions. Le meilleur navigateur (le plus stable et compatible) pour utiliser de vraies extensions d'ordinateur sur mobile est **Kiwi Browser**.

1. Téléchargez **Kiwi Browser** gratuitement sur le Google Play Store, ou téléchargez l'APK de la dernière version officielle sur [le dépôt GitHub de Kiwi Browser](https://github.com/kiwibrowser/src.next/releases/tag/14310011181).
2. Téléchargez ou transférez le fichier `.zip` de la version `chrome` sur votre téléphone.
3. Ouvrez Kiwi Browser, appuyez sur les trois petits points `⋮` (en haut à droite) et sélectionnez **Extensions**.
4. Activez le **"Mode développeur"** (Developer mode).
5. Appuyez sur le bouton **"+ (from .zip/.crx/.user.js)"**.
6. Cherchez et sélectionnez votre fichier `.zip` dans la mémoire de votre téléphone.
7. L'extension est installée de manière permanente et protégera votre navigation !

> [!NOTE]
> *(Pour Android : Lemur Browser et Yandex Browser permettent également l'installation d'extensions Chrome de la même manière).*

---

## 🤝 Contribuer

Les contributions sont grandement appréciées ! Puisque l'objectif de ce projet est de s'étendre à d'autres plateformes de streaming, votre aide est la bienvenue.
Pour contribuer :
1. "Forkez" le projet.
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/NouvellePlateforme`).
3. Commitez vos changements (`git commit -m 'Ajout du support pour [Plateforme]'`).
4. Poussez vers la branche (`git push origin feature/NouvellePlateforme`).
5. Ouvrez une "Pull Request".

---

## ⚖️ Licence

Ce projet est distribué sous la licence MIT.
