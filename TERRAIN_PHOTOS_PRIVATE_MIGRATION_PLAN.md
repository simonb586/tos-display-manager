# Plan de migration privée de `terrain-photos`

Ce plan est préparatoire. Il ne modifie aucun bucket et ne déplace ni ne supprime aucun objet.

## Phase A — Inventaire

- Exporter en lecture seule les objets, tailles, types MIME et propriétaires de `terrain-photos`.
- Recenser les lignes `support_photos.storage_path`, `photo_url` et `thumbnail_url` qui le référencent.
- Recenser `terrainService`, `photoWorkflowService`, les galeries, rapports, historiques et exports qui consomment ces URL.
- Produire les comptes objets/références/orphelins avant toute copie.

## Phase B — Lectures authentifiées

- Choisir `support-photos`, déjà privé et pris en charge par le workflow photo, comme bucket canonique futur.
- Faire résoudre les chemins par URL signée courte ou téléchargement authentifié; ne plus persister de nouvelle URL publique.
- Conserver pendant la transition la lecture des anciennes `photo_url` et le bucket source.
- Copier par lots contrôlés, sans déplacement, avec manifeste source → destination et somme de contrôle.

## Phase C — Validation

- Vérifier les photos Terrain, miniatures, fiches 360, portail Client, rapports PDF, historiques et rollback.
- Comparer nombres, tailles et sommes de contrôle; tester l’isolation interclient avec des comptes réels de test.
- Observer les erreurs de signature/404 avant de poursuivre.

## Phase D — Passage privé

- Arrêter d’écrire dans `terrain-photos`, puis confirmer que tous les nouveaux uploads ciblent `support-photos`.
- Après approbation distincte et fenêtre de changement, rendre `terrain-photos` privé sans supprimer ses objets.
- Retirer les politiques publiques et accorder seulement les lectures authentifiées/scopées nécessaires.

## Phase E — Vérification et rollback

- Rejouer tous les parcours et surveiller Storage/PostgREST.
- Rollback : rétablir temporairement la politique de lecture précédente et les résolutions de chemins, sans recopier ni supprimer.
- Ne supprimer l’ancien bucket qu’au cours d’une mission future, après durée de rétention approuvée.
