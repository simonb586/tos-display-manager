import {supabase} from '../lib/supabaseClient';
async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;}
export const getPhotoInventoryCapabilities=()=>rpc('photo_inventory_capabilities');
export const listDisplayMovements=({support=null,edt=null,search='',sort='recent',cancelled=false,offset=0,limit=50}={})=>rpc('list_display_movements',{p_support:support||null,p_edt:edt||null,p_search:search,p_sort:sort,p_cancelled:cancelled,p_offset:offset,p_limit:limit});
export const readDisplayCurrentState=support=>rpc('display_current_state',{p_support:support});
export const cancelDisplayMovement=(movement,reason)=>rpc('cancel_display_movement',{p_history_id:Number(movement.history_id),p_kind:movement.movement_kind,p_reason:reason||null});
