export const PERMISSION_CONFIG_VERSION = '1.0.0';
export const CANONICAL_APP_ROLES = Object.freeze(['Administrateur','Coordonnateur','Installateur','Client-Admin','Client']);
export const PERMISSION_CAPABILITIES = Object.freeze(['visible','editable']);
export const EMPTY_PERMISSION_CONFIG = Object.freeze({ generalRule:null, roleRules:null, priorityStrategy:'deny-wins', conservativeDeny:true });
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);

function normalizeRule(value,path,errors){
  if(value===null||value===undefined)return null;
  if(!object(value)){errors[path]='Une règle objet ou null est attendue.';return null;}
  const unknown=Object.keys(value).filter(k=>!PERMISSION_CAPABILITIES.includes(k));
  if(unknown.length)errors[`${path}.${unknown[0]}`]='Propriété de permission inconnue.';
  const rule={visible:null,editable:null};
  for(const key of PERMISSION_CAPABILITIES){const v=own(value,key)?value[key]:null;if(v!==null&&typeof v!=='boolean')errors[`${path}.${key}`]='Choisissez Hériter, Autoriser ou Refuser.';else rule[key]=v;}
  return rule;
}

export function normalizePermissionConfig(candidate={},knownRoles=CANONICAL_APP_ROLES){
  const errors={},warnings=[];
  if(!object(candidate))return{valid:false,normalized:null,errors:{contract:'Objet PermissionConfig attendu.'},warnings,unknownRoles:[]};
  const allowed=['generalRule','roleRules','priorityStrategy','conservativeDeny'];
  const unknown=Object.keys(candidate).filter(k=>!allowed.includes(k));
  if(unknown.length)errors[unknown[0]]='Propriété PermissionConfig inconnue.';
  const generalRule=normalizeRule(own(candidate,'generalRule')?candidate.generalRule:null,'generalRule',errors);
  let roleRules=null;const unknownRoles=[];
  if(own(candidate,'roleRules')&&candidate.roleRules!==null){
    if(!object(candidate.roleRules))errors.roleRules='Un objet par rôle ou null est attendu.';
    else {roleRules={};for(const role of Object.keys(candidate.roleRules).sort((a,b)=>a.localeCompare(b,'fr-CA'))){roleRules[role]=normalizeRule(candidate.roleRules[role],`roleRules.${role}`,errors);if(!knownRoles.includes(role)){unknownRoles.push(role);warnings.push(`Rôle inconnu conservé dans le brouillon : ${role}.`);}}}
  }
  const strategy=own(candidate,'priorityStrategy')?candidate.priorityStrategy:'deny-wins';
  if(strategy!=='deny-wins')errors.priorityStrategy='La stratégie doit rester deny-wins.';
  const conservative=own(candidate,'conservativeDeny')?candidate.conservativeDeny:true;
  if(conservative!==true)errors.conservativeDeny='Le refus conservateur doit rester actif.';
  return{valid:Object.keys(errors).length===0,normalized:{generalRule,roleRules,priorityStrategy:'deny-wins',conservativeDeny:true},errors,warnings,unknownRoles};
}

export function permissionConfigFromField(field){
  const stored=object(field?.role_permissions)?field.role_permissions:{};
  const result=normalizePermissionConfig(stored);
  return result.valid?result.normalized:{...EMPTY_PERMISSION_CONFIG};
}
export function stablePermissionConfig(value){const r=normalizePermissionConfig(value);return r.valid?JSON.stringify(r.normalized):null;}
export function permissionConfigChanged(a,b){const left=stablePermissionConfig(a),right=stablePermissionConfig(b);return left!==null&&right!==null&&left!==right;}
export function permissionNoChange(a,b){return !permissionConfigChanged(a,b);}

export function permissionProtectionReasons(field){
  const name=String(field?.technicalName||field?.field_name||'').toLowerCase();const reasons=[];
  if(['id','support_id','created_at','updated_at','deleted_at','auth_user_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre'].includes(name))reasons.push('Champ système protégé');
  if(name.endsWith('_id'))reasons.push('Référence protégée');
  if(field?.primaryKey||field?.physical_is_primary_key)reasons.push('Clé primaire');
  if(field?.foreignKey||field?.physical_is_foreign_key)reasons.push('Clé étrangère');
  if(field?.generated||field?.physical_is_generated)reasons.push('Colonne générée');
  if(field?.physical?.identity||field?.physical_is_identity)reasons.push('Colonne identity');
  if(field?.system||field?.functionalType==='calculated'||field?.field_type==='calculated')reasons.push('Champ système ou calculé');
  if(field?.is_virtual||String(field?.id||'').startsWith('physical:'))reasons.push('Champ virtuel');
  if(field?.permission_configurable===false)reasons.push('Champ non configurable');
  return[...new Set(reasons)];
}

export function resolvePermissionSimulation({config,role,capability='visible',protectedField=false,serverAllowed=true}={}){
  const checked=normalizePermissionConfig(config);const reasons=[];
  if(!PERMISSION_CAPABILITIES.includes(capability)||!checked.valid)return{allowed:false,decision:'denied',inherited:false,reasonCodes:['invalid_configuration','conservative_deny'],effectiveRule:null};
  if(protectedField){reasons.push('physical_protection');return{allowed:false,decision:'denied',inherited:false,reasonCodes:reasons,effectiveRule:false};}
  if(serverAllowed!==true){reasons.push('server_denied');return{allowed:false,decision:'denied',inherited:false,reasonCodes:reasons,effectiveRule:false};}
  if(!CANONICAL_APP_ROLES.includes(role)){reasons.push('unknown_role','conservative_deny');return{allowed:false,decision:'denied',inherited:true,reasonCodes:reasons,effectiveRule:null};}
  const general=checked.normalized.generalRule?.[capability]??null;
  const specific=checked.normalized.roleRules?.[role]?.[capability]??null;
  if(general===false){reasons.push('general_deny_dominates');return{allowed:false,decision:'denied',inherited:false,reasonCodes:reasons,effectiveRule:false};}
  if(specific===false){reasons.push('role_deny_dominates');return{allowed:false,decision:'denied',inherited:false,reasonCodes:reasons,effectiveRule:false};}
  if(general===true||specific===true){reasons.push(specific===true?'role_allow':'general_allow','server_authority_required');return{allowed:true,decision:'allowed_simulation',inherited:false,reasonCodes:reasons,effectiveRule:true};}
  return{allowed:false,decision:'inherited',inherited:true,reasonCodes:['historical_inheritance','no_new_right'],effectiveRule:null};
}
export function permissionContradictions(config){const r=normalizePermissionConfig(config);if(!r.valid)return Object.keys(r.errors);const out=[];for(const [role,rule] of Object.entries(r.normalized.roleRules||{}))for(const capability of PERMISSION_CAPABILITIES)if(r.normalized.generalRule?.[capability]===false&&rule?.[capability]===true)out.push(`${role}.${capability}: general_deny_dominates`);return out;}
