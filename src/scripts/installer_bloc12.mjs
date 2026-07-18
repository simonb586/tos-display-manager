import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['src/main.jsx', ['ColumnRelationMenu', 'v0.12']],
  ['src/components/UserProvisioningPanel.jsx', [
    'Renvoyer',
    'Désactiver',
    'Supprimer',
    'Jamais connecté'
  ]],
  ['src/components/ColumnRelationMenu.jsx', [
    'Afficher la donnée dans',
    'Afficher et modifier dans',
    'Ajouter cette relation'
  ]],
  ['src/components/CampaignVisualManager.jsx', [
    'Modifier le visuel',
    'Supprimer'
  ]],
  ['src/services/userProvisioningService.js', [
    'manage-user',
    'listManagedUsers',
    'updateManagedUser'
  ]],
  ['supabase/functions/invite-user/index.ts', [
    'PUBLIC_SITE_URL',
    'localhost'
  ]],
  ['supabase/functions/manage-user/index.ts', [
    'resend_invite',
    'reset_password',
    'delete'
  ]],
  ['supabase/BLOC_12_FINAL.sql', [
    'diagnostic_bloc12',
    'delete_or_archive_campaign_visual'
  ]],
  ['src/features/v12/bloc-12.css', [
    'column-relation-popover',
    'user-v2-layout'
  ]]
];

let failed = false;

for (const [relative, tokens] of checks) {
  const file = path.join(root, relative);

  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier absent : ${relative}`);
    failed = true;
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');

  for (const token of tokens) {
    if (!content.includes(token)) {
      console.error(`❌ Élément absent dans ${relative} : ${token}`);
      failed = true;
    }
  }

  if (!failed) console.log(`✅ ${relative}`);
}

if (failed) process.exit(1);

console.log('');
console.log('✅ Bloc 12.1 STABLE installé correctement.');
console.log('');
console.log('Ordre suivant :');
console.log('1. Exécuter supabase/BLOC_12_FINAL.sql');
console.log('2. Exécuter scripts/deployer_bloc12_edge.ps1');
console.log('3. Vérifier Supabase Authentication > URL Configuration');
console.log('4. npm run build');
console.log('5. npm run dev');
