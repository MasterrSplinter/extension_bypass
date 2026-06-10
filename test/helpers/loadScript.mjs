/**
 * Charge un script « classique » de l'extension (shared/*.js) dans un contexte vm
 * isolé et renvoie ses globales. Permet de tester les fonctions/listes sans
 * navigateur, sans modifier les fichiers source (qui restent des scripts injectés).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadSharedScripts(...relPaths) {
  // URL est nécessaire à matchers.js (WFB_hostnameFromUrl) — fourni par le contexte vm.
  const context = vm.createContext({ URL, console });
  for (const rel of relPaths) {
    const code = readFileSync(resolve(ROOT, 'src', rel), 'utf8');
    vm.runInContext(code, context, { filename: rel });
  }
  return context;
}
