export const BUSINESS_CONTEXT = Object.freeze({ MARKETING: 'marketing', OPERATIONAL: 'operational_communication' });
export const BUSINESS_CONTEXT_OPTIONS = Object.freeze([
  { value: BUSINESS_CONTEXT.MARKETING, label: 'Marketing' },
  { value: BUSINESS_CONTEXT.OPERATIONAL, label: 'Communication opérationnelle' }
]);
export const normalizeBusinessContext = value => value === BUSINESS_CONTEXT.OPERATIONAL ? BUSINESS_CONTEXT.OPERATIONAL : BUSINESS_CONTEXT.MARKETING;
export const isBusinessContext = (row, context) => normalizeBusinessContext(row?.business_context) === context;
export const businessContextLabel = value => BUSINESS_CONTEXT_OPTIONS.find(option => option.value === normalizeBusinessContext(value))?.label;
