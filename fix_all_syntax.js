const fs = require('fs');

function fixContentJs(path) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(
        /if \(location\.hostname\.includes\('senpai-stream'\) && e\.target\.closest\('\[wire\\\\:click\]'\)\) \{\s*if \(isAdUrl\(target\.href\)\) \{/,
        "if (location.hostname.includes('senpai-stream') && e.target.closest('[wire\\\\:click]')) { return; }\n        if (isAdUrl(target.href)) {"
    );
    fs.writeFileSync(path, content);
}

function fixMainWorldJs(path) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(
        /\} else if \(senpaiFallbackAttempts > 0\) \{\s*\/\/ Le bouton continuer a disparu et pas de play \(Livewire update en cours\)\s*\}\s*\}/,
        "} else if (senpaiFallbackAttempts > 0) {\n        // Le bouton continuer a disparu et pas de play (Livewire update en cours)\n      }\n    }\n  }"
    );
    fs.writeFileSync(path, content);
}

fixContentJs('chrome/content/content.js');
fixContentJs('firefox/content/content.js');
fixMainWorldJs('chrome/content/main_world.js');
fixMainWorldJs('firefox/content/main_world.js');

console.log('Fixed syntax errors in both files.');
