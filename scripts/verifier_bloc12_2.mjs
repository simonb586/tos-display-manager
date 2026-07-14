import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'supabase/functions/invite-user/index.ts',
  'supabase/functions/manage-user/index.ts',
  'src/components/UserProvisioningPanel.jsx',
  'src/components/ColumnRelationMenu.jsx',
  'src/features/v12/bloc-12.css',
  'supabase/BLOC_12_FINAL.sql'
];

let failed = false;

for (const relative of required) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier manquant : ${relative}`);
    failed = true;
  } else {
    console.log(`✅ ${relative}`);
  }
}

const panel = fs.readFileSync(path.join(root, 'src/components/UserProvisioningPanel.jsx'), 'utf8');
for (const token of ['Supprimer l’utilisateur', 'Renvoyer', 'Désactiver', 'Réactiver']) {
  if (!panel.includes(token)) {
    console.error(`❌ Bouton absent : ${token}`);
    failed = true;
  }
}

const menu = fs.readFileSync(path.join(root, 'src/components/ColumnRelationMenu.jsx'), 'utf8');
for (const token of ['createPortal', 'column-relation-popover-portal', 'Afficher la donnée dans', 'Afficher et modifier dans']) {
  if (!menu.includes(token)) {
    console.error(`❌ Correctif menu absent : ${token}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log('');
console.log('✅ v0.12.2 vérifiée.');
