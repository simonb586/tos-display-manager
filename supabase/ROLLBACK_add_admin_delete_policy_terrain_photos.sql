-- Retour arrière ciblé : retire uniquement la politique ajoutée.

drop policy if exists "Administrateurs suppriment terrain-photos"
on storage.objects;
