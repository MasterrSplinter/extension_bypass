const fs = require('fs');

function restoreSenpai(path) {
    let content = fs.readFileSync(path, 'utf8');

    content = content.replace(
        /if \(!e\.isTrusted\) \{\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*console\.log\('\[StreamBlocker\] Clic programmatique bloqu(?:é|.) vers :', target\.href\);\s*return;\s*\}/,
        `if (!e.isTrusted) {
        // Laissez passer l'auto-click sur senpai-stream (et webflix au cas où)
        if (location.hostname.includes('senpai-stream') || location.hostname.includes('webflix.lol')) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('[StreamBlocker] Clic programmatique bloqué vers :', target.href);
        return;
      }`
    );

    fs.writeFileSync(path, content);
}

restoreSenpai('chrome/content/content.js');
restoreSenpai('firefox/content/content.js');
console.log('Restored Senpai auto-click logic in content.js');
