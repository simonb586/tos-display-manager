import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', [
    "import ProductionLogin from './components/ProductionLogin';",
    "if (!supabaseConfigured) return <SupabaseConfigurationError/>;",
    "if (!session) return <ProductionLogin/>;"
  ]],
  ['src/components/ProductionLogin.jsx', ['Connexion sécurisée']],
  ['src/services/authProfileService.js', ['getCurrentProfile']],
  ['src/features/production/bloc-7-5-production.css', ['production-login-page']],
  ['vercel.json', []]
];

let failed = false;

for (const [relative, required] of checks) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier absent : ${relative}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const token of required) {
    if (!content.includes(token)) {
      console.error(`❌ Élément absent dans ${relative} : ${token}`);
      failed = true;
    }
  }
  if (!failed) console.log(`✅ ${relative}`);
}

if (failed) process.exit(1);
console.log('✅ Bloc 7.5 FINAL installé correctement.');
