import assert from 'node:assert/strict';
import {
  normalizeCampaignStatus,
  normalizeDisplayFormat,
  supportDisplayFormat
} from '../src/lib/displayFormat.js';

const cases = [
  ['20 x 28 Portrait', '20x28'],
  ['20x28', '20x28'],
  ['24,25 × 18 pouces', '24.25x18'],
  ['24.250x18.0', '24.25x18'],
  ['  Abribus  ', 'abribus'],
  [null, '']
];

for (const [input, expected] of cases) {
  assert.equal(
    normalizeDisplayFormat(input),
    expected,
    `Normalisation incorrecte pour ${String(input)}`
  );
}

assert.notEqual(
  normalizeDisplayFormat('20 x 28'),
  normalizeDisplayFormat('28 x 20'),
  'L’orientation dimensionnelle doit rester discriminante.'
);
assert.equal(normalizeCampaignStatus('Activé'), 'active');
assert.equal(
  supportDisplayFormat({ format_affichage: ' 24,25 x 18 ' }),
  '24,25 x 18'
);
assert.equal(
  supportDisplayFormat({ format: '20 x 28' }),
  '20 x 28'
);
assert.equal(
  supportDisplayFormat({ type_support: 'Abribus' }),
  'Abribus'
);

console.log(`OK: ${cases.length + 5} vérifications des visuels terrain réussies.`);
