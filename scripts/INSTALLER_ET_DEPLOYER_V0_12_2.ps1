param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRef = "cmdfomowtzrinywdsosy",

  [Parameter(Mandatory=$false)]
  [string]$PublicSiteUrl = "https://portail.groupetos.com"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ""
Write-Host "TOS Display Manager v0.12.2 - Installation et déploiement complet" -ForegroundColor Cyan
Write-Host ""

if ($PublicSiteUrl -match "localhost|127\.0\.0\.1|0\.0\.0\.0") {
  throw "PUBLIC_SITE_URL ne peut pas contenir localhost."
}
if (-not $PublicSiteUrl.StartsWith("https://")) {
  throw "PUBLIC_SITE_URL doit commencer par https://"
}

Write-Host "1/8 - Vérification des fichiers..." -ForegroundColor Cyan
node scripts/verifier_bloc12_2.mjs
if ($LASTEXITCODE -ne 0) { throw "Vérification locale échouée." }

Write-Host "2/8 - Nettoyage du cache temporaire Supabase..." -ForegroundColor Cyan
$TempPath = Join-Path $ProjectRoot "supabase\.temp"
if (Test-Path $TempPath) {
  Remove-Item -Recurse -Force $TempPath
}

Write-Host "3/8 - Connexion Supabase..." -ForegroundColor Cyan
npx supabase@latest login
if ($LASTEXITCODE -ne 0) { throw "Connexion Supabase échouée." }

Write-Host "4/8 - Liaison au projet Supabase..." -ForegroundColor Cyan
npx supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $TempPath) {
    Remove-Item -Recurse -Force $TempPath
  }
  npx supabase@latest link --project-ref $ProjectRef --debug
  if ($LASTEXITCODE -ne 0) { throw "Liaison Supabase échouée." }
}

Write-Host "5/8 - Configuration de l'URL publique..." -ForegroundColor Cyan
npx supabase@latest secrets set PUBLIC_SITE_URL="$PublicSiteUrl" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Configuration PUBLIC_SITE_URL échouée." }

Write-Host "6/8 - Déploiement des fonctions Edge..." -ForegroundColor Cyan
npx supabase@latest functions deploy invite-user --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Déploiement invite-user échoué." }

npx supabase@latest functions deploy manage-user --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Déploiement manage-user échoué." }

if (Test-Path "supabase/functions/send-final-report/index.ts") {
  npx supabase@latest functions deploy send-final-report --project-ref $ProjectRef --no-verify-jwt
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "send-final-report n'a pas été déployée. Les invitations restent fonctionnelles."
  }
}

Write-Host "7/8 - Compilation de production..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build de production échoué." }

Write-Host "8/8 - Préparation Git..." -ForegroundColor Cyan
git add .
git commit -m "Version 0.12.2 - Gestion utilisateurs et menus relations corrigés"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Aucun nouveau commit à créer ou commit déjà présent." -ForegroundColor Yellow
}

git push origin bloc-1-2-3-integration
if ($LASTEXITCODE -ne 0) { throw "Push Git échoué." }

Write-Host ""
Write-Host "✅ v0.12.2 installée, fonctions Edge déployées, build réussi et Git poussé." -ForegroundColor Green
Write-Host "Ouvre maintenant Vercel > Deployments et promeus le nouveau Preview en production." -ForegroundColor Green
Write-Host ""
Write-Host "Supabase Auth doit aussi contenir :" -ForegroundColor Yellow
Write-Host "Site URL : $PublicSiteUrl" -ForegroundColor Yellow
Write-Host "Redirect URL : $PublicSiteUrl/**" -ForegroundColor Yellow
