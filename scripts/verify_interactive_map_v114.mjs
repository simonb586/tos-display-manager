import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifySupportCoordinates, clusterMapPoints, filterMapPoints, getSupportCoordinates, prepareMapInfrastructureRows } from '../src/services/mapService.js';

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};
const component=fs.readFileSync('src/components/InteractiveMap.jsx','utf8');
const main=fs.readFileSync('src/main.jsx','utf8');
const css=fs.readFileSync('src/features/v08/bloc-8-map.css','utf8');

ok(main.includes("active === 'Carte interactive'")&&main.includes('<InteractiveMap'),'Route carte absente');
ok(component.includes("from 'react-leaflet'")&&component.includes('OpenStreetMap'),'Fournisseur cartographique incorrect');
for(const token of ['MapContainer','TileLayer','CircleMarker','clusterMapPoints','MapStateBridge','renderedPoints','map-legend','map-detail-actions'])ok(component.includes(token),`Carte incomplète: ${token}`);
for(const token of ['client','campaign','edt','supportType','status','installer','zone','issueOnly','inspectionOnly','photo'])ok(component.includes(token),`Filtre absent: ${token}`);
for(const token of ['Ouvrir / Fiche 360','Photos','EDT / Travaux','Historique'])ok(component.includes(token),`Navigation absente: ${token}`);
for(const token of ['45.5017, -73.5673','DEFAULT_ZOOM = 10','map-empty-notice','Infrastructures non encore géolocalisées','Sans coordonnées','ne possède pas encore de localisation GPS'])ok(component.includes(token),`État sans coordonnées incomplet: ${token}`);
ok(css.includes('.map-empty-notice')&&css.includes('pointer-events:none'),'Panneau vide bloquant');
ok(css.includes('@media(max-width:760px)'),'Responsive absent');
ok(css.includes(':focus-visible'),'Focus accessible absent');

assert.deepEqual(getSupportCoordinates({latitude:'45,5',longitude:'-73.6'}),{latitude:45.5,longitude:-73.6});checks+=1;
assert.equal(getSupportCoordinates({latitude:91,longitude:-73}),null);checks+=1;
assert.equal(classifySupportCoordinates({support_id:'A'}).status,'missing');checks+=1;
assert.equal(classifySupportCoordinates({support_id:'A',latitude:'abc',longitude:'x'}).status,'invalid');checks+=1;
const prepared=prepareMapInfrastructureRows([
  {support_id:'A',latitude:45.5,longitude:-73.6,client:'TOS',statut:'Actif'},
  {support_id:'A',latitude:45.5,longitude:-73.6},
  {support_id:'B'},
  {support_id:'C',latitude:400,longitude:1}
]);
assert.equal(prepared.points.length,1);checks+=1;
assert.deepEqual(prepared.counters,{total:4,displayable:1,missing:1,invalid:1,duplicates:1});checks+=1;
assert.equal(filterMapPoints(prepared.points,{client:'TOS'}).length,1);checks+=1;
assert.equal(filterMapPoints(prepared.points,{status:'Inactif'}).length,0);checks+=1;
const empty=prepareMapInfrastructureRows([]);assert.deepEqual(empty,{points:[],counters:{total:0,displayable:0,missing:0,invalid:0,duplicates:0}});checks+=1;
const many=Array.from({length:10000},(_,index)=>({mapKey:String(index),supportId:String(index),latitude:45+(index%100)/1000,longitude:-73-(index%100)/1000}));
ok(clusterMapPoints(many,8).length<many.length,'Clustering inefficace');
assert.equal(clusterMapPoints(many,16).length,many.length);checks+=1;

console.log(`Carte interactive V1.1.4 : ${checks} contrôles réussis.`);
