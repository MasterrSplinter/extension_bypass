/**
 * esbuild.config.mjs — Build l'extension pour Chrome et Firefox
 * 
 * Remplace le build.ps1 : bundle les fichiers JS avec les imports partagés,
 * copie les assets statiques (HTML, CSS, JSON, icons).
 */
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// ─── Configuration ──────────────────────────────────────────────────────────
const JS_ENTRY_POINTS = [
  'src/background/background.js',
  'src/content/content.js',
  'src/content/main_world/index.js',
  'src/content/player_cleaner.js',
  'src/popup/popup.js',
  'src/options/options.js',
];

// Fichiers statiques à copier tels quels
const STATIC_FILES = [
  { from: 'src/content/content.css', to: 'content/content.css' },
  { from: 'src/popup/popup.html',   to: 'popup/popup.html' },
  { from: 'src/options/options.html', to: 'options/options.html' },
];

const STATIC_DIRS = [
  { from: 'src/icons', to: 'icons' },
  { from: 'src/rules', to: 'rules' },
];

const TARGETS = ['chrome', 'firefox'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanDist() {
  for (const target of TARGETS) {
    const dir = resolve(__dirname, `dist/${target}`);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
}

function copyStaticFiles(target) {
  const outDir = resolve(__dirname, `dist/${target}`);

  // Copy static files
  for (const { from, to } of STATIC_FILES) {
    const dest = resolve(outDir, to);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(resolve(__dirname, from), dest);
  }

  // Copy static directories
  for (const { from, to } of STATIC_DIRS) {
    const src = resolve(__dirname, from);
    if (existsSync(src)) {
      cpSync(src, resolve(outDir, to), { recursive: true });
    }
  }

  // Copy the correct manifest
  const manifestSrc = resolve(__dirname, `src/manifest.${target}.json`);
  if (existsSync(manifestSrc)) {
    cpSync(manifestSrc, resolve(outDir, 'manifest.json'));
  }
}

function createZips() {
  for (const target of TARGETS) {
    const zipPath = resolve(__dirname, `dist/${target}.zip`);
    if (existsSync(zipPath)) rmSync(zipPath, { force: true });
    try {
      // Use PowerShell's Compress-Archive on Windows
      execSync(`powershell -Command "Compress-Archive -Path 'dist/${target}/*' -DestinationPath 'dist/${target}.zip' -Force"`, {
        cwd: __dirname,
        stdio: 'pipe'
      });
    } catch (e) {
      console.warn(`⚠️ Impossible de créer ${target}.zip :`, e.message);
    }
  }
}

// ─── Build ──────────────────────────────────────────────────────────────────

async function build() {
  const startTime = Date.now();
  console.log('🔨 Building Streaming AdBlocker Pro...\n');

  // 1. Clean dist
  cleanDist();

  // 2. Bundle JS pour chaque target
  for (const target of TARGETS) {
    const outDir = resolve(__dirname, `dist/${target}`);

    await esbuild.build({
      entryPoints: JS_ENTRY_POINTS,
      bundle: true,
      format: 'iife',
      // Pas de minification par défaut (plus facile à debug) — décommente pour production :
      // minify: true,
      sourcemap: false,
      outdir: outDir,
      // Préserver la structure des dossiers (background/, content/, popup/, options/)
      outbase: 'src',
      // Ne pas résoudre les APIs navigateur
      external: [],
      // Banner pour les fichiers IIFE
      // Pas besoin de banner — chaque fichier a déjà sa propre IIFE
      legalComments: 'none',
      logLevel: 'warning',
    });

    // Post-build: renommer content/main_world/index.js → content/main_world.js
    // Car le manifest référence "content/main_world.js" mais esbuild
    // preserve la structure des dossiers du source (main_world/index.js)
    const mwBundled = resolve(outDir, 'content/main_world/index.js');
    const mwTarget  = resolve(outDir, 'content/main_world.js');
    if (existsSync(mwBundled)) {
      renameSync(mwBundled, mwTarget);
      // Nettoyer le dossier vide
      rmSync(resolve(outDir, 'content/main_world'), { recursive: true, force: true });
    }

    // 3. Copy static files
    copyStaticFiles(target);

    console.log(`  ✅ ${target}/ — build OK`);
  }

  // 4. Create ZIPs
  createZips();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Build terminé en ${elapsed}s`);
  console.log('   dist/chrome/ + dist/chrome.zip');
  console.log('   dist/firefox/ + dist/firefox.zip');
}

build().catch((e) => {
  console.error('❌ Build échoué :', e);
  process.exit(1);
});
