export function photoFolder(photo) {
  const edt=photo.edt_number || photo.metadata?.edt_number;
  if(edt)return {key:`edt:${edt}`,label:edt};
  if(photo.edt_id)return {key:`edt-id:${photo.edt_id}`,label:`EDT ${photo.edt_id}`};
  const type=String(photo.type_photo||'').toLocaleLowerCase('fr');
  if(photo.inspection_id||type.includes('inspection'))return {key:'inspections',label:'Inspections'};
  if(photo.issue_id||type.includes('enjeu'))return {key:'issues',label:'Supports avec enjeux'};
  if(photo.metadata?.installation_sans_edt===true)return {key:'without-edt',label:'Installation sans EDT'};
  return {key:'other',label:'Autres photos'};
}
export function photoFolders(photos) {
  const folders=new Map(['inspections','issues','without-edt'].map((key,index)=>[key,{key,label:['Inspections','Supports avec enjeux','Installation sans EDT'][index],photos:[]} ]));
  for(const photo of photos){const folder=photoFolder(photo);if(!folders.has(folder.key))folders.set(folder.key,{...folder,photos:[]});folders.get(folder.key).photos.push(photo);}
  return [...folders.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr',{numeric:true}));
}
