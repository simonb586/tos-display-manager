-- V1.3.3 PREPARED ONLY. JAMAIS APPLIQUEE. Execution manuelle apres validation.
-- Additive et transactionnelle; aucune donnee historique n'est supprimee ou inventee.
begin;

-- Une phase par type et par EDT parent.
create unique index if not exists edt_phases_parent_type_v133_uq
  on public.edt_phases(edt_id,phase_type) where phase_type in ('installation','retrait');

-- Un support peut appartenir explicitement aux deux phases du meme EDT.
alter table public.edt_supports drop constraint if exists edt_supports_edt_id_support_id_key;
create unique index if not exists edt_supports_phase_support_v133_uq
  on public.edt_supports(phase_id,support_id) where phase_id is not null;
create unique index if not exists edt_supports_legacy_support_v133_uq
  on public.edt_supports(edt_id,support_id) where phase_id is null;

-- Le visuel vise zero ou une phase, jamais un numero libre.
alter table public.campagne_visuels_formats
  add column if not exists edt_phase_id bigint references public.edt_phases(id) on delete set null;
create index if not exists campagne_visuels_formats_phase_v133_idx
  on public.campagne_visuels_formats(edt_phase_id) where edt_phase_id is not null;

-- Un seul BT produit par phase par ce workflow.
alter table public.bons_de_travail add column if not exists phase_conversion_v133 boolean not null default false;
create unique index if not exists bons_de_travail_phase_v133_uq
  on public.bons_de_travail(phase_id) where phase_id is not null and phase_conversion_v133;

