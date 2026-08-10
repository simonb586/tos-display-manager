import assert from'node:assert/strict';
import fs from'node:fs';
import{assignmentColumnProfile,assignmentColumnWidth}from'../src/lib/gridPresentation.js';

const read=file=>fs.readFileSync(file,'utf8');
const view=read('src/components/SiteSupportAssignmentsView.jsx');
const header=read('src/components/GridColumnHeader.jsx');
const css=read('src/styles.css');

const compact=assignmentColumnProfile('statut','Statut');
const wide=assignmentColumnProfile('message','Communication');
const long=assignmentColumnProfile('raw_data','Données source');
assert.ok(compact.maxWidth<wide.maxWidth&&wide.maxWidth<=long.maxWidth,'Profils compact, large et texte long distincts');
for(const [key,label] of [['id','ID'],['support_id','Support'],['message','Communication'],['raw_data','Données source']]){
 const profile=assignmentColumnProfile(key,label),width=assignmentColumnWidth([{[key]:'x'.repeat(1000)}],key,label);
 assert.ok(width>=profile.minWidth&&width<=profile.maxWidth,`${key}: largeur bornée`);
}
assert.ok(view.includes('.slice(0, 50)')||read('src/lib/gridPresentation.js').includes('.slice(0, 50)'),'Échantillon limité');
for(const marker of['preferredWidth={widths[key]||assignmentColumnWidth','localStorage.setItem(storageKey','localStorage.removeItem(storageKey)',"operational?'operational':'campaign'",'assignment-status','title={value}','GridPagination','filterValue={filters[key]}','assignment-grid-wrap'])assert.ok(view.includes(marker),marker);
assert.ok(header.includes('preferredWidth||adaptiveColumnWidth'),'Moteur partagé par les en-têtes');
for(const marker of['table-layout:fixed','overflow-x:auto','text-overflow:ellipsis','-webkit-line-clamp:2','@media(max-width:1024px)','@media(max-width:760px)','@media(max-width:480px)','position:sticky'])assert.ok(css.includes(marker),marker);
assert.ok(css.includes('.assignment-page{')&&css.includes('max-width:none'),'Page utilise la largeur disponible');
assert.ok(css.includes('.assignment-actions{')&&css.includes('max-width:240px'),'Actions compactes');
console.log('V1.2.3: moteur de largeurs, persistance, lisibilité, responsive et fonctions de grille validés.');
