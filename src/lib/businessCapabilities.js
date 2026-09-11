// Canonical UI capabilities. View permissions and server-side client scope still apply.
// Preview uses the target user's role, never the administrator's session role.
export function businessCapabilities(role) {
 const admin=role==='Administrateur',staff=admin||role==='Coordonnateur',client=role==='Client'||role==='Client-Admin';
 return Object.freeze({manageCampaigns:staff,manageEdt:staff,manageReports:staff,manageWorkOrders:staff,manageOrganizations:admin,manageMembers:staff,createClientRequest:client,readOnly:!staff});
}

export function canEditBusinessView(role, permission, view) {
 if (role === 'Administrateur') return true;
 if (role !== 'Client-Admin') return false;
 const views = permission?.visible_tables || [];
 return (views.includes('*') || views.some(value=>normalizeClientPortalViewKey(value)===normalizeClientPortalViewKey(view) || (resolveClientPortalView(value)?.id && resolveClientPortalView(value)?.id===resolveClientPortalView(view)?.id))) &&
   (permission?.capabilities?.[view]?.update === true || permission?.capabilities?.['*']?.update === true);
}
import {normalizeClientPortalViewKey,resolveClientPortalView} from './clientPortalViewRegistry.js';
