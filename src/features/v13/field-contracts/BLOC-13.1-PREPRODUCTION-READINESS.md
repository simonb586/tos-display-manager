# Bloc 13.1 — Décision de préparation préproduction

1. **Statut actuel.** A1–A10, consolidation 13.1.1 et C1 sont gelés localement. Le paquet est préparé, jamais exécuté.
2. **Conditions obligatoires.** Environnement explicitement identifié comme préproduction, confirmation écrite, accès autorisé, opérateur et restauration exploitable. Sinon NO-GO.
3. **Ordre officiel.** Précontrôle; A1; synchronisation seulement sur autorisation séparée; A3; A4; A5; A6; A7; A8; C1; inspection/validation C1 séparée; A9; postcontrôle; tests; arrêt.
4. **Rôle de C1.** Remplacer la contrainte A8 par la liste fermée des huit types avant que les écritures A9 soient possibles.
5. **`NOT VALID`.** Les nouvelles écritures sont contrôlées; les anciennes lignes ne sont pas validées automatiquement. `VALIDATE CONSTRAINT` exige une autorisation distincte.
6. **Précontrôle.** Inventorie version, schéma, structure, valeurs, anomalies JSON, contraintes, fonctions, propriétaires, droits, RLS, triggers et compteurs dans une transaction en lecture seule.
7. **Postcontrôle.** Vérifie colonnes, C1, fonctions/RPC, sécurité, intégrité, historiques, compteurs, absence d’objet d’activation et compare au précontrôle.
8. **Rollback.** Priorité à la restauration testée; aucune suppression générique; les corrections sont additives et chaque échec impose un arrêt.
9. **Tests manuels.** Couvrent rôles, protections, `saved`, `no_change`, `stale_draft`, audit, concurrence et non-consommation.
10. **Sécurité.** Propriétaires, mode de sécurité, `search_path`, grants/revocations, PUBLIC, anon, authenticated, RLS et triggers doivent être conformes.
11. **Non-consommation.** Les configurations restent déclaratives; aucune grille, formulaire, fiche 360, fonction Terrain ou échange n’est modifié.
12. **Activation interdite.** A10 reste théorique; aucune activation, migration A10 ou consommation métier.
13. **Risques résiduels.** SQL non validé sur PostgreSQL réel; état initial inconnu; dépendance au nom exact de contrainte A8; accessibilité, concurrence et rôles à tester manuellement.
14. **Éléments manquants.** Identification formelle de la préproduction, sauvegarde/restauration, autorisations d’exécution et de validation C1, résultats SQL et tests fonctionnels.
15. **Conditions GO.** Toutes les cases obligatoires, empreintes et comparaisons sont conformes; chaque vérificateur passe; aucun effet métier.
16. **Conditions NO-GO.** Un prérequis manque, une empreinte diverge, une ancienne ligne est incompatible, un droit/objet/compteur change, ou un test échoue.
17. **Escalade.** Arrêter, conserver résultats et erreur sans donnée sensible, comparer aux snapshots, soumettre à revue; ne jamais improviser une correction en préproduction.
18. **Recommandation finale.** Paquet prêt sous conditions; aucune exécution avant autorisation explicite et satisfaction documentée de la checklist.
