import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(),'src','main.jsx');
if(!fs.existsSync(file)){console.error('❌ src/main.jsx introuvable.');process.exit(1);}
let source=fs.readFileSync(file,'utf8');
const backup=file+'.avant-bloc-7-3.bak';
if(!fs.existsSync(backup)) fs.copyFileSync(file,backup);

const imports=[
"import CampaignsPanel from './components/CampaignsPanel';",
"import RelationsStudio from './components/RelationsStudio';",
"import './features/v07/bloc-7-3.css';"
];
const anchorOptions=[
"import WorkOrdersPanel from './components/WorkOrdersPanel';",
"import AdminPanel from './components/AdminPanel';",
"import TerrainApp from './components/TerrainApp';",
"import { loadManyTables } from './services/dataService';"
];
const anchor=anchorOptions.find(x=>source.includes(x));
if(!anchor){console.error('❌ Import d’ancrage introuvable.');process.exit(1);}
for(const item of imports){
  if(!source.includes(item)) source=source.replace(anchor,anchor+'\n'+item);
}

source=source.replace(
"const items=['Tableau de bord','Connexion','Administration','Application terrain','Recherche terrain',...manifest.map(m=>m.name)];",
"const items=['Tableau de bord','Connexion','Administration','Studio des relations','Application terrain','Recherche terrain',...manifest.map(m=>m.name)];"
);
source=source.replace(
"const items=['Tableau de bord','Connexion','Application terrain','Recherche terrain',...manifest.map(m=>m.name)];",
"const items=['Tableau de bord','Connexion','Studio des relations','Application terrain','Recherche terrain',...manifest.map(m=>m.name)];"
);

if(!source.includes("active==='Studio des relations'?<RelationsStudio")){
  source=source.replace(
    /:<TableView name=\{active\} dataStore=\{dataStore\}\/>/,
    ":active==='Campagnes et visuels'?<CampaignsPanel role={role} session={session}/>:active==='Studio des relations'?<RelationsStudio role={role}/>:<TableView name={active} dataStore={dataStore}/>"
  );
}
source=source.replace(
"{it==='Tableau de bord'?'📊':it==='Connexion'?'🔐':it==='Administration'?'⚙️':",
"{it==='Tableau de bord'?'📊':it==='Connexion'?'🔐':it==='Administration'?'⚙️':it==='Studio des relations'?'🔗':"
);

fs.writeFileSync(file,source,'utf8');
console.log('✅ Bloc 7.3 intégré automatiquement.');
console.log('✅ Sauvegarde : '+backup);
