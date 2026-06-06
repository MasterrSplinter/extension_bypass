# Définition d'un chemin temporaire unique pour cette session
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempProfilePath = "$env:TEMP\Chrome_Clean_$timestamp"

# Lancement de Chrome avec un répertoire de données utilisateur dédié
# --incognito : Lance en navigation privée
# --user-data-dir : Force Chrome à utiliser le dossier temporaire comme profil
# --no-first-run : Évite la configuration initiale
Start-Process "chrome.exe" -ArgumentList `
    "--user-data-dir=$tempProfilePath",
    "--incognito",
    "--no-first-run",
    "--disable-extensions",
    "--disable-default-apps"

Write-Host "Nouvelle instance Chrome lancée avec le profil : $tempProfilePath"