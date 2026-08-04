export const VALIDATION_CONFIG_VERSION = '1.0.0';
export const VALIDATION_KEYS = Object.freeze([
  'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
  'maximumValue', 'allowedValues', 'errorMessages'
]);
export const VALIDATION_MESSAGE_KEYS = Object.freeze([
  'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
  'maximumValue', 'allowedValues'
]);
export const EMPTY_VALIDATION_CONFIG = Object.freeze(Object.fromEntries(
  VALIDATION_KEYS.map(key => [key, null])
));

const codePoints = value => Array.from(String(value)).length;
const utf8Bytes = value => new TextEncoder().encode(value).length;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const strictKey = value => `${typeof value}:${JSON.stringify(value)}`;

export function validationConfigFromField(field) {
  const stored = field?.validation_rules;
  const candidate = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const result = normalizeValidationConfig(candidate);
  return result.normalized || Object.fromEntries(VALIDATION_KEYS.map(key => [
    key, own(candidate, key) ? candidate[key] : null
  ]));
}

export function normalizeValidationConfig(candidate = {}) {
  const errors = {};
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, normalized: null, errors: { contract: 'Objet ValidationConfig attendu.' } };
  }
  const unknown = Object.keys(candidate).filter(key => !VALIDATION_KEYS.includes(key));
  if (unknown.length) errors.contract = `Propriété inconnue : ${unknown[0]}.`;
  const normalized = { ...EMPTY_VALIDATION_CONFIG };

  const required = own(candidate, 'requiredOverride') ? candidate.requiredOverride : null;
  if (required !== null && typeof required !== 'boolean') {
    errors.requiredOverride = 'Choisissez Hériter, Requis ou Non requis.';
  } else normalized.requiredOverride = required;

  for (const key of ['minimumLength', 'maximumLength']) {
    const value = own(candidate, key) ? candidate[key] : null;
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      errors[key] = 'La longueur doit être un entier positif ou nul.';
    } else normalized[key] = value;
  }
  if (!errors.minimumLength && !errors.maximumLength &&
      normalized.minimumLength !== null && normalized.maximumLength !== null &&
      normalized.minimumLength > normalized.maximumLength) {
    errors.maximumLength = 'La longueur minimale ne peut pas dépasser la longueur maximale.';
  }

  for (const key of ['minimumValue', 'maximumValue']) {
    const value = own(candidate, key) ? candidate[key] : null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      errors[key] = 'La valeur doit être un nombre fini.';
    } else normalized[key] = value;
  }
  if (!errors.minimumValue && !errors.maximumValue &&
      normalized.minimumValue !== null && normalized.maximumValue !== null &&
      normalized.minimumValue > normalized.maximumValue) {
    errors.maximumValue = 'La valeur minimale ne peut pas dépasser la valeur maximale.';
  }

  const allowed = own(candidate, 'allowedValues') ? candidate.allowedValues : null;
  if (allowed !== null) {
    if (!Array.isArray(allowed)) errors.allowedValues = 'Une liste de valeurs est attendue.';
    else if (allowed.length > 100) errors.allowedValues = 'Maximum 100 valeurs permises.';
    else {
      const seen = new Set();
      for (const value of allowed) {
        if (!['string', 'number', 'boolean'].includes(typeof value) ||
            (typeof value === 'number' && !Number.isFinite(value)) ||
            (typeof value === 'string' && codePoints(value) > 500)) {
          errors.allowedValues = 'Chaque valeur doit être un texte, un nombre fini ou un booléen.';
          break;
        }
        const key = strictKey(value);
        if (seen.has(key)) {
          errors.allowedValues = 'Les doublons stricts sont interdits.';
          break;
        }
        seen.add(key);
      }
      if (!errors.allowedValues && utf8Bytes(JSON.stringify(allowed)) > 65536) {
        errors.allowedValues = 'La liste dépasse 65 536 octets UTF-8.';
      }
      if (!errors.allowedValues) normalized.allowedValues = [...allowed];
    }
  }

  const messages = own(candidate, 'errorMessages') ? candidate.errorMessages : null;
  if (messages !== null) {
    if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
      errors.errorMessages = 'Un objet de messages est attendu.';
    } else {
      const normalizedMessages = {};
      for (const [key, value] of Object.entries(messages)) {
        if (!VALIDATION_MESSAGE_KEYS.includes(key)) {
          errors.errorMessages = `Clé de message inconnue : ${key}.`;
          break;
        }
        if (typeof value !== 'string') {
          errors.errorMessages = 'Chaque message doit être textuel.';
          break;
        }
        const text = value.trim();
        if (!text) {
          errors.errorMessages = 'Un message ne peut pas être vide.';
          break;
        }
        if (codePoints(text) > 300) {
          errors.errorMessages = 'Un message ne peut pas dépasser 300 caractères Unicode.';
          break;
        }
        if (/<[^>]*>|javascript\s*:|<script|\$\{|\{\{/i.test(text)) {
          errors.errorMessages = 'Le message contient du contenu interdit.';
          break;
        }
        normalizedMessages[key] = text;
      }
      if (!errors.errorMessages) normalized.errorMessages = normalizedMessages;
    }
  }
  return { valid: Object.keys(errors).length === 0, normalized, errors };
}

export function parseOptionalInteger(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, value: null };
  if (!/^[0-9]+$/.test(text)) return { valid: false, value: null };
  const value = Number(text);
  return { valid: Number.isSafeInteger(value), value };
}

export function parseOptionalNumber(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, value: null };
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return { valid: false, value: null };
  const value = Number(text);
  return { valid: Number.isFinite(value), value };
}

export function validationConfigChanged(left, right) {
  const before = normalizeValidationConfig(left);
  const after = normalizeValidationConfig(right);
  return before.valid && after.valid &&
    JSON.stringify(before.normalized) !== JSON.stringify(after.normalized);
}

export function validationProtectionReasons(field) {
  const name = String(field?.technicalName || field?.field_name || '').toLowerCase();
  const reasons = [];
  if (['id','support_id','created_at','updated_at','deleted_at','auth_user_id',
    'photo_principale_url','photo_miniature_url','visuel_actuel_cadre'].includes(name)) reasons.push('Champ système protégé');
  if (name.endsWith('_id')) reasons.push('Identifiant protégé');
  if (field?.primaryKey || field?.physical_is_primary_key) reasons.push('Clé primaire');
  if (field?.foreignKey || field?.physical_is_foreign_key) reasons.push('Clé étrangère');
  if (field?.generated || field?.physical_is_generated) reasons.push('Colonne générée');
  if (field?.physical?.identity || field?.physical_is_identity) reasons.push('Colonne identity');
  if (field?.system) reasons.push('Champ système');
  if (field?.functionalType === 'calculated' || field?.field_type === 'calculated') reasons.push('Champ calculé');
  if (field?.is_virtual || String(field?.id || '').startsWith('physical:')) reasons.push('Champ virtuel');
  if (field?.validation_configurable === false) reasons.push('Champ explicitement non configurable');
  return [...new Set(reasons)];
}

export function compatibleValidationKeys(field) {
  const type = field?.functionalType || field?.field_type;
  if (['short_text','long_text'].includes(type)) return ['requiredOverride','minimumLength','maximumLength','allowedValues','errorMessages'];
  if (['number','currency'].includes(type)) return ['requiredOverride','minimumValue','maximumValue','allowedValues','errorMessages'];
  if (['boolean','single_select','multi_select'].includes(type)) return ['requiredOverride','allowedValues','errorMessages'];
  if (['date','datetime'].includes(type)) return ['requiredOverride','errorMessages'];
  return ['requiredOverride','errorMessages'];
}
