const normalizeText = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const canonicalNumber = value => {
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? String(number) : '';
};

export function normalizeDisplayFormat(value) {
  const raw = normalizeText(value)
    .replace(/[×✕]/g, 'x')
    .replace(/\b(pouces?|po|inches?|inch)\b/g, '')
    .replace(/["”″]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const dimensions = raw.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/);

  if (dimensions) {
    return `${canonicalNumber(dimensions[1])}x${canonicalNumber(dimensions[2])}`;
  }

  return raw
    .replace(/\b(portrait|paysage|landscape)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function normalizeCampaignStatus(value) {
  return normalizeText(value);
}

export function supportDisplayFormat(support) {
  return String(
    support?.format_affichage ||
    support?.format ||
    support?.type_support ||
    ''
  ).trim();
}
