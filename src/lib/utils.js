import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export const normalize = (value = '') => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function strictMatches(row, query, columns){
  const q=normalize(query); if(!q) return true;
  return columns.some(c=>normalize(row[c]).includes(q));
}

const technicalColumnPattern = /(^id$|_id$|storage|bucket|rpc|rls|json|schema|migration|auth_|deleted_by|internal)/i;

export function isBusinessExportColumn(column) {
  const key=String(column?.key || column || '');
  if(['support_id','edt_id','campagne_id'].includes(key))return true;
  return !technicalColumnPattern.test(key);
}

export function normalizeExportColumns(columns, labels = {}) {
  return (columns || []).map(column => typeof column === 'string'
    ? { key:column, label:labels[column] || column }
    : column
  ).filter(isBusinessExportColumn);
}

export function exportDisplayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return 'Information disponible dans la fiche détaillée';
  return value;
}

export function professionalExportName(moduleName, extension, date = new Date()) {
  const clean=String(moduleName||'Export').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'');
  return `TOS_${clean}_${date.toISOString().slice(0,10)}.${extension}`;
}

export function downloadCSV(filename, rows, columns){
  const safe=normalizeExportColumns(columns);
  const esc=v=>'"'+String(exportDisplayValue(v)).replaceAll('"','""')+'"';
  const csv=[safe.map(column=>esc(column.label)).join(','),...rows.map(row=>safe.map(column=>esc(row[column.key])).join(','))].join('\n');
  const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}

export function createProfessionalWorkbook({ moduleName, rows, columns, labels={}, filters={}, sortState=null, exportType='Grille visible', user='' }) {
  const safe=normalizeExportColumns(columns,labels);
  const now=new Date();
  const filterText=Object.entries(filters).filter(([,value])=>value).map(([key,value])=>`${labels[key]||key}: ${value}`).join(' | ')||'Aucun';
  const title=`TOS Display Manager — ${moduleName}`;
  const headerRow=6;
  const aoa=[
    [title],
    [`Module : ${moduleName}`],
    [`Export produit le ${now.toLocaleString('fr-CA')}`],
    [`Filtres : ${filterText}`],
    [`Nombre de lignes : ${rows.length}`],
    safe.map(column=>column.label),
    ...rows.map(row=>safe.map(column=>exportDisplayValue(row[column.key])))
  ];
  const worksheet=XLSX.utils.aoa_to_sheet(aoa);
  if(safe.length>1)worksheet['!merges']=[{s:{r:0,c:0},e:{r:0,c:safe.length-1}}];
  worksheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:headerRow-1,c:0},e:{r:Math.max(headerRow,aoa.length-1),c:Math.max(0,safe.length-1)}})};
  worksheet['!freeze']={xSplit:0,ySplit:headerRow,topLeftCell:`A${headerRow+1}`,activePane:'bottomLeft',state:'frozen'};
  worksheet['!cols']=safe.map((column,index)=>{
    const longest=Math.max(column.label.length,...rows.slice(0,200).map(row=>String(exportDisplayValue(row[column.key])).length));
    return {wch:Math.max(12,Math.min(/comment|description|note/i.test(column.key)?55:32,longest+2))};
  });
  worksheet['!rows']=[{hpt:24},{hpt:18},{hpt:18},{hpt:30},{hpt:18},{hpt:24}];
  const range=XLSX.utils.decode_range(worksheet['!ref']);
  for(let c=0;c<safe.length;c+=1){
    const cell=worksheet[XLSX.utils.encode_cell({r:headerRow-1,c})];
    if(cell)cell.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'4C1D95'}},alignment:{wrapText:true}};
  }
  for(let r=headerRow;r<=range.e.r;r+=1)for(let c=0;c<safe.length;c+=1){
    const cell=worksheet[XLSX.utils.encode_cell({r,c})];
    if(cell)cell.s={alignment:{vertical:'top',wrapText:true}};
  }
  const info=XLSX.utils.aoa_to_sheet([
    ['Informations sur l’export','Valeur'],['Module',moduleName],['Utilisateur',user||'Utilisateur connecté'],
    ['Date',now.toLocaleString('fr-CA')],['Filtres',filterText],
    ['Classement',sortState?.column?`${labels[sortState.column]||sortState.column} — ${sortState.direction==='desc'?'Décroissant':'Croissant'}`:'Ordre d’affichage'],
    ['Nombre de lignes',rows.length],['Type d’export',exportType]
  ]);
  info['!cols']=[{wch:28},{wch:70}];
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,worksheet,'Données');
  XLSX.utils.book_append_sheet(workbook,info,'Informations sur l’export');
  return workbook;
}

