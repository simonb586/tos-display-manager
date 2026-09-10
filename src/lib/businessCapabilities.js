// Canonical UI capabilities. View permissions and server-side client scope still apply.
// Preview uses the target user's role, never the administrator's session role.
export function businessCapabilities(role) {
 const admin=role==='Administrateur',staff=admin||role==='Coordonnateur',client=role==='Client'||role==='Client-Admin';
 return Object.freeze({manageCampaigns:staff,manageEdt:staff,manageReports:staff,manageWorkOrders:staff,manageOrganizations:admin,manageMembers:staff,createClientRequest:client,readOnly:!staff});
}
