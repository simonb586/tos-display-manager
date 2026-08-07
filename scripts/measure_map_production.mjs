import pg from 'pg';
import {clusterMapPoints,prepareMapInfrastructureRows} from '../src/services/mapService.js';
const {Client}=pg;const client=new Client({host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),user:process.env.PGUSER,password:process.env.PGPASSWORD,database:process.env.PGDATABASE||'postgres',ssl:{rejectUnauthorized:false}});
await client.connect();
try{
  await client.query('set role postgres');await client.query('begin read only');
  const started=performance.now();
  const {rows}=await client.query('select support_id,latitude,longitude,coordonnees_gps,lien_carte_interactive,type_support,format_affichage,emplacement_visibilite,site,enjeux,type_enjeux,actif,campagne_actuelle,campagne_selon_visuel,visuel_campagne,visuel_en_expo,edt_associe,photo_miniature_url,photo_principale_url,visuel_actuel_cadre,updated_at,raw_data from public.infrastructures');
  const keyResult=await client.query("select distinct key from public.infrastructures cross join lateral jsonb_object_keys(raw_data) key where lower(key) ~ '(coord|gps|latitude|longitude|carte|map)' order by key");
  const elapsedMs=Math.round((performance.now()-started)*10)/10;
  const prepared=prepareMapInfrastructureRows(rows);
  const clusters={zoom5:clusterMapPoints(prepared.points,5).length,zoom8:clusterMapPoints(prepared.points,8).length,zoom12:clusterMapPoints(prepared.points,12).length,zoom16:clusterMapPoints(prepared.points,16).length};
  console.log(JSON.stringify({rows:rows.length,counters:prepared.counters,clusters,coordinateMetadataKeys:keyResult.rows.map(row=>row.key),mapLinks:rows.filter(row=>String(row.lien_carte_interactive||'').trim()).length,queryMs:elapsedMs}));
  await client.query('rollback');
}catch(error){try{await client.query('rollback')}catch{}throw error}finally{await client.end()}
