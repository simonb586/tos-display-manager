-- Bloc 3 — Authentification et rôles
-- À exécuter dans Supabase SQL Editor.

alter table utilisateurs
add column if not exists auth_user_id uuid,
add column if not exists role text,
add column if not exists statut text;

create unique index if not exists utilisateurs_auth_user_id_key
on utilisateurs (auth_user_id)
where auth_user_id is not null;

create index if not exists utilisateurs_role_idx
on utilisateurs (role);

-- Rôles recommandés :
-- administrateur
-- coordonnateur
-- installateur
-- client-admin
-- client

-- Pour associer un utilisateur Supabase Auth à un profil :
-- 1. Crée l'utilisateur dans Supabase > Authentication > Users.
-- 2. Copie son ID.
-- 3. Mets à jour la ligne correspondante dans utilisateurs.auth_user_id.
