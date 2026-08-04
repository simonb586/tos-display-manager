# A8 — ImportExportConfig : implémentation locale finale

**Statut : brouillon administratif sans effet réel**

## 1–3. Objectif, périmètre et contrat
A8 prépare `ImportExportConfig` 1.0.0 sans activation. Propriétés exactes : `availableInImport`, `availableInExport`, `importColumnName`, `exportColumnName`, `importAliases`, `exportAliases`, `defaultValue`, `exchangeContractVersion`.
## 4–8. Inventaire
Les imports historiques reposent sur scripts/données, `LegacyPhotoImporter` et services spécialisés. Les exports reposent sur XLSX/ExcelJS, jsPDF, grilles visibles, filtres/sélections, `FinalReportsCenter`, `finalReportService` et fiches 360. Exports de surface et complets restent distincts; aucun mécanisme n’est modifié.
## 9. Stockage
Les colonnes A1 `available_in_import`, `available_in_export` et `default_value` sont fragmentées et susceptibles d’avoir une sémantique historique. A8 ajoute `relation_fields.import_export_config` JSONB pour le brouillon canonique complet sans les consommer.
## 10–15. SQL, RPC, sécurité, concurrence et audit
Migration locale non exécutée; normaliseur pur SQL; RPC `save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamptz)`, SECURITY DEFINER, postgres, `pg_catalog`, PUBLIC/anon révoqués, authenticated accordé, Administrateur contrôlé, verrou et stale_draft. Audit commun `import_export_draft_saved`, atomique et absent sur no_change.
## 16–20. Normalisation, service, interface, noms et alias
Le modèle pur refuse propriétés inconnues, formules `= + - @`, contrôles, HTML actif, javascript, doublons NFKC insensibles à la casse, plus de 50 alias ou 200 points de code. Import et export restent séparés. Service RPC unique sans retry/repli. Onglet administratif avec deux actions seulement.
## 21–24. Valeur, fichiers, prévisualisation, accessibilité
`defaultValue` accepte seulement null ou scalaire JSON sûr et n’est jamais appliquée. Photos/fichiers exigent un flux spécialisé. La prévisualisation statique couvre en-têtes, ligne, surface et fiche 360 conceptuelle sans fichier/téléchargement. Labels, fieldsets, clavier, 44 px, ARIA et responsive sont prévus.
## 25–28. no_change, stale_draft, tests, non-consommation
Comparaison locale puis serveur; stale_draft conserve le local. Le vérificateur couvre contrat, sécurité et isolation. Aucun import, export, rapport, fiche 360, photo, Terrain ou surface métier ne référence A8.
## 29–32. Build, risques, validations, A9
Build inclus au check. Restent revue/exécution SQL manuelle autorisée, concurrence réelle et tests navigateur. Ne pas commencer A9 sans autorisation explicite; toute consommation attend A10 et une mission distincte.
