param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "TOS Display Manager - Déploiement Edge" -ForegroundColor Cyan
Write-Host "Cette procédure exige une autorisation Supabase dans le navigateur." -ForegroundColor Yellow
Write-Host ""

if (-not $ProjectRef) {
  $ProjectRef = Read-Host "Entre la référence du projet Supabase"
}

if (-not $ProjectRef) {
  throw "La référence du projet est obligatoire."
}

Write-Host "Connexion Supabase..." -ForegroundColor Cyan
npx supabase@latest login
if ($LASTEXITCODE -ne 0) { throw "Échec de la connexion Supabase." }

Write-Host "Liaison du projet..." -ForegroundColor Cyan
npx supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Échec de la liaison au projet." }

Write-Host "Déploiement de invite-user..." -ForegroundColor Cyan
npx supabase@latest functions deploy invite-user --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Échec du déploiement invite-user." }

if (Test-Path "supabase/functions/send-final-report/index.ts") {
  Write-Host "Déploiement de send-final-report..." -ForegroundColor Cyan
  npx supabase@latest functions deploy send-final-report --project-ref $ProjectRef --no-verify-jwt
  if ($LASTEXITCODE -ne 0) { throw "Échec du déploiement send-final-report." }
}

Write-Host ""
Write-Host "Déploiement Edge terminé." -ForegroundColor Green
Write-Host "Teste maintenant l'invitation d'un utilisateur depuis TOS Display Manager." -ForegroundColor Green
