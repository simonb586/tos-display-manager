const PREFIX = 'tdm-form-draft:v1';

export const formDraftKey = (formType, context = 'default') =>
  `${PREFIX}:${String(formType)}:${String(context)}`;

export function readFormDraft(formType, context, fallback) {
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const value = JSON.parse(sessionStorage.getItem(formDraftKey(formType, context)) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeFormDraft(formType, context, value) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(formDraftKey(formType, context), JSON.stringify(value));
}

export function clearFormDraft(formType, context) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(formDraftKey(formType, context));
}