export function downloadExcel(filename, rows, columns, options={}) {
  const workbook=createProfessionalWorkbook({
    moduleName:options.moduleName||'Données',rows,columns,labels:options.labels,
    filters:options.filters,sortState:options.sortState,exportType:options.exportType,user:options.user
  });
  XLSX.writeFile(workbook,filename);
}

export function createProfessionalPdf({ title, moduleName, rows, columns, labels={}, filters={} }) {
  const safe=normalizeExportColumns(columns,labels);
  const orientation=safe.length>6?'landscape':'portrait';
  const doc=new jsPDF({orientation,unit:'mm',format:'letter'});
  const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
  const margin=12,usable=pageWidth-margin*2;
  const columnWidth=usable/Math.max(1,safe.length);
  const lineHeight=3.3;
  const filterText=Object.entries(filters).filter(([,value])=>value).map(([key,value])=>`${labels[key]||key}: ${value}`).join(' | ')||'Aucun';
  let y=margin;
  function reportHeader(){
    doc.setFillColor(76,29,149);doc.rect(0,0,pageWidth,18,'F');
    doc.setTextColor(255,255,255);doc.setFontSize(13);doc.text('TOS Display Manager',margin,11);
    doc.setTextColor(15,23,42);doc.setFontSize(12);doc.text(title,margin,26);
    doc.setFontSize(8);doc.text(`Module : ${moduleName}  •  Export : ${new Date().toLocaleString('fr-CA')}  •  ${rows.length} enregistrement(s)`,margin,32);
    doc.text(doc.splitTextToSize(`Filtres : ${filterText}`,usable),margin,37);
    y=45;
  }
  function tableHeader(){
    doc.setFillColor(76,29,149);doc.rect(margin,y,usable,8,'F');doc.setTextColor(255,255,255);doc.setFontSize(safe.length>8?6:7);
    safe.forEach((column,index)=>doc.text(doc.splitTextToSize(column.label,columnWidth-2),margin+index*columnWidth+1,y+5));
    doc.setTextColor(15,23,42);y+=8;
  }
  function newPage(){doc.addPage();reportHeader();tableHeader();}
  reportHeader();tableHeader();
  rows.forEach(row=>{
    const cells=safe.map(column=>doc.splitTextToSize(String(exportDisplayValue(row[column.key])),columnWidth-2).slice(0,5));
    const height=Math.max(7,...cells.map(lines=>lines.length*lineHeight+2));
    if(y+height>pageHeight-margin-8)newPage();
    doc.setDrawColor(226,232,240);doc.rect(margin,y,usable,height);
    cells.forEach((lines,index)=>{if(index)doc.line(margin+index*columnWidth,y,margin+index*columnWidth,y+height);doc.text(lines,margin+index*columnWidth+1,y+4);});
    y+=height;
  });
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page+=1){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(100);doc.text(`Page ${page} sur ${pages}`,pageWidth-margin-24,pageHeight-6);}
  return doc;
}

export function downloadPDF(filename,title,rows,columns,options={}){
  createProfessionalPdf({title,moduleName:options.moduleName||title,rows,columns,labels:options.labels,filters:options.filters}).save(filename);
}

export function photoName(supportId, action='installation', index=1, date=new Date()){
  const dd=String(date.getDate()).padStart(2,'0'),mm=String(date.getMonth()+1).padStart(2,'0'),yyyy=date.getFullYear();
  return `${supportId}_${dd}${mm}${yyyy}_${normalize(action).replaceAll(' ','_')}_${String(index).padStart(2,'0')}.jpg`;
}
