-- TOS Display Manager — Sprint 7.2
-- Campagnes maîtres + affectations + propagation transactionnelle.
-- À exécuter dans Supabase SQL Editor APRÈS les Blocs 1 à 6 et le Sprint 7.1.

create table if not exists public.campagnes_maitres (
  id bigserial primary key,
  code_campagne text unique,
  nom_campagne text not null,
  client text,
  type_campagne text,
  visuel_generique text,
  no_edt text,
  date_debut date,
  date_fin date,
  priorite text default 'Normale',
  statut text default 'Brouillon',
  publiee_terrain boolean default false,
  instructions_terrain text,
  supports_cibles integer default 0,
  supports_completes integer default 0,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.campagnes_supports (
  id bigserial primary key,
  campagne_id bigint not null references public.campagnes_maitres(id) on delete cascade,
  support_id text not null,
  statut text default 'À faire',
  visuel_attendu text,
  no_edt text,
  date_affectation timestamptz default now(),
  date_completion timestamptz,
  utilisateur_completion text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(campagne_id, support_id)
);

create table if not exists public.journal_propagations (
  id bigserial primary key,
  operation_id uuid default gen_random_uuid(),
  campagne_id bigint,
  support_id text,
  declencheur text,
  statut text,
  details jsonb default '{}'::jsonb,
  utilisateur text,
  created_at timestamptz default now()
);

create index if not exists campagnes_maitres_statut_idx
  on public.campagnes_maitres(statut);

create index if not exists campagnes_maitres_publiee_idx
  on public.campagnes_maitres(publiee_terrain);

create index if not exists campagnes_supports_support_idx
  on public.campagnes_supports(support_id);

create index if not exists campagnes_supports_campagne_idx
  on public.campagnes_supports(campagne_id);

create index if not exists journal_propagations_support_idx
  on public.journal_propagations(support_id);

alter table public.campagnes_maitres enable row level security;
alter table public.campagnes_supports enable row level security;
alter table public.journal_propagations enable row level security;

drop policy if exists "campagnes_maitres_authenticated_read" on public.campagnes_maitres;
create policy "campagnes_maitres_authenticated_read"
on public.campagnes_maitres for select to authenticated using (true);

drop policy if exists "campagnes_maitres_admin_write" on public.campagnes_maitres;
create policy "campagnes_maitres_admin_write"
on public.campagnes_maitres for all to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur'))
with check (public.current_app_role() in ('Administrateur','Coordonnateur'));

drop policy if exists "campagnes_supports_authenticated_read" on public.campagnes_supports;
create policy "campagnes_supports_authenticated_read"
on public.campagnes_supports for select to authenticated using (true);

drop policy if exists "campagnes_supports_authenticated_write" on public.campagnes_supports;
create policy "campagnes_supports_authenticated_write"
on public.campagnes_supports for all to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur','Installateur'))
with check (public.current_app_role() in ('Administrateur','Coordonnateur','Installateur'));

drop policy if exists "journal_propagations_authenticated_read" on public.journal_propagations;
create policy "journal_propagations_authenticated_read"
on public.journal_propagations for select to authenticated using (true);

-- Ajout défensif des colonnes nécessaires aux tables existantes.
alter table public.inspections_terrain
  add column if not exists campagne_id bigint,
  add column if not exists campagne text,
  add column if not exists visuel text,
  add column if not exists no_edt text;

-- Une fonction PostgreSQL s'exécute dans une transaction :
-- si une instruction échoue, l'ensemble de la propagation est annulé.
create or replace function public.appliquer_campagne_support(
  p_support_id text,
  p_campagne_id bigint,
  p_utilisateur text default null,
  p_photo_url text default null,
  p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campagne public.campagnes_maitres%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_old_campaign text;
  v_old_visual text;
begin
  select * into v_campagne
  from public.campagnes_maitres
  where id = p_campagne_id
    and publiee_terrain = true
    and statut not in ('Annulée','Archivée');

  if not found then
    raise exception 'Campagne inexistante, non publiée ou inactive.';
  end if;

  select campagne_actuelle, visuel_campagne
    into v_old_campaign, v_old_visual
  from public.infrastructures
  where support_id = p_support_id
  for update;

  if not found then
    raise exception 'Support % introuvable.', p_support_id;
  end if;

  update public.infrastructures
  set campagne_actuelle = v_campagne.nom_campagne,
      campagne_selon_visuel = v_campagne.nom_campagne,
      visuel_campagne = v_campagne.visuel_generique,
      visuel_en_expo = coalesce(v_campagne.visuel_generique, visuel_en_expo),
      visuel_actuel_cadre = coalesce(v_campagne.visuel_generique, visuel_actuel_cadre),
      edt_associe = coalesce(v_campagne.no_edt, edt_associe),
      date_derniere_manipulation = now()::text,
      updated_at = now()
  where support_id = p_support_id;

  insert into public.campagnes_supports (
    campagne_id, support_id, statut, visuel_attendu, no_edt,
    date_completion, utilisateur_completion, photo_url, updated_at
  )
  values (
    v_campagne.id, p_support_id, 'Terminée',
    v_campagne.visuel_generique, v_campagne.no_edt,
    now(), p_utilisateur, p_photo_url, now()
  )
  on conflict (campagne_id, support_id)
  do update set
    statut = 'Terminée',
    visuel_attendu = excluded.visuel_attendu,
    no_edt = excluded.no_edt,
    date_completion = now(),
    utilisateur_completion = excluded.utilisateur_completion,
    photo_url = coalesce(excluded.photo_url, campagnes_supports.photo_url),
    updated_at = now();

  insert into public.historique_des_campagnes (
    support_id, campagne, visuel, no_edt, date_installation,
    photo_installation, utilisateur, raw_data
  )
  values (
    p_support_id,
    v_campagne.nom_campagne,
    v_campagne.visuel_generique,
    v_campagne.no_edt,
    now()::text,
    p_photo_url,
    p_utilisateur,
    jsonb_build_object(
      'operation_id', v_operation_id,
      'campagne_id', v_campagne.id,
      'ancienne_campagne', v_old_campaign,
      'ancien_visuel', v_old_visual,
      'photo_path', p_photo_path
    )
  );

  update public.campagnes_maitres cm
  set supports_completes = (
        select count(*)::integer
        from public.campagnes_supports cs
        where cs.campagne_id = cm.id
          and cs.statut = 'Terminée'
      ),
      supports_cibles = greatest(
        cm.supports_cibles,
        (
          select count(*)::integer
          from public.campagnes_supports cs
          where cs.campagne_id = cm.id
        )
      ),
      updated_at = now()
  where cm.id = v_campagne.id;

  if v_campagne.no_edt is not null and v_campagne.no_edt <> '' then
    update public.suivi_des_edt
    set campagne = v_campagne.nom_campagne,
        supports_completes = (
          select count(*)::integer
          from public.campagnes_supports
          where campagne_id = v_campagne.id
            and statut = 'Terminée'
        ),
        photos_recues = (
          select count(*)::integer
          from public.campagnes_supports
          where campagne_id = v_campagne.id
            and photo_url is not null
            and photo_url <> ''
        ),
        avancement = case
          when coalesce(supports_cibles, 0) > 0 then
            round(
              (
                (
                  select count(*)::numeric
                  from public.campagnes_supports
                  where campagne_id = v_campagne.id
                    and statut = 'Terminée'
                ) / supports_cibles::numeric
              ) * 100,
              2
            )
          else avancement
        end,
        updated_at = now()
    where no_edt = v_campagne.no_edt;
  end if;

  insert into public.journal_des_evenements (
    date_evenement, utilisateur, action, table_concernee,
    ancienne_valeur, nouvelle_valeur, raw_data
  )
  values (
    now()::text,
    p_utilisateur,
    'Application campagne au support',
    'infrastructures',
    jsonb_build_object(
      'campagne', v_old_campaign,
      'visuel', v_old_visual
    )::text,
    jsonb_build_object(
      'campagne', v_campagne.nom_campagne,
      'visuel', v_campagne.visuel_generique,
      'no_edt', v_campagne.no_edt
    )::text,
    jsonb_build_object(
      'operation_id', v_operation_id,
      'campagne_id', v_campagne.id,
      'support_id', p_support_id
    )
  );

  insert into public.journal_propagations (
    operation_id, campagne_id, support_id, declencheur,
    statut, details, utilisateur
  )
  values (
    v_operation_id,
    v_campagne.id,
    p_support_id,
    'Intervention terrain terminée',
    'Réussi',
    jsonb_build_object(
      'infrastructure', true,
      'affectation_campagne', true,
      'historique', true,
      'edt', v_campagne.no_edt is not null,
      'photo_url', p_photo_url
    ),
    p_utilisateur
  );

  return jsonb_build_object(
    'operation_id', v_operation_id,
    'support_id', p_support_id,
    'campagne', v_campagne.nom_campagne,
    'visuel', v_campagne.visuel_generique,
    'no_edt', v_campagne.no_edt,
    'statut', 'Réussi'
  );
exception
  when others then
    raise;
end;
$$;

grant execute on function public.appliquer_campagne_support(text,bigint,text,text,text)
to authenticated;
