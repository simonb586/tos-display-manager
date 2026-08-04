import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import {
  buildFieldCatalogLoadResult,
  isMissingCatalogCapability
} from '../lib/fieldCatalogLoadResult.js';
import { listAvailableSchemaMetadata } from './schemaService.js';

const CACHE_TTL_MS = 30_000;
let cacheEntry = null;

export { buildFieldCatalogLoadResult, isMissingCatalogCapability };

export function invalidateFieldCatalogCache() {
  cacheEntry = null;
}

export async function loadFieldCatalogReadOnly({ force = false } = {}) {
  if (!force && cacheEntry && Date.now() - cacheEntry.createdAt < CACHE_TTL_MS) return cacheEntry.result;
  if (!supabaseConfigured || !supabase) {
    return buildFieldCatalogLoadResult({ metadataError: { code: 'PGRST202', message: 'RPC unavailable' } });
  }

  const [catalogResult, metadataResult] = await Promise.allSettled([
    supabase.from('relation_fields').select('*').order('table_name').order('field_name'),
    listAvailableSchemaMetadata()
  ]);
  const catalogResponse = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
  const catalogError = catalogResult.status === 'rejected' ? catalogResult.reason : catalogResponse?.error;
  const metadataError = metadataResult.status === 'rejected' ? metadataResult.reason : null;
  const schema = metadataResult.status === 'fulfilled' ? metadataResult.value : {};

  if (catalogError && !isMissingCatalogCapability(catalogError)) console.error('Catalogue relation_fields indisponible', catalogError);
  if (metadataError && !isMissingCatalogCapability(metadataError)) console.error('Métadonnées physiques indisponibles', metadataError);

  const result = buildFieldCatalogLoadResult({
    catalogRows: catalogResponse?.data || [],
    schema,
    catalogError,
    metadataError
  });
  cacheEntry = { createdAt: Date.now(), result };
  return result;
}
