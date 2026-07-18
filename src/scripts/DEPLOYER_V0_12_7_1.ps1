param(
  [Parameter(Mandatory=$false)]
  [string]$Branch = "bloc-1-2-3-integration"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

node scripts/installer_bloc12_7_1.mjs
if ($LASTEXITCODE -ne 0) { throw "Vérification locale échouée." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build échoué." }

git add .
git commit -m "Version 0.12.7.1 - Correction chargement TDM"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aucun nouveau commit à créer ou commit déjà présent." -ForegroundColor Yellow
}

git push origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Push Git échoué." }

Write-Host ""
Write-Host "✅ v0.12.7.1 compilée et poussée vers GitHub." -ForegroundColor Green
