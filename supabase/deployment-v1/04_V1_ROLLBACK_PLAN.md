# Plan de retour arrière V1.0

- **Erreur avant toute migration :** arrêter. Ne rien appliquer et conserver le frontal actuel.
- **Erreur pendant une migration :** arrêter avant le fichier suivant. Conserver l’erreur complète et vérifier si la transaction du fichier a annulé ses changements.
- **Migration réussie, vérificateur échoué :** ne pas poursuivre. Comparer au précontrôle; préparer ultérieurement un correctif additif revu. Ne pas modifier la migration source.
- **Frontal déployé, erreur visible :** remettre en service le déploiement Vercel précédemment validé. La restauration du frontal est réversible et ne doit pas modifier la base.
- **Fonction administrative indisponible :** retirer temporairement son accès par une modification frontale explicite et revue, ou restaurer le frontal précédent; ne pas improviser de SQL.
- **Erreur de permission :** arrêter les écritures concernées, comparer propriétaires/RLS/grants au précontrôle et faire revoir un correctif minimal.
- **Erreur photo ou Storage :** arrêter remplacement/suppression, préserver fichiers et métadonnées, comparer `support_photos`, références Infrastructure et journal. Restaurer la base/Storage si une perte est démontrée.
- **Erreur d’invitation :** suspendre les invitations, vérifier la fonction serveur et l’URL publique configurée, sans changer les comptes existants.
- **Erreur C1 ou A9 :** arrêter avant A9 si C1 diverge; si A9 échoue après C1, conserver C1 et analyser. Ne jamais valider globalement C1 ni supprimer des audits automatiquement.

Une suppression d’objet ou de données n’est jamais présentée comme rollback sûr. Si une migration a écrit des données ou si son état transactionnel est incertain, une restauration contrôlée peut être nécessaire. Actions sûres privilégiées : arrêt au point courant, conservation des preuves, restauration du frontal précédent et revue avant toute nouvelle intervention.
