#!/usr/bin/env bash
#
# build.sh — équivalent cross-platform de build.ps1 (Linux / macOS).
# Génère dist/chrome, dist/firefox et leurs archives .zip.
#
set -euo pipefail
cd "$(dirname "$0")"

FOLDERS=(background content icons options popup rules shared)

echo "🧹 Nettoyage de dist/…"
rm -rf dist/chrome dist/firefox dist/chrome.zip dist/firefox.zip
mkdir -p dist/chrome dist/firefox

echo "📦 Copie des sources…"
for folder in "${FOLDERS[@]}"; do
  if [ -d "src/$folder" ]; then
    cp -R "src/$folder" "dist/chrome/$folder"
    cp -R "src/$folder" "dist/firefox/$folder"
  fi
done

cp src/manifest.chrome.json  dist/chrome/manifest.json
cp src/manifest.firefox.json dist/firefox/manifest.json

if command -v zip >/dev/null 2>&1; then
  echo "🗜️  Création des archives ZIP…"
  ( cd dist/chrome  && zip -qr ../chrome.zip  . )
  ( cd dist/firefox && zip -qr ../firefox.zip . )
  echo "   → dist/chrome.zip et dist/firefox.zip"
else
  echo "⚠️  'zip' introuvable : archives non créées (dossiers dist/ prêts)."
fi

echo "✅ Build terminé : dist/chrome et dist/firefox"
