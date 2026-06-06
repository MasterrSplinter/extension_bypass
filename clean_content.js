const fs = require('fs');

function cleanContentJs(path) {
    let content = fs.readFileSync(path, 'utf8');

    // Remove the Webflix neutralization from click listener
    content = content.replace(
        /if \(location\.hostname\.includes\('webflix\.lol'\)\) \{\s*const btn = e\.target\.closest\('button'\);\s*if \(btn && btn\.querySelector\('svg\.lucide-play'\)\) \{\s*console\.log\('\[StreamBlocker\] Webflix : Clic manuel sur Play neutralisé'\);\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*return;\s*\}\s*\}/g,
        ''
    );

    // Remove the Webflix neutralization from mousedown listener
    content = content.replace(
        /if \(location\.hostname\.includes\('webflix\.lol'\)\) \{\s*const btn = e\.target\.closest\('button'\);\s*if \(btn && btn\.querySelector\('svg\.lucide-play'\)\) \{\s*console\.log\('\[StreamBlocker\] Webflix : Mousedown manuel sur Play neutralisé'\);\s*e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*return;\s*\}\s*\}/g,
        ''
    );

    fs.writeFileSync(path, content);
}

cleanContentJs('chrome/content/content.js');
cleanContentJs('firefox/content/content.js');

console.log('Cleaned content.js');
