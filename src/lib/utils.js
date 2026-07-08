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
export function photoName(supportId, action='installation', index=1, date=new Date()){
  const dd=String(date.getDate()).padStart(2,'0'); const mm=String(date.getMonth()+1).padStart(2,'0'); const yyyy=date.getFullYear();
  return `${supportId}_${dd}${mm}${yyyy}_${normalize(action).replaceAll(' ','_')}_${String(index).padStart(2,'0')}.jpg`;
}
