# Frontend compatible avec les photos privées

Le lecteur commun résout les anciennes URL Terrain et les chemins Storage en URL signées. Les grilles, galeries, cartes, fiches 360, aperçus de rapport, ZIP et Excel utilisent ce lecteur. Le PDF EDT intègre maintenant les images signées sélectionnées et refuse une génération dont une photo est inaccessible. Les caches sont invalidés au changement de session ou de client.

Le lot comprend la stabilisation déjà validée des rafraîchissements, mutations, rôles, projections Client et Admin Preview, ainsi que les 16 migrations de sécurité déjà appliquées. Les handlers Edge restent préparés : ce commit ne les déploie pas. Les données et les fichiers de production ne sont pas inclus. Les fixtures navigateur sont des entrées de tests déterministes, sans compte ni fichier de production.

Avant commit : 627 cas navigateur, dont 29 photos et exports, 84 suites historiques, check/build, scan de secrets et git diff --check PASS. Les cas navigateur locaux simulent les services ; ils ne certifient pas les transferts HTTP, Auth ou la réception des courriels.

## Ordre autorisé du cutover

1. Commit et push normal sur release/v1.3.3.
2. Déployer le frontend compatible sur le projet Vercel existant.
3. Garder terrain-photos PUBLIC et valider les parcours réels en production.
4. Après tous les contrôles préalables PASS, appliquer les policies privées préparées et fermer le bucket sans supprimer de fichier.
5. Vérifier les 21 fichiers, les signatures, les rôles, les exports et les parcours après fermeture.
6. Poursuivre Auth 24 h, Safe Links, Edge et courriel contrôlé, puis les régressions finales.

Le cutover n'est pas déclaré terminé par ce commit. Aucun changement de configuration Auth ni fermeture de bucket n'accompagne sa création.

Les résultats détaillés et la liste exacte des candidats sont conservés localement dans precommit-validation.json et commit-candidates.json ; les résultats bruts de production ne sont pas publiés dans Git ou Vercel.
