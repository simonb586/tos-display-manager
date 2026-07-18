param(
  [Parameter(Mandatory=$false)]
  [string]$Branch = "bloc-1-2-3-integration"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "TOS Display Manager v0.12.4 - Interface Terrain" -ForegroundColor Cyan
Write-Host ""

node scripts/installer_bloc12_4.mjs
if ($LASTEXITCODE -ne 0) { throw "Vérification locale échouée." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build de production échoué." }

git add .
git commit -m "Version 0.12.4 - Interface Terrain plein écran"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aucun nouveau commit à créer ou commit déjà présent." -ForegroundColor Yellow
}

git push origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Push Git échoué." }

Write-Host ""
Write-Host "✅ v0.12.4 compilée et poussée vers GitHub." -ForegroundColor Green
Write-Host "Ouvre Vercel > Deployments et promeus le nouveau Preview en production." -ForegroundColor Green
