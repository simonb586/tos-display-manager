import {AuthorizationError, requireCanonicalUser} from './canonicalUser.ts';

export async function requireReportActor(admin: any, userClient: any) {
  const {data, error} = await userClient.auth.getUser();
  if (error || !data.user) throw new AuthorizationError('authentication_required');
  const actor = await requireCanonicalUser(admin, data.user, ['Administrateur', 'Coordonnateur']);
  if (actor.client_id === null && actor.role !== 'Administrateur') {
    throw new AuthorizationError('report_client_required');
  }
  return actor;
}

export async function requireReportEdt(admin: any, edtId: unknown, actor: any = null) {
  const id = Number(edtId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AuthorizationError('edt_required');
  const {data: edt, error} = await admin.from('suivi_des_edt')
    .select('id,no_edt,client_id,campagne_id').eq('id', id).maybeSingle();
  if (error || !edt || !Number.isSafeInteger(edt.client_id) || edt.client_id <= 0) {
    throw new AuthorizationError('edt_scope_denied');
  }
  const {data: client, error: clientError} = await admin.from('clients').select('id').eq('id', edt.client_id).maybeSingle();
  if (clientError || !client) throw new AuthorizationError('edt_client_invalid');
  if (edt.campagne_id !== null) {
    const {data: campaign, error: campaignError} = await admin.from('campagnes_maitres')
      .select('id,client_id').eq('id', edt.campagne_id).maybeSingle();
    if (campaignError || !campaign || campaign.client_id !== edt.client_id) {
      throw new AuthorizationError('edt_campaign_mismatch');
    }
  }
  if (actor && !(actor.role === 'Administrateur' && actor.client_id === null) && actor.client_id !== edt.client_id) {
    throw new AuthorizationError('cross_client_denied');
  }
  return edt;
}

// A path is resolved from a persisted report and must belong to this exact EDT.
export function requireReportPath(report: any, edt: any) {
  const path = report?.report_path;
  const prefix = String(edt.no_edt || edt.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  if ((report.storage_bucket || 'final-reports') !== 'final-reports' || typeof path !== 'string' ||
      !path.startsWith(prefix + '/') || /(^|\/)\.{1,2}(\/|$)|\/\/|[?#%]/.test(path) || !/\.pdf$/i.test(path)) {
    throw new AuthorizationError('report_path_denied');
  }
  return path;
}
