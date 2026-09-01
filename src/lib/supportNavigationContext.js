export const normalizeSupportId = value => String(value ?? '').trim();

export function edtIdsForSupport(assignments = [], supportId = '') {
  const wanted = normalizeSupportId(supportId);
  return new Set(assignments
    .filter(row => normalizeSupportId(row.support_id) === wanted)
    .map(row => String(row.edt_id)));
}

export function filterSupportPhotos(rows = [], supportId = '') {
  const wanted = normalizeSupportId(supportId);
  return wanted ? rows.filter(row => normalizeSupportId(row.support_id) === wanted) : rows;
}

export function filterSupportOperations(data = {}, supportId = '') {
  const wanted = normalizeSupportId(supportId);
  if (!wanted) return {
    edts: data.edts || [], workOrders: data.workOrders || [],
    requests: data.requests || [], history: data.history || []
  };
  const edtIds = edtIdsForSupport(data.edtSupports, wanted);
  return {
    edts: (data.edts || []).filter(row => edtIds.has(String(row.id))),
    workOrders: (data.workOrders || []).filter(row => normalizeSupportId(row.support_id) === wanted || edtIds.has(String(row.edt_id))),
    requests: (data.requests || []).filter(row => normalizeSupportId(row.support_id) === wanted),
    history: (data.history || []).filter(row => normalizeSupportId(row.support_id) === wanted || edtIds.has(String(row.edt_id)))
  };
}
