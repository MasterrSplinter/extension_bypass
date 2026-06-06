# Récupérer le chemin du dossier contenant l'extension
$extensionPath = $PSScriptRoot

# Définition d'un chemin de profil PERSISTANT pour conserver vos données (cookies, historique, etc.)
# Ainsi, vous n'aurez plus à tout reconfigurer à chaque lancement.
$persistentProfilePath = "$PSScriptRoot\ChromeProfile"

# Lancement de Chrome avec ce répertoire dédié et l'extension chargée
# On utilise une seule chaîne de caractères pour éviter les problèmes de guillemets de PowerShell
$chromeArgs = "--user-data-dir=`"$persistentProfilePath`" --no-first-run --load-extension=`"$extensionPath`""

Start-Process "chrome.exe" -ArgumentList $chromeArgs

Write-Host "Instance Chrome lancée avec le profil persistant : $persistentProfilePath"
Write-Host "Extension chargée automatiquement depuis : $extensionPath"
