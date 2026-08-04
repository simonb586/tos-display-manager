# Validation A5 en préproduction

1. Dans Supabase, ouvrez le projet **staging/test** puis **Project Settings → General**. Vérifiez que son nom et sa référence ne sont pas ceux de la production.
2. Ouvrez **SQL Editor → New query**. Ne collez jamais ici ni dans la conversation un mot de passe, JWT, clé `service_role`, jeton ou URL de connexion secrète.
3. Ouvrez `A5_PREPRODUCTION_VALIDATION_PACK.sql`, remplacez uniquement `CONFIRMER_REF_PREPRODUCTION` par la référence affichée à l’écran, puis collez tout le fichier dans SQL Editor et cliquez **Run** une seule fois.
4. Résultat attendu : une ligne `A5_PREFLIGHT_OK`. Toute erreur signifie **arrêt immédiat**; ne relancez rien et n’appliquez pas A6.
5. Ce paquet est volontairement un précontrôle non mutatif tant que Codex n’a pas reçu votre autorisation après identification certaine du projet de test.
6. Pour revenir en arrière après une future exécution autorisée d’A5, ouvrez une nouvelle requête, collez `A5_PREPRODUCTION_ROLLBACK.sql`, relisez son avertissement puis exécutez-le. Il ne restaure aucune table métier globalement.

