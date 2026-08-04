import FieldCatalogGeneralTab from './FieldCatalogGeneralTab';
import FieldCatalogDisplayTab from './FieldCatalogDisplayTab';
import FieldCatalogValidationTab from './FieldCatalogValidationTab';
import FieldCatalogPermissionTab from './FieldCatalogPermissionTab';
import FieldCatalogTerrainTab from './FieldCatalogTerrainTab';
import FieldCatalogImportExportTab from './FieldCatalogImportExportTab';
import FieldCatalogRelationsCalculationsTab from './FieldCatalogRelationsCalculationsTab';
import FieldConfigurationHistoryTab from './FieldConfigurationHistoryTab';
import FieldConfigurationDiagnosticsTab from './FieldConfigurationDiagnosticsTab';
import ActivationTab from './ActivationTab';

export const FIELD_CATALOG_TABS = Object.freeze([
  Object.freeze({ id: 'general', label: 'Général', component: FieldCatalogGeneralTab }),
  Object.freeze({ id: 'display', label: 'Affichage', component: FieldCatalogDisplayTab }),
  Object.freeze({ id: 'validation', label: 'Validation', component: FieldCatalogValidationTab }),
  Object.freeze({ id: 'permissions', label: 'Permissions', component: FieldCatalogPermissionTab }),
  Object.freeze({ id: 'terrain', label: 'Mobile / Terrain', component: FieldCatalogTerrainTab }),
  Object.freeze({ id: 'import-export', label: 'Import / Export', component: FieldCatalogImportExportTab }),
  Object.freeze({ id: 'relations-calculations', label: 'Relations et calculs', component: FieldCatalogRelationsCalculationsTab }),
  Object.freeze({ id: 'history', label: 'Historique', component: FieldConfigurationHistoryTab }),
  Object.freeze({ id: 'diagnostics', label: 'Diagnostics', component: FieldConfigurationDiagnosticsTab }),
  Object.freeze({ id: 'activation', label: 'Activation', component: ActivationTab })
]);
