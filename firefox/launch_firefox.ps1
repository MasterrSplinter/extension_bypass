# Ce script utilise l'outil officiel de Mozilla (web-ext) pour lancer une instance Firefox
# dédiée au développement avec l'extension préchargée.
# PRÉREQUIS : Node.js doit être installé sur votre machine.

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Lancement de la version Firefox de Webflix AdBlocker Pro..." -ForegroundColor White
Write-Host "⚠️ Ce script nécessite Node.js (npx). Si une erreur s'affiche, vous " -ForegroundColor Yellow
Write-Host "devez soit installer Node.js, soit charger l'extension manuellement " -ForegroundColor Yellow
Write-Host "depuis la page 'about:debugging' dans Firefox." -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

# web-ext va automatiquement trouver Firefox et charger l'extension depuis ce dossier
# --source-dir pointe vers le dossier actuel (firefox)
npx web-ext run --source-dir $PSScriptRoot
