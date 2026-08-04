import { FIELD_CONTRACTS, FIELD_CONTRACT_VERSION } from './contracts.js';

export const FIELD_CONTRACT_VERSION_REGISTRY = Object.freeze({
  [FIELD_CONTRACT_VERSION]: Object.freeze(
    Object.fromEntries(
      Object.entries(FIELD_CONTRACTS).map(([name, definition]) => [name, definition])
    )
  )
});

export function getFieldContract(name, version = FIELD_CONTRACT_VERSION) {
  return FIELD_CONTRACT_VERSION_REGISTRY[version]?.[name] || null;
}

export function isSupportedFieldContractVersion(version) {
  return Object.prototype.hasOwnProperty.call(FIELD_CONTRACT_VERSION_REGISTRY, version);
}
