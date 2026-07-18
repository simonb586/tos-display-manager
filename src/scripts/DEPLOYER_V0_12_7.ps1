param([string]$Branch='bloc-1-2-3-integration')
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location $Root
node scripts/installer_bloc12_7.mjs
npm run build
git add .
git commit -m 'Version 0.12.7 - Synchronisation terrain vérifiée'
git push origin $Branch
