param([string]$ProjectRef="cmdfomowtzrinywdsosy")
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
Set-Location $Root
node scripts/installer_bloc12_3.mjs
if($LASTEXITCODE-ne 0){throw "Vérification échouée."}
npx supabase@latest functions deploy invite-user --project-ref $ProjectRef --no-verify-jwt
if($LASTEXITCODE-ne 0){throw "Déploiement invite-user échoué."}
npx supabase@latest functions deploy manage-user --project-ref $ProjectRef --no-verify-jwt
if($LASTEXITCODE-ne 0){throw "Déploiement manage-user échoué."}
npm run build
if($LASTEXITCODE-ne 0){throw "Build échoué."}
git add .
git commit -m "Version 0.12.3 - Activation obligatoire des comptes"
git push origin bloc-1-2-3-integration
if($LASTEXITCODE-ne 0){throw "Push Git échoué."}
Write-Host "✅ v0.12.3 prête. Promouvoir ensuite le déploiement Vercel." -ForegroundColor Green
