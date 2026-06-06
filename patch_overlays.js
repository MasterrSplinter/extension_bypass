const fs = require('fs');

function patchHideAdOverlays(path) {
    let content = fs.readFileSync(path, 'utf8');

    content = content.replace(
        /if \(!el\.querySelector\('video'\) && !el\.classList\.contains\('jwplayer'\)\) \{/,
        `// Ne pas supprimer le conteneur du lecteur vidéo lui-même ni le vrai bouton play
            const elId = (el.id || '').toLowerCase();
            const elClass = (el.className || '').toString().toLowerCase();
            const isPlayButton = elId.includes('play') || elClass.includes('play');
            
            if (!el.querySelector('video') && !el.classList.contains('jwplayer') && !isPlayButton) {`
    );

    fs.writeFileSync(path, content);
}

patchHideAdOverlays('chrome/content/main_world.js');
patchHideAdOverlays('firefox/content/main_world.js');
console.log('Patched main_world.js');
