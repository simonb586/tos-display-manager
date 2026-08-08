import { BUSINESS_CONTEXT } from './businessContext.js';

const scalar = value => value === null || value === undefined ? '' : String(value);
export const assignmentLogicalKey = row => [
  scalar(row.site_id ?? row.site),
  scalar(row.support_id),
  scalar(row.campaign_id ?? row.communication_id ?? row.campagne_id),
  scalar(row.visual_id ?? row.visuel_id ?? row.nom_visuel ?? row.visuel_attendu)
].join('\u001f');

export function normalizeUniqueAssignments(rows = []) {
  const unique = new Map();
  for (const row of rows) {
    const key = assignmentLogicalKey(row);
    if (!unique.has(key)) unique.set(key, { ...row, logical_key: key });
  }
  return [...unique.values()];
}

export const duplicateLogicalRows = rows => rows.length - normalizeUniqueAssignments(rows).length;
export const assignmentsForContext = (rows, context) => normalizeUniqueAssignments(
  rows.filter(row => (row.business_context ?? row.campagne?.business_context) === context)
);
export const marketingAssignments = rows => assignmentsForContext(rows, BUSINESS_CONTEXT.MARKETING);
export const operationalAssignments = rows => assignmentsForContext(rows, BUSINESS_CONTEXT.OPERATIONAL);
