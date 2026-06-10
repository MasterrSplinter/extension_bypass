# Nettoyer les anciens dossiers
if (Test-Path -Path dist\chrome) { Remove-Item -Recurse -Force dist\chrome }
if (Test-Path -Path dist\firefox) { Remove-Item -Recurse -Force dist\firefox }

# Créer les nouveaux dossiers
New-Item -ItemType Directory -Force -Path dist\chrome | Out-Null
New-Item -ItemType Directory -Force -Path dist\firefox | Out-Null

# Liste des dossiers à copier
$foldersToCopy = @("background", "content", "icons", "options", "popup", "rules", "shared")

foreach ($folder in $foldersToCopy) {
    if (Test-Path -Path "src\$folder") {
        Copy-Item -Path "src\$folder" -Destination "dist\chrome\$folder" -Recurse
        Copy-Item -Path "src\$folder" -Destination "dist\firefox\$folder" -Recurse
    }
}

# Copier et renommer les manifestes
if (Test-Path -Path "src\manifest.chrome.json") {
    Copy-Item -Path "src\manifest.chrome.json" -Destination "dist\chrome\manifest.json"
}

if (Test-Path -Path "src\manifest.firefox.json") {
    Copy-Item -Path "src\manifest.firefox.json" -Destination "dist\firefox\manifest.json"
}

# Zipper les extensions pour l'installation sur mobile ou manuelle
if (Test-Path -Path dist\chrome.zip) { Remove-Item -Force dist\chrome.zip }
if (Test-Path -Path dist\firefox.zip) { Remove-Item -Force dist\firefox.zip }

Compress-Archive -Path "dist\chrome\*" -DestinationPath "dist\chrome.zip" -Force
Compress-Archive -Path "dist\firefox\*" -DestinationPath "dist\firefox.zip" -Force

Write-Host "Build terminé ! Les extensions sont disponibles dans dist/chrome et dist/firefox" -ForegroundColor Green
Write-Host "Les archives ZIP sont disponibles dans dist/chrome.zip et dist/firefox.zip" -ForegroundColor Green
