import { mergeFieldCatalog } from './fieldCatalog.js';

export const FIELD_CATALOG_MIGRATION_MESSAGE = 'Le catalogue universel 13.1-A1 n’est pas encore disponible dans cet environnement. La consultation demeure sécuritaire et aucune synchronisation n’a été lancée.';
export const FIELD_CATALOG_METADATA_MESSAGE = 'Les métadonnées physiques ne sont pas disponibles pour le moment.';
export const FIELD_CATALOG_LOAD_ERROR_MESSAGE = 'Le catalogue ne peut pas être chargé pour le moment. Le reste du portail demeure disponible.';

export function isMissingCatalogCapability(error) {
  const content = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return ['pgrst202', 'pgrst204', '42p01', '42703', 'does not exist', 'schema cache'].some(token => content.includes(token));
}

export function buildFieldCatalogLoadResult({ catalogRows = [], schema = {}, catalogError = null, metadataError = null } = {}) {
  const migrationMissing = Boolean(metadataError && isMissingCatalogCapability(metadataError));
  const realCatalogError = Boolean(catalogError && !isMissingCatalogCapability(catalogError));
  const realMetadataError = Boolean(metadataError && !migrationMissing);
  const physicalMetadataAvailable = !metadataError && Object.values(schema).some(fields => fields.length > 0);
  const warnings = [];
  const errors = [];

  if (migrationMissing) warnings.push({ code: 'migration_missing', message: FIELD_CATALOG_MIGRATION_MESSAGE });
  else if (!physicalMetadataAvailable) warnings.push({ code: 'physical_metadata_missing', message: FIELD_CATALOG_METADATA_MESSAGE });
  if (realCatalogError) errors.push({ code: 'catalog_load_error', message: FIELD_CATALOG_LOAD_ERROR_MESSAGE, cause: catalogError });
  if (realMetadataError) errors.push({ code: 'physical_metadata_error', message: FIELD_CATALOG_LOAD_ERROR_MESSAGE, cause: metadataError });

  const fields = mergeFieldCatalog(realCatalogError ? [] : catalogRows, realMetadataError ? {} : schema);
  return {
    data: { fields },
    capabilities: {
      catalogRead: !catalogError,
      physicalMetadataRead: physicalMetadataAvailable,
      cache: true,
      invalidation: true
    },
    migrationState: {
      status: migrationMissing ? 'missing' : realMetadataError ? 'unknown' : 'available',
      requiredVersion: '13.1-A1'
    },
    warnings,
    errors,
    catalogState: realCatalogError ? 'error' : catalogRows.length ? 'available' : 'empty'
  };
}
