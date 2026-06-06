const fs = require('fs');

function patchContentJs(path) {
    let content = fs.readFileSync(path, 'utf8');

    content = content.replace(
        /function removeAdElements\(\) \{\s*if \(!protectionEnabled\) return;/g,
        `function removeAdElements() {
      if (!protectionEnabled) return;
      // Ne pas exécuter la suppression générique d'éléments dans les lecteurs vidéo
      // car cela risque de supprimer des contrôles légitimes (ex: .loading-overlay)
      if (location.pathname.includes('player') || location.hostname.includes('player') || location.hostname.includes('fastflux') || location.hostname.includes('embed')) return;`
    );

    fs.writeFileSync(path, content);
}

patchContentJs('chrome/content/content.js');
patchContentJs('firefox/content/content.js');
console.log('Patched content.js');
