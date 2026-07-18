param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRef,

  [Parameter(Mandatory=$false)]
  [string]$PublicSiteUrl = "https://portail.groupetos.com"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "TOS Display Manager v0.12 - Déploiement Edge" -ForegroundColor Cyan
Write-Host ""

if (-not $ProjectRef) {
  $ProjectRef = Read-Host "Référence du projet Supabase"
}

if (-not $PublicSiteUrl) {
  $PublicSiteUrl = Read-Host "URL publique du portail"
}

if ($PublicSiteUrl -match "localhost|127\.0\.0\.1|0\.0\.0\.0") {
  throw "L'URL publique ne peut pas contenir localhost."
}

if (-not $PublicSiteUrl.StartsWith("https://")) {
  throw "L'URL publique doit commencer par https://"
}

Write-Host "Connexion Supabase..." -ForegroundColor Cyan
npx supabase@latest login
if ($LASTEXITCODE -ne 0) { throw "Connexion Supabase échouée." }

Write-Host "Liaison du projet..." -ForegroundColor Cyan
npx supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Liaison Supabase échouée." }

Write-Host "Configuration de PUBLIC_SITE_URL..." -ForegroundColor Cyan
npx supabase@latest secrets set PUBLIC_SITE_URL="$PublicSiteUrl" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Configuration du secret PUBLIC_SITE_URL échouée." }

Write-Host "Déploiement invite-user..." -ForegroundColor Cyan
npx supabase@latest functions deploy invite-user --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Déploiement invite-user échoué." }

Write-Host "Déploiement manage-user..." -ForegroundColor Cyan
npx supabase@latest functions deploy manage-user --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Déploiement manage-user échoué." }

if (Test-Path "supabase/functions/send-final-report/index.ts") {
  Write-Host "Redéploiement send-final-report..." -ForegroundColor Cyan
  npx supabase@latest functions deploy send-final-report --project-ref $ProjectRef --no-verify-jwt
  if ($LASTEXITCODE -ne 0) { throw "Déploiement send-final-report échoué." }
}

Write-Host ""
Write-Host "Fonctions Edge Bloc 12 déployées." -ForegroundColor Green
Write-Host "PUBLIC_SITE_URL = $PublicSiteUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Dans Supabase Authentication > URL Configuration, vérifie aussi :" -ForegroundColor Yellow
Write-Host "Site URL : $PublicSiteUrl" -ForegroundColor Yellow
Write-Host "Redirect URL : $PublicSiteUrl/**" -ForegroundColor Yellow
