// Contrats descriptifs 13.1-A3.0. Ils ne contiennent aucune fonction exécutable.
export const FIELD_CATALOG_FUTURE_SERVICE_CONTRACTS = Object.freeze({
  fieldCatalogSyncService: Object.freeze({
    active: false,
    responsibility: 'Comparer ou synchroniser explicitement le catalogue et le schéma physique.',
    futureOperations: Object.freeze(['inspectDifferences', 'requestSynchronization'])
  }),
  fieldCatalogHistoryService: Object.freeze({
    active: false,
    responsibility: 'Consulter les changements de configuration.',
    futureOperations: Object.freeze(['listFieldHistory'])
  })
});
