import {downloadPhotoHistoryCsv,downloadPhotosZip} from '../../src/services/photoLibraryService';
import {normalizeFinalReportContext,generateFinalReportPdf,generateFinalReportExcel} from '../../src/services/finalReportService';
import JSZip from 'jszip';
window.mount=()=>{};
window.testApi=(file,name)=>{if(name==='getSignedDownloadUrl')return Promise.resolve('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');throw Error('Unexpected export fixture '+name);};
window.exportChecks=async rows=>{
 const blobs=[];URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:fixture';};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=()=>{};
 downloadPhotoHistoryCsv(rows,'CLIENT');const csv=await blobs.pop().text();
 const context=normalizeFinalReportContext({edt:{no_edt:'EDT-TEST'},campaign:{nom_campagne:'Rapport test'},client:{nom:'Client'},photos:rows,supports:rows});
 const pdf=await (await generateFinalReportPdf(context)).text();
 const excel=await generateFinalReportExcel(context,rows),workbook=await JSZip.loadAsync(excel);
 const xml=(await Promise.all(Object.values(workbook.files).filter(f=>!f.dir).map(f=>f.async('string')))).join('\n');
 await downloadPhotosZip(rows.slice(0,2),'CLIENT');const archive=await JSZip.loadAsync(await blobs.pop().arrayBuffer());
 return {csv:{bytes:csv.length,authorEmail:/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(csv)},xlsx:{bytes:excel.byteLength,authorEmail:/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(xml)},pdf:{bytes:pdf.length,authorEmail:/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(pdf)},zip:{files:Object.keys(archive.files),authorEmail:Object.keys(archive.files).some(n=>n.includes('@'))}};
};
