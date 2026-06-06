# Ce script automatise l'installation de Firefox Nightly (si nécessaire),
# la configuration des permissions, la création du fichier .xpi et son installation.

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  Installation Automatique & Déploiement Firefox" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

$firefoxDir = $PSScriptRoot
$outputXpi = "$PSScriptRoot\webflix-adblocker.xpi"

# 1. Vérification / Installation de Firefox Nightly ou Developer
Write-Host "[1/4] Vérification du navigateur Firefox..." -ForegroundColor Yellow
$ffPaths = @(
    "C:\Program Files\Firefox Developer Edition\firefox.exe",
    "C:\Program Files\Firefox Nightly\firefox.exe"
)

$ffExecutable = $null
foreach ($path in $ffPaths) {
    if (Test-Path $path) {
        $ffExecutable = $path
        break
    }
}

if (-Not $ffExecutable) {
    Write-Host "  -> Firefox Nightly / Developer non détecté." -ForegroundColor Magenta
    Write-Host "  -> Téléchargement de Firefox Nightly en cours..." -ForegroundColor Cyan
    $installerPath = "$env:TEMP\FirefoxNightlySetup.exe"
    # Lien officiel Mozilla pour le dernier Nightly Windows 64-bit FR
    Invoke-WebRequest -Uri "https://download.mozilla.org/?product=firefox-nightly-latest-ssl&os=win64&lang=fr" -OutFile $installerPath
    
    Write-Host "  -> Installation silencieuse en cours (veuillez patienter)..." -ForegroundColor Cyan
    Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
    Remove-Item $installerPath -Force
    
    $ffExecutable = "C:\Program Files\Firefox Nightly\firefox.exe"
    Write-Host "✅ Firefox Nightly installé avec succès !" -ForegroundColor Green
    
    # Initialiser le profil en lançant Firefox en mode invisible pendant 3 secondes
    Write-Host "  -> Initialisation du profil Firefox..." -ForegroundColor Cyan
    Start-Process -FilePath $ffExecutable -ArgumentList "-headless" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Stop-Process -Name "firefox" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} else {
    Write-Host "✅ Navigateur compatible trouvé : $ffExecutable" -ForegroundColor Green
}
Write-Host ""

# 2. Configurer Firefox (Désactiver la vérification des signatures)
Write-Host "[2/4] Configuration du profil (Signatures)..." -ForegroundColor Yellow
$profilesPath = "$env:APPDATA\Mozilla\Firefox\Profiles"
$devProfiles = @()
if (Test-Path $profilesPath) {
    $devProfiles = Get-ChildItem -Path $profilesPath -Directory | Where-Object { $_.Name -match "dev-edition-default" -or $_.Name -match "nightly" -or $_.Name -match "default-nightly" }
}

if ($devProfiles.Count -gt 0) {
    foreach ($profile in $devProfiles) {
        $userJsPath = Join-Path $profile.FullName "user.js"
        Add-Content -Path $userJsPath -Value "`nuser_pref(`"xpinstall.signatures.required`", false);"
        Write-Host "  -> Signatures désactivées pour le profil : $($profile.Name)" -ForegroundColor Green
    }
    Write-Host "✅ Firefox configuré avec succès !" -ForegroundColor Green
} else {
    Write-Host "⚠️ Impossible de trouver le profil automatiquement." -ForegroundColor Red
}
Write-Host ""

# 3. Création du fichier .xpi
Write-Host "[3/4] Compression de l'extension..." -ForegroundColor Yellow
if (Test-Path $outputXpi) {
    Remove-Item $outputXpi -Force
}
$items = Get-ChildItem -Path $firefoxDir | Where-Object { $_.FullName -ne $outputXpi -and $_.Name -ne "build_and_install.ps1" -and $_.Name -ne "launch_firefox.ps1" }
Compress-Archive -Path $items.FullName -DestinationPath $outputXpi -Force
Write-Host "✅ Fichier webflix-adblocker.xpi généré avec succès !" -ForegroundColor Green
Write-Host ""

# 4. Lancement de Firefox avec le fichier .xpi
Write-Host "[4/4] Lancement et installation..." -ForegroundColor Yellow
Write-Host "Firefox va s'ouvrir. Cliquez sur 'Ajouter' quand la fenêtre apparaîtra." -ForegroundColor Cyan

if ($ffExecutable) {
    Start-Process -FilePath $ffExecutable -ArgumentList "`"$outputXpi`""
    Write-Host "✅ Commande envoyée à Firefox !" -ForegroundColor Green
} else {
    Write-Host "⚠️ Impossible de lancer Firefox." -ForegroundColor Red
}

Write-Host ""
Write-Host "Terminé. Appuyez sur Entrée pour quitter..."
Pause