-- Relation normalisee requete Client <-> supports.
create table if not exists public.client_request_supports (
  request_id bigint not null references public.requetes_clients(id) on delete cascade,
  support_id text not null references public.infrastructures(support_id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key(request_id,support_id)
);
create index if not exists client_request_supports_support_v133_idx on public.client_request_supports(support_id,request_id);
alter table public.requetes_clients add column if not exists client_id bigint references public.clients(id) on delete restrict;
drop policy if exists "requetes_clients_read" on public.requetes_clients;
drop policy if exists requetes_clients_scoped_read_v133 on public.requetes_clients;
create policy requetes_clients_scoped_read_v133 on public.requetes_clients for select to authenticated using (
  public.current_app_role() in ('Administrateur','Coordonnateur') or client_id=(select u.client_id from public.utilisateurs u where u.auth_user_id=auth.uid() and u.statut='Actif' and u.role in ('Client','Client-Admin'))
);
alter table public.client_request_supports enable row level security;
revoke all on table public.client_request_supports from public,anon;
grant select on table public.client_request_supports to authenticated;
drop policy if exists client_request_supports_scoped_read_v133 on public.client_request_supports;
create policy client_request_supports_scoped_read_v133 on public.client_request_supports for select to authenticated using (
  public.current_app_role() in ('Administrateur','Coordonnateur') or exists (
    select 1 from public.requetes_clients r join public.utilisateurs u on u.auth_user_id=auth.uid()
    where r.id=request_id and r.client_id=u.client_id and u.statut='Actif' and u.role in ('Client','Client-Admin')
  )
);

-- Creation atomique: parent + Installation obligatoire + Retrait uniquement sur demande.
create or replace function public.creer_edt_v133(p_campagne_id bigint,p_no_edt text,p_date_installation date,p_creer_retrait boolean default false,p_date_retrait date default null,p_client text default null,p_priorite text default 'Normale',p_description text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.campagnes_maitres%rowtype;e public.suivi_des_edt%rowtype;i public.edt_phases%rowtype;r public.edt_phases%rowtype;v_no text;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 if p_date_installation is null then raise exception 'installation_date_required';end if;
 if p_creer_retrait and p_date_retrait is null then raise exception 'removal_date_required';end if;
 if p_date_retrait is not null and p_date_retrait<p_date_installation then raise exception 'removal_before_installation';end if;
 select * into c from public.campagnes_maitres where id=p_campagne_id;if not found then raise exception 'campaign_not_found';end if;
 v_no:=coalesce(nullif(trim(p_no_edt),''),'EDT-TOS-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));
 insert into public.suivi_des_edt(no_edt,nom,campagne_id,campagne,client,statut,priorite,date_debut,date_debut_prevue,lifecycle_status,description,updated_at)
 values(v_no,c.nom_campagne,c.id,c.nom_campagne,nullif(trim(p_client),''),'Planifie',coalesce(p_priorite,'Normale'),p_date_installation,p_date_installation::text,'planifie',nullif(trim(p_description),''),now()) returning * into e;
 insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,v_no||' Installation',1,'installation','planifiee',p_date_installation,0) returning * into i;
 if p_creer_retrait then insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,v_no||' Retrait',2,'retrait','planifie',p_date_retrait,0) returning * into r;end if;
 return jsonb_build_object('parent',to_jsonb(e),'installation',to_jsonb(i),'retrait',case when r.id is null then null else to_jsonb(r) end);
end $$;

-- Ajout ulterieur atomique et idempotence protegee par l'index unique.
create or replace function public.creer_phase_retrait_v133(p_edt_id bigint,p_date_retrait date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.suivi_des_edt%rowtype;i public.edt_phases%rowtype;r public.edt_phases%rowtype;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into e from public.suivi_des_edt where id=p_edt_id for update;if not found then raise exception 'edt_not_found';end if;
 select * into i from public.edt_phases where edt_id=e.id and phase_type='installation';if not found then raise exception 'installation_phase_missing';end if;
 if p_date_retrait is null then raise exception 'removal_date_required';end if;
 if p_date_retrait<i.date_debut_prevue then raise exception 'removal_before_installation';end if;
 insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,e.no_edt||' Retrait',2,'retrait','planifie',p_date_retrait,0) returning * into r;
 insert into public.edt_supports(edt_id,phase_id,support_id,statut,priorite,assigne_a,date_cible,progression,bloque,motif_blocage)
 select e.id,r.id,s.support_id,'Planifie',s.priorite,s.assigne_a,p_date_retrait,0,false,null from public.edt_supports s where s.edt_id=e.id and s.phase_id=i.id on conflict do nothing;
 return to_jsonb(r);
end $$;

-- Conversion atomique Phase -> BT, anti-doublon serveur, copie exacte des supports de phase.
create or replace function public.convertir_phase_en_bt_v133(p_phase_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;b public.bons_de_travail%rowtype;v_type text;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into p from public.edt_phases where id=p_phase_id for update;if not found or p.phase_type not in ('installation','retrait') then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;
 select * into b from public.bons_de_travail where phase_id=p.id and phase_conversion_v133;if found then return jsonb_build_object('created',false,'work_order',to_jsonb(b));end if;
 v_type:=case p.phase_type when 'installation' then 'Installation' else 'Retrait' end;
 insert into public.bons_de_travail(no_bt,type_bt,no_edt,edt_id,phase_id,phase_conversion_v133,priorite,statut,date_cible,client,description,updated_at)
 values('BT-'||e.no_edt||'-'||upper(left(p.phase_type,3)),v_type,e.no_edt,e.id,p.id,true,e.priorite,'A faire',p.date_debut_prevue,e.client,e.description,now()) returning * into b;
 update public.edt_supports set bon_de_travail_id=b.id,updated_at=now() where phase_id=p.id;
 return jsonb_build_object('created',true,'work_order',to_jsonb(b),'support_count',(select count(*) from public.edt_supports where phase_id=p.id));
exception when unique_violation then select * into b from public.bons_de_travail where phase_id=p_phase_id and phase_conversion_v133;return jsonb_build_object('created',false,'work_order',to_jsonb(b));
end $$;

-- Source canonique Module 15 par phase: supports, type et rapports restent separes.
create or replace function public.source_rapport_phase_v133(p_phase_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;
begin
 select * into p from public.edt_phases where id=p_phase_id;if not found then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;select * into c from public.campagnes_maitres where id=e.campagne_id;
 if public.current_app_role() in ('Client','Client-Admin') and not public.client_can_access_campaign_v120(c.id) then raise exception 'phase_client_scope_denied' using errcode='42501';end if;
 return jsonb_build_object('phase_id',p.id,'edt_id',e.id,'no_edt',e.no_edt,'phase_type',p.phase_type,'intervention_type',case p.phase_type when 'installation' then 'Installation' else 'Retrait' end,'status',p.statut,'scheduled_date',p.date_debut_prevue,'supports',(select coalesce(jsonb_agg(jsonb_build_object('assignment_id',s.id,'support_id',s.support_id,'status',s.statut) order by s.support_id),'[]') from public.edt_supports s where s.phase_id=p.id),'reports',(select coalesce(jsonb_agg(to_jsonb(r) order by r.version desc),'[]') from public.edt_phase_reports r where r.phase_id=p.id));
end $$;

-- Creation de requete multi-supports avec validation organisationnelle serveur.
create or replace function public.creer_requete_client_multi_supports_v133(p_type text,p_priorite text,p_description text,p_support_ids text[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u public.utilisateurs%rowtype;r public.requetes_clients%rowtype;v_ids text[];v_allowed text[];v_role text;
begin
 select * into u from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif';if not found then raise exception 'identity_denied' using errcode='42501';end if;v_role:=u.role;
 select coalesce(array_agg(distinct trim(x)),'{}') into v_ids from unnest(coalesce(p_support_ids,'{}')) x where trim(x)<>'';
 if cardinality(v_ids)=0 then raise exception 'supports_required';end if;
 if v_role in ('Client','Client-Admin') then
   if u.client_id is null then raise exception 'client_scope_denied' using errcode='42501';end if;
   select coalesce(array_agg(distinct cs.support_id),'{}') into v_allowed from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=any(v_ids) and c.client_id=u.client_id and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id);
 elsif v_role in ('Administrateur','Coordonnateur') then select coalesce(array_agg(i.support_id),'{}') into v_allowed from public.infrastructures i where i.support_id=any(v_ids);
 else raise exception 'permission_denied' using errcode='42501';end if;
 if cardinality(v_allowed)<>cardinality(v_ids) then raise exception 'cross_client_support_denied' using errcode='42501';end if;
 insert into public.requetes_clients(client_id,client,demandeur_nom,demandeur_courriel,type_requete,priorite,description,statut)
 values(u.client_id,u.client_id::text,u.nom,u.courriel,coalesce(p_type,'Installation'),coalesce(p_priorite,'Normale'),nullif(trim(p_description),''),'Nouvelle') returning * into r;
 insert into public.client_request_supports(request_id,support_id) select r.id,unnest(v_allowed);
 return jsonb_build_object('request_id',r.id,'support_count',cardinality(v_allowed));
end $$;

revoke all on function public.creer_edt_v133(bigint,text,date,boolean,date,text,text,text) from public,anon;
revoke all on function public.creer_phase_retrait_v133(bigint,date) from public,anon;
revoke all on function public.convertir_phase_en_bt_v133(bigint) from public,anon;
revoke all on function public.creer_requete_client_multi_supports_v133(text,text,text,text[]) from public,anon;
revoke all on function public.source_rapport_phase_v133(bigint) from public,anon;
grant execute on function public.creer_edt_v133(bigint,text,date,boolean,date,text,text,text) to authenticated;
grant execute on function public.creer_phase_retrait_v133(bigint,date) to authenticated;
grant execute on function public.convertir_phase_en_bt_v133(bigint) to authenticated;
grant execute on function public.creer_requete_client_multi_supports_v133(text,text,text,text[]) to authenticated;
grant execute on function public.source_rapport_phase_v133(bigint) to authenticated;

commit;
