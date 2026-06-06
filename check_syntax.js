const fs = require('fs');
const esprima = require('esprima');

function validateAndFix(path) {
    let content = fs.readFileSync(path, 'utf8');
    try {
        esprima.parseScript(content);
        console.log(path, 'is VALID');
    } catch (e) {
        console.log(path, 'ERROR:', e.message);
    }
}

validateAndFix('chrome/content/content.js');
validateAndFix('chrome/content/main_world.js');
