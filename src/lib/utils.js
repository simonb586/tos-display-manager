export const normalize = (value = '') => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();
export function strictMatches(row, query, columns){
  const q=normalize(query); if(!q) return true;
  return columns.some(c=>normalize(row[c]).includes(q));
}
export function downloadCSV(filename, rows, columns){
  const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=[columns.map(esc).join(','),...rows.map(r=>columns.map(c=>esc(r[c])).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
export function downloadExcel(filename, rows, columns){
  const normalizedRows=rows.map(row=>Object.fromEntries(columns.map(column=>[column,row[column]??''])));
  const worksheet=XLSX.utils.json_to_sheet(normalizedRows,{header:columns});
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,worksheet,'Données triées');
  XLSX.writeFile(workbook,filename);
}
export function downloadPDF(filename,title,rows,columns){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'letter'});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=12;
  let y=14;
  doc.setFontSize(14);
  doc.text(title,margin,y);
  y+=8;
  doc.setFontSize(7);
  rows.forEach((row,index)=>{
    const line=columns.map(column=>`${column}: ${String(row[column]??'')}`).join('  |  ');
    const wrapped=doc.splitTextToSize(`${index+1}. ${line}`,pageWidth-margin*2);
    if(y+wrapped.length*3.5>pageHeight-margin){
      doc.addPage();
      y=margin;
    }
    doc.text(wrapped,margin,y);
    y+=wrapped.length*3.5+2;
  });
  doc.save(filename);
}
export function photoName(supportId, action='installation', index=1, date=new Date()){
  const dd=String(date.getDate()).padStart(2,'0'); const mm=String(date.getMonth()+1).padStart(2,'0'); const yyyy=date.getFullYear();
  return `${supportId}_${dd}${mm}${yyyy}_${normalize(action).replaceAll(' ','_')}_${String(index).padStart(2,'0')}.jpg`;
}
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
