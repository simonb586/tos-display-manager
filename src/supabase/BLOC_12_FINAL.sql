-- TOS Display Manager — Bloc 12 FINAL
-- Utilisateurs v2, invitations de production, relations depuis les grilles
-- et gestion sécurisée des visuels.

alter table public.utilisateurs
add column if not exists invitation_statut text default 'Invitation envoyée';

alter table public.utilisateurs
add column if not exists invitation_envoyee_le timestamptz;

alter table public.utilisateurs
add column if not exists derniere_activite_le timestamptz;

create index if not exists utilisateurs_courriel_unique_idx
on public.utilisateurs(lower(courriel));

-- Garantir l'unicité demandée par les upserts Edge.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'utilisateurs_courriel_key'
      and conrelid = 'public.utilisateurs'::regclass
  ) then
    alter table public.utilisateurs
    add constraint utilisateurs_courriel_key unique(courriel);
  end if;
exception
  when unique_violation then
    raise exception 'Des profils utilisateurs partagent le même courriel. Corrige les doublons avant de relancer.';
end $$;

alter table public.relation_rules
add column if not exists condition_json jsonb not null default '{}'::jsonb;

create unique index if not exists relation_rules_unique_path_idx
on public.relation_rules(
  source_table,
  source_field,
  destination_table,
  destination_field
);

create or replace function public.delete_or_archive_campaign_visual(
  p_visual_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  used_count bigint := 0;
begin
  if public.current_app_role() not in ('Administrateur','Coordonnateur') then
    raise exception 'Accès refusé.';
  end if;

  if to_regclass('public.support_photos') is not null then
    execute
      'select count(*) from public.support_photos where visuel_id = $1'
    into used_count
    using p_visual_id;
  end if;

  if used_count > 0 then
    update public.campagne_visuels_formats
    set
      actif = false,
      updated_at = now()
    where id = p_visual_id;

    return jsonb_build_object(
      'action', 'archived',
      'used_count', used_count
    );
  end if;

  delete from public.campagne_visuels_formats
  where id = p_visual_id;

  return jsonb_build_object(
    'action', 'deleted',
    'used_count', 0
  );
end;
$$;

grant execute on function public.delete_or_archive_campaign_visual(bigint)
to authenticated;

create or replace function public.diagnostic_bloc12()
returns table(
  utilisateurs_total bigint,
  invitations_en_attente bigint,
  utilisateurs_actifs bigint,
  utilisateurs_desactives bigint,
  relations_grille bigint,
  visuels_actifs bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.utilisateurs),
    (
      select count(*)
      from public.utilisateurs
      where invitation_statut = 'Invitation envoyée'
    ),
    (
      select count(*)
      from public.utilisateurs
      where statut = 'Actif'
    ),
    (
      select count(*)
      from public.utilisateurs
      where statut = 'Désactivé'
    ),
    (
      select count(*)
      from public.relation_rules
      where condition_json ->> 'grid_shortcut' = 'true'
    ),
    (
      select count(*)
      from public.campagne_visuels_formats
      where actif = true
    );
$$;

grant execute on function public.diagnostic_bloc12()
to authenticated;
