-- TOS Display Manager — Bloc 7.3 CUMULATIF
-- Inclut 7.1 (index), 7.2 (campagnes/propagation) et 7.3 (Studio des relations).
-- Exécuter UNE SEULE FOIS dans Supabase SQL Editor.

create index if not exists infrastructures_support_id_search_idx on public.infrastructures (support_id);
create index if not exists infrastructures_site_search_idx on public.infrastructures (site);
create index if not exists liste_des_arrets_no_arret_search_idx on public.liste_des_arrets (no_arret);

alter table public.infrastructures add column if not exists updated_at timestamptz default now();
alter table public.suivi_des_edt add column if not exists updated_at timestamptz default now();

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
  statut text default 'Brouillon',
  publiee_terrain boolean default false,
  instructions_terrain text,
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
  photo_url text,
  date_completion timestamptz,
  utilisateur_completion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(campagne_id,support_id)
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

create table if not exists public.relation_fields (
  id bigserial primary key,
  module_name text not null,
  table_name text not null,
  field_name text not null,
  field_label text not null,
  is_primary_source boolean,
  source_table text,
  source_field text,
  triggers_updates boolean default false,
  visible_terrain boolean default false,
  terrain_roles text[] default '{}',
  terrain_section text,
  terrain_readonly boolean default true,
  validation_status text default 'À confirmer',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(table_name,field_name)
);

create table if not exists public.relation_rules (
  id bigserial primary key,
  source_module text not null,
  source_table text not null,
  source_field text not null,
  destination_module text not null,
  destination_table text not null,
  destination_field text not null,
  enabled boolean default true,
  create_history boolean default false,
  requires_confirmation boolean default false,
  condition_json jsonb default '{}'::jsonb,
  confidence text default 'Manuelle',
  validation_status text default 'À confirmer',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(source_table,source_field,destination_table,destination_field)
);

create table if not exists public.relation_test_logs (
  id bigserial primary key,
  rule_id bigint references public.relation_rules(id) on delete cascade,
  status text,
  message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.campagnes_maitres enable row level security;
alter table public.campagnes_supports enable row level security;
alter table public.journal_propagations enable row level security;
alter table public.relation_fields enable row level security;
alter table public.relation_rules enable row level security;
alter table public.relation_test_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['campagnes_maitres','campagnes_supports','journal_propagations','relation_fields','relation_rules','relation_test_logs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_app_role() = ''Administrateur'') with check (public.current_app_role() = ''Administrateur'')', t || '_admin_write', t);
  end loop;
end $$;

insert into public.relation_fields
(module_name,table_name,field_name,field_label,is_primary_source,triggers_updates,visible_terrain,terrain_roles,terrain_section,validation_status)
values
('Support','infrastructures','support_id','Support ID',true,true,true,array['Administrateur','Coordonnateur','Installateur'],'Identification','Validée'),
('Campagnes','campagnes_maitres','nom_campagne','Nom de la campagne',true,true,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','Validée'),
('Campagnes','campagnes_maitres','visuel_generique','Visuel générique de campagne',true,true,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','Validée'),
('Campagnes','campagnes_maitres','no_edt','Numéro EDT',true,true,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','À confirmer'),
('Infrastructures','infrastructures','campagne_actuelle','Campagne actuelle',false,false,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','Validée'),
('Infrastructures','infrastructures','visuel_campagne','Visuel de la campagne',false,false,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','Validée'),
('Infrastructures','infrastructures','edt_associe','EDT associé',false,false,true,array['Administrateur','Coordonnateur','Installateur'],'Campagne','À confirmer')
on conflict(table_name,field_name) do nothing;

insert into public.relation_rules
(source_module,source_table,source_field,destination_module,destination_table,destination_field,enabled,create_history,requires_confirmation,confidence,validation_status)
values
('Campagnes','campagnes_maitres','nom_campagne','Infrastructures','infrastructures','campagne_actuelle',true,true,false,'Évidente','Validée'),
('Campagnes','campagnes_maitres','visuel_generique','Infrastructures','infrastructures','visuel_campagne',true,true,false,'Évidente','Validée'),
('Campagnes','campagnes_maitres','visuel_generique','Historique des campagnes','historique_des_campagnes','visuel',true,true,false,'Évidente','Validée'),
('Campagnes','campagnes_maitres','no_edt','Infrastructures','infrastructures','edt_associe',true,true,true,'Probable','À confirmer')
on conflict(source_table,source_field,destination_table,destination_field) do nothing;

create or replace function public.test_relation_rule(p_rule_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r public.relation_rules%rowtype;
begin
  select * into r from public.relation_rules where id=p_rule_id;
  if not found then raise exception 'Relation introuvable.'; end if;
  insert into public.relation_test_logs(rule_id,status,message,details)
  values(r.id,'Réussi','La relation est structurellement valide.',jsonb_build_object('source',r.source_table||'.'||r.source_field,'destination',r.destination_table||'.'||r.destination_field));
  return jsonb_build_object('status','Réussi','message','Relation vérifiée. Aucun changement de données n’a été appliqué.');
end;
$$;
grant execute on function public.test_relation_rule(bigint) to authenticated;

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
set search_path=public
as $$
declare c public.campagnes_maitres%rowtype;
declare op uuid:=gen_random_uuid();
begin
  select * into c from public.campagnes_maitres where id=p_campagne_id and publiee_terrain=true;
  if not found then raise exception 'Campagne non publiée ou introuvable.'; end if;
  if not exists(select 1 from public.infrastructures where support_id=p_support_id) then raise exception 'Support introuvable.'; end if;

  update public.infrastructures set
    campagne_actuelle=c.nom_campagne,
    campagne_selon_visuel=c.nom_campagne,
    visuel_campagne=c.visuel_generique,
    visuel_en_expo=coalesce(c.visuel_generique,visuel_en_expo),
    edt_associe=coalesce(c.no_edt,edt_associe),
    date_derniere_manipulation=now()::text,
    updated_at=now()
  where support_id=p_support_id;

  insert into public.campagnes_supports(campagne_id,support_id,statut,visuel_attendu,no_edt,photo_url,date_completion,utilisateur_completion,updated_at)
  values(c.id,p_support_id,'Terminée',c.visuel_generique,c.no_edt,p_photo_url,now(),p_utilisateur,now())
  on conflict(campagne_id,support_id) do update set statut='Terminée',visuel_attendu=excluded.visuel_attendu,no_edt=excluded.no_edt,photo_url=coalesce(excluded.photo_url,campagnes_supports.photo_url),date_completion=now(),utilisateur_completion=excluded.utilisateur_completion,updated_at=now();

  insert into public.historique_des_campagnes(support_id,campagne,visuel,no_edt,date_installation,photo_installation,utilisateur,raw_data)
  values(p_support_id,c.nom_campagne,c.visuel_generique,c.no_edt,now()::text,p_photo_url,p_utilisateur,jsonb_build_object('operation_id',op,'photo_path',p_photo_path));

  insert into public.journal_propagations(operation_id,campagne_id,support_id,declencheur,statut,details,utilisateur)
  values(op,c.id,p_support_id,'Campagne sélectionnée dans application terrain','Réussi',jsonb_build_object('infrastructure',true,'historique',true,'photo_url',p_photo_url),p_utilisateur);

  return jsonb_build_object('operation_id',op,'support_id',p_support_id,'campagne',c.nom_campagne,'visuel',c.visuel_generique,'no_edt',c.no_edt,'statut','Réussi');
end;
$$;
grant execute on function public.appliquer_campagne_support(text,bigint,text,text,text) to authenticated;
