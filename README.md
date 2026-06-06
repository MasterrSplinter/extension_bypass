# Webflix AdBlocker Pro

Ce dépôt contient l'extension Webflix AdBlocker Pro, un bloqueur de publicités optimisé pour les sites de streaming. L'extension est déclinée en deux versions adaptées à chaque moteur de navigateur :
- Dossier `chrome` (pour Google Chrome, Edge, Brave, Kiwi Browser, etc.)
- Dossier `firefox` (pour Mozilla Firefox)

Voici le guide complet pour installer et utiliser l'extension de manière **permanente** sur tous vos appareils.

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
4. Sélectionnez le dossier `chrome` présent sur votre ordinateur.
5. L'extension est installée ! 

*(Astuce : Vous disposez aussi d'un script dans le dossier `chrome` pour lancer une fenêtre Chrome isolée et dédiée avec l'extension. Ouvrez un terminal dans ce dossier et tapez : `powershell.exe -ExecutionPolicy Bypass -File .\launch_with_extension.ps1`)*

### 🦊 Mozilla Firefox
Firefox possède des règles de sécurité très strictes qui interdisent l'installation permanente d'extensions non publiées sur leur boutique officielle, sur la version classique du navigateur.

**La méthode la plus simple (Automatique) :**
Nous avons créé un script qui s'occupe de **tout** à votre place. 
1. Ouvrez un terminal (PowerShell) dans le dossier `firefox`.
2. Tapez la commande suivante (elle permet de contourner la sécurité Windows qui bloque les scripts par défaut) :
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File .\build_and_install.ps1
   ```
3. Laissez le script travailler : il va télécharger et installer Firefox Nightly en arrière-plan (si vous ne l'avez pas), configurer les permissions secrètes automatiquement, puis lancer le navigateur avec l'extension prête à être validée.
4. Cliquez simplement sur **"Ajouter"** quand Firefox s'ouvrira !

**La méthode Manuelle (Si vous préférez le faire vous-même) :**
1. Téléchargez et installez manuellement **[Firefox Developer Edition](https://www.mozilla.org/fr/firefox/developer/)** ou Nightly.
2. Ouvrez ce navigateur, tapez `about:config` dans la barre d'adresse et acceptez l'avertissement.
3. Cherchez la ligne `xpinstall.signatures.required` et double-cliquez dessus pour la passer à **`false`**.
4. Compressez tout le *contenu* du dossier `firefox` dans un fichier `.zip`. 
5. Allez dans le menu des extensions (tapez `about:addons` dans la barre d'adresse), cliquez sur l'icône en forme d'**engrenage** (⚙️) en haut à droite, puis choisissez **"Installer un module depuis un fichier..."**.
6. Sélectionnez votre fichier `.zip`. L'extension est désormais installée de manière **définitive** !

**⚠️ Limitation Importante sur Firefox (Vidéos en 4K)**
Firefox ne supporte pas nativement le format vidéo H.265 (HEVC) pour des raisons de licences payantes. Par conséquent, **le "Lecteur 4K" de Webflix affichera une erreur de lecture (`METADATA_ERR`) sur Firefox**. 
👉 *Solution :* Utilisez simplement un lecteur HD classique dans la liste, ou utilisez la version Chrome/Edge de l'extension si vous souhaitez absolument regarder en 4K.

**Pour un test rapide (Temporaire, sur Firefox classique) :**
- Tapez `about:debugging` > Cliquez sur "Ce Firefox" > **Charger un module complémentaire temporaire** > Sélectionnez le fichier `manifest.json` présent dans le dossier `firefox`. *(Attention : l'extension disparaîtra dès que vous fermerez le navigateur).*

---

## 📱 2. Installation sur Smartphone & Tablette (Mobile)

*Avant de commencer : Sur mobile, il est impossible de sélectionner un dossier non compressé. Vous devez d'abord compresser le contenu du dossier `chrome` (de préférence) en un fichier `.zip` et l'envoyer sur votre téléphone.*

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

1. Téléchargez **Kiwi Browser** gratuitement sur le Google Play Store.
2. Téléchargez ou transférez le fichier `.zip` de la version `chrome` sur votre téléphone.
3. Ouvrez Kiwi Browser, appuyez sur les trois petits points `⋮` (en haut à droite) et sélectionnez **Extensions**.
4. Activez le **"Mode développeur"** (Developer mode).
5. Appuyez sur le bouton **"+ (from .zip/.crx/.user.js)"**.
6. Cherchez et sélectionnez votre fichier `.zip` dans la mémoire de votre téléphone.
7. L'extension est installée de manière permanente et protégera votre navigation !

*(Note pour Android : Lemur Browser et Yandex Browser permettent également l'installation d'extensions Chrome de la même manière).*
