import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mainPath = path.join(root, 'src', 'main.jsx');

if (!fs.existsSync(mainPath)) {
  console.error('❌ src/main.jsx introuvable. Lance ce script depuis la racine de tos-display-manager.');
  process.exit(1);
}

let source = fs.readFileSync(mainPath, 'utf8');
const backupPath = `${mainPath}.avant-sprint-7-2.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

const importComponent = "import CampaignsPanel from './components/CampaignsPanel';";
const importCss = "import './features/campaigns/sprint-7-2-campaigns.css';";

if (!source.includes(importComponent)) {
  const anchors = [
    "import WorkOrdersPanel from './components/WorkOrdersPanel';",
    "import AdminPanel from './components/AdminPanel';",
    "import TerrainApp from './components/TerrainApp';",
    "import { loadManyTables } from './services/dataService';"
  ];

  const anchor = anchors.find(value => source.includes(value));

  if (!anchor) {
    console.error('❌ Point d’insertion des imports introuvable dans src/main.jsx.');
    process.exit(1);
  }

  source = source.replace(
    anchor,
    `${anchor}\n${importComponent}\n${importCss}`
  );
}

if (!source.includes("active==='Campagnes et visuels'?<CampaignsPanel")) {
  const exactPatterns = [
    {
      from: ":active==='Bons de travail'?<WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>:<TableView name={active} dataStore={dataStore}/>",
      to: ":active==='Bons de travail'?<WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>:active==='Campagnes et visuels'?<CampaignsPanel role={role} session={session}/>:<TableView name={active} dataStore={dataStore}/>"
    },
    {
      from: ":active==='Recherche terrain'?<div className=\"dashboard\"><FieldSearch dataStore={dataStore}/></div>:<TableView name={active} dataStore={dataStore}/>",
      to: ":active==='Recherche terrain'?<div className=\"dashboard\"><FieldSearch dataStore={dataStore}/></div>:active==='Campagnes et visuels'?<CampaignsPanel role={role} session={session}/>:<TableView name={active} dataStore={dataStore}/>"
    }
  ];

  let patched = false;

  for (const pattern of exactPatterns) {
    if (source.includes(pattern.from)) {
      source = source.replace(pattern.from, pattern.to);
      patched = true;
      break;
    }
  }

  if (!patched) {
    const genericTable = /:<TableView name=\{active\} dataStore=\{dataStore\}\/>/;
    if (genericTable.test(source)) {
      source = source.replace(
        genericTable,
        ":active==='Campagnes et visuels'?<CampaignsPanel role={role} session={session}/>:<TableView name={active} dataStore={dataStore}/>"
      );
      patched = true;
    }
  }

  if (!patched) {
    console.error('❌ Route Campagnes introuvable. Le fichier original a été conservé.');
    process.exit(1);
  }
}

fs.writeFileSync(mainPath, source, 'utf8');
console.log('✅ Sprint 7.2 intégré dans src/main.jsx.');
console.log(`✅ Sauvegarde créée : ${backupPath}`);
