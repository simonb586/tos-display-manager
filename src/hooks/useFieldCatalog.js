import { useCallback, useEffect, useState } from 'react';
import { invalidateFieldCatalogCache, loadFieldCatalogReadOnly } from '../services/fieldCatalogService';

const initialLoadState = {
  data: { fields: [] },
  capabilities: { catalogRead: false, physicalMetadataRead: false, cache: true, invalidation: true },
  migrationState: { status: 'unknown', requiredVersion: '13.1-A1' },
  warnings: [],
  errors: [],
  catalogState: 'empty'
};

export default function useFieldCatalog({ enabled = true } = {}) {
  const [result, setResult] = useState(initialLoadState);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return initialLoadState;
    setLoading(true);
    try {
      const next = await loadFieldCatalogReadOnly({ force });
      setResult(next);
      return next;
    } catch (error) {
      const failed = {
        ...initialLoadState,
        errors: [{ code: 'unexpected_load_error', message: 'Le catalogue ne peut pas être chargé pour le moment. Le reste du portail demeure disponible.', cause: error }]
      };
      setResult(failed);
      return failed;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const invalidate = useCallback(() => {
    invalidateFieldCatalogCache();
    return load({ force: true });
  }, [load]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    loadFieldCatalogReadOnly().then(next => {
      if (active) setResult(next);
    }).catch(error => {
      if (active) setResult({
        ...initialLoadState,
        errors: [{ code: 'unexpected_load_error', message: 'Le catalogue ne peut pas être chargé pour le moment. Le reste du portail demeure disponible.', cause: error }]
      });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [enabled]);

  return { ...result, loading, reload: load, invalidate };
}
