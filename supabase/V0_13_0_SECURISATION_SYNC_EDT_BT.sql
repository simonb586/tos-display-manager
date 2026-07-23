-- TOS Display Manager v0.13.0
-- Sécurisation transactionnelle de la synchronisation EDT supports <-> bons de travail.
-- Cette migration remplace uniquement les fonctions et triggers de synchronisation v0.12.9.

begin;

create or replace function public.sync_edt_support_from_bt_v0129()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_progression integer;
  v_date_cible date;
  v_completed_at timestamptz;
begin
  if new.edt_support_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.edt_supports es
     where es.id = new.edt_support_id
       and es.edt_id is not distinct from new.edt_id
       and es.support_id is not distinct from new.support_id
  ) then
    raise exception
      'Lien BT incohérent: edt_support_id %, edt_id %, support_id %.',
      new.edt_support_id, new.edt_id, new.support_id;
  end if;

  v_statut := case
    when new.statut = 'Terminée' then 'Terminé'
    when new.statut = 'En cours' then 'En cours'
    when new.statut = 'Annulée' then 'Annulé'
    else 'Planifié'
  end;
  v_progression := case
    when new.statut = 'Terminée' then 100
    else coalesce(new.progression, 0)
  end;
  v_date_cible := public.tdm_try_date(new.date_cible::text);
  v_completed_at := case
    when new.statut = 'Terminée' then coalesce(new.date_fin_reelle, now())
    else null
  end;

  -- IS DISTINCT FROM traite correctement les NULL et évite une écriture qui
  -- redéclencherait inutilement les triggers de la table cible.
  update public.edt_supports es
     set statut = v_statut,
         progression = v_progression,
         assigne_a = coalesce(new.assigne_a, es.assigne_a),
         date_cible = coalesce(v_date_cible, es.date_cible),
         completed_at = v_completed_at,
         updated_at = now()
   where es.id = new.edt_support_id
     and es.edt_id is not distinct from new.edt_id
     and es.support_id is not distinct from new.support_id
     and (es.statut,
          es.progression,
          es.assigne_a,
          es.date_cible,
          es.completed_at)
         is distinct from
         (v_statut,
          v_progression,
          coalesce(new.assigne_a, es.assigne_a),
          coalesce(v_date_cible, es.date_cible),
          v_completed_at);

  if new.edt_id is not null then
    perform public.refresh_edt_enterprise(new.edt_id);
  end if;
  return new;
end;
$$;

create or replace function public.sync_bt_from_edt_support_v0129()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bt_statut text;
begin
  if new.bon_de_travail_id is null then
    return new;
  end if;

  v_bt_statut := case
    when new.statut in ('Terminé','Terminée','Complété','Complétée') then 'Terminée'
    when new.statut = 'En cours' then 'En cours'
    when new.statut = 'Annulé' then 'Annulée'
    else 'À faire'
  end;

  update public.bons_de_travail bt
     set phase_id = new.phase_id,
         assigne_a = new.assigne_a,
         priorite = new.priorite,
         date_cible = new.date_cible::text,
         progression = new.progression,
         statut = v_bt_statut,
         updated_at = now()
   where bt.id = new.bon_de_travail_id
     and (bt.phase_id,
          bt.assigne_a,
          bt.priorite,
          bt.date_cible,
          bt.progression,
          bt.statut)
         is distinct from
         (new.phase_id,
          new.assigne_a,
          new.priorite,
          new.date_cible::text,
          new.progression,
          v_bt_statut);

  perform public.refresh_edt_enterprise(new.edt_id);
  return new;
end;
$$;

-- Les triggers INSERT et UPDATE sont séparés : OLD n'est ainsi référencé que
-- dans une clause WHEN d'UPDATE, ce qui est valide en PostgreSQL.
drop trigger if exists sync_edt_support_from_bt_v0129 on public.bons_de_travail;
drop trigger if exists sync_edt_support_from_bt_v013_insert on public.bons_de_travail;
drop trigger if exists sync_edt_support_from_bt_v013_update on public.bons_de_travail;

create trigger sync_edt_support_from_bt_v013_insert
after insert on public.bons_de_travail
for each row
when (new.edt_support_id is not null)
execute function public.sync_edt_support_from_bt_v0129();

create trigger sync_edt_support_from_bt_v013_update
after update of edt_support_id, edt_id, statut, progression, assigne_a, date_cible, date_fin_reelle
on public.bons_de_travail
for each row
when (
  new.edt_support_id is not null
  and (
    old.edt_support_id is distinct from new.edt_support_id
    or old.edt_id is distinct from new.edt_id
    or old.statut is distinct from new.statut
    or old.progression is distinct from new.progression
    or old.assigne_a is distinct from new.assigne_a
    or old.date_cible is distinct from new.date_cible
    or old.date_fin_reelle is distinct from new.date_fin_reelle
  )
)
execute function public.sync_edt_support_from_bt_v0129();

drop trigger if exists sync_bt_from_edt_support_v0129 on public.edt_supports;
drop trigger if exists sync_bt_from_edt_support_v013 on public.edt_supports;

create trigger sync_bt_from_edt_support_v013
after update of bon_de_travail_id, phase_id, assigne_a, priorite, date_cible, progression, statut
on public.edt_supports
for each row
when (
  new.bon_de_travail_id is not null
  and (
    old.bon_de_travail_id is distinct from new.bon_de_travail_id
    or old.phase_id is distinct from new.phase_id
    or old.assigne_a is distinct from new.assigne_a
    or old.priorite is distinct from new.priorite
    or old.date_cible is distinct from new.date_cible
    or old.progression is distinct from new.progression
    or old.statut is distinct from new.statut
  )
)
execute function public.sync_bt_from_edt_support_v0129();

-- Cycle de vie canonique : edt_supports porte l'état opérationnel du support.
-- Les valeurs dérivées (progression, blocage et date de fin) sont normalisées
-- avant toute propagation vers un BT.
create or replace function public.normaliser_edt_support_v013()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.progression := greatest(0, least(100, coalesce(new.progression, 0)));

  if new.statut in ('Terminé','Terminée','Complété','Complétée') then
    new.statut := 'Terminé';
    new.progression := 100;
    new.bloque := false;
    new.motif_blocage := null;
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.statut = 'Bloqué' or new.bloque then
    new.statut := 'Bloqué';
    new.bloque := true;
    new.completed_at := null;
  else
    new.bloque := false;
    new.motif_blocage := null;
    new.completed_at := null;
    if new.statut in ('Annulé','Annulée') then
      new.statut := 'Annulé';
    elsif new.progression > 0 then
      new.statut := 'En cours';
    else
      new.statut := 'Planifié';
    end if;
  end if;

  if new.phase_id is not null and not exists (
    select 1 from public.edt_phases p
     where p.id = new.phase_id and p.edt_id = new.edt_id
  ) then
    raise exception 'La phase % n''appartient pas à l''EDT %.', new.phase_id, new.edt_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists normaliser_edt_support_v013 on public.edt_supports;
create trigger normaliser_edt_support_v013
before insert or update of edt_id, phase_id, statut, progression, bloque, motif_blocage, completed_at
on public.edt_supports
for each row execute function public.normaliser_edt_support_v013();

-- Recalcul déterministe depuis la source de vérité. Cette redéfinition corrige
-- notamment la réouverture d'un EDT auparavant terminé.
create or replace function public.refresh_edt_enterprise(p_edt_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_planifies integer := 0;
  v_en_cours integer := 0;
  v_bloques integer := 0;
  v_termines integer := 0;
  v_progression integer := 0;
begin
  if not exists (select 1 from public.suivi_des_edt where id = p_edt_id) then
    raise exception 'EDT % introuvable.', p_edt_id;
  end if;

  select count(*)::integer,
         count(*) filter (where statut = 'Planifié')::integer,
         count(*) filter (where statut = 'En cours')::integer,
         count(*) filter (where statut = 'Bloqué' or bloque)::integer,
         count(*) filter (where statut = 'Terminé')::integer,
         coalesce(round(avg(case when statut = 'Terminé' then 100 else progression end)),0)::integer
    into v_total, v_planifies, v_en_cours, v_bloques, v_termines, v_progression
    from public.edt_supports
   where edt_id = p_edt_id and statut <> 'Annulé';

  update public.edt_phases p
     set progression = x.progression,
         statut = x.statut,
         updated_at = now()
    from (
      select phase.id,
             coalesce(round(avg(case when es.statut = 'Terminé' then 100 else es.progression end)),0)::integer progression,
             case
               when count(es.id) = 0 then phase.statut
               when count(es.id) filter (where es.statut <> 'Terminé') = 0 then 'Terminée'
               when count(es.id) filter (where es.statut = 'Bloqué') > 0 then 'Bloquée'
               when max(es.progression) > 0 then 'En cours'
               else 'À faire'
             end statut
        from public.edt_phases phase
        left join public.edt_supports es
          on es.phase_id = phase.id and es.statut <> 'Annulé'
       where phase.edt_id = p_edt_id
       group by phase.id
    ) x
   where p.id = x.id
     and (p.progression, p.statut) is distinct from (x.progression, x.statut);

  update public.suivi_des_edt e
     set supports_prevus = v_total,
         supports_cibles = v_total,
         supports_planifies = v_planifies,
         supports_en_cours = v_en_cours,
         supports_bloques = v_bloques,
         supports_termines = v_termines,
         supports_installes = v_termines,
         supports_completes = v_termines,
         progression = v_progression,
         avancement = v_progression,
         statut = case
           when v_total > 0 and v_termines = v_total then 'Terminé'
           when v_bloques > 0 then 'Bloqué'
           when v_en_cours > 0 or v_termines > 0 then 'En cours'
           when v_total > 0 then 'Planifié'
           else e.statut
         end,
         date_fin = case
           when v_total > 0 and v_termines = v_total then coalesce(e.date_fin, current_date)
           else null
         end,
         derniere_synchro = now(),
         updated_at = now()
   where e.id = p_edt_id;

  return jsonb_build_object(
    'ok', true, 'source_de_verite', 'edt_supports', 'edt_id', p_edt_id,
    'supports_total', v_total, 'planifies', v_planifies,
    'en_cours', v_en_cours, 'bloques', v_bloques,
    'termines', v_termines, 'progression', v_progression
  );
end;
$$;

-- Diagnostic sans écriture. Une ligne représente une incohérence réparable ou
-- un risque demandant une décision humaine.
create or replace function public.diagnostiquer_integrite_edt_v013(p_edt_id bigint default null)
returns table(
  code text, severite text, edt_id bigint, edt_support_id bigint,
  bon_de_travail_id bigint, support_id text, details jsonb
)
language sql
security definer
set search_path = public
as $$
  select 'BT_MANQUANT', 'avertissement', es.edt_id, es.id, null::bigint, es.support_id,
         jsonb_build_object('action_proposee','creer_bt')
    from public.edt_supports es
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and es.bon_de_travail_id is null and es.statut <> 'Annulé'
  union all
  select 'LIEN_BT_ASYMETRIQUE', 'critique', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('bt_edt_support_id',bt.edt_support_id,'action_proposee','retablir_lien')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and bt.edt_support_id is distinct from es.id
  union all
  select 'IDENTITE_BT_INCOHERENTE', 'critique', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('bt_edt_id',bt.edt_id,'bt_support_id',bt.support_id,'action_proposee','aligner_bt')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.edt_id is distinct from es.edt_id or bt.support_id is distinct from es.support_id)
  union all
  select 'ETAT_BT_DIVERGENT', 'avertissement', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('edt_statut',es.statut,'bt_statut',bt.statut,
           'edt_progression',es.progression,'bt_progression',bt.progression,
           'action_proposee','synchroniser_depuis_edt_supports')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.progression is distinct from es.progression or
          bt.statut is distinct from case es.statut
            when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
            when 'Annulé' then 'Annulée' else 'À faire' end)
  union all
  select 'PHASE_HORS_EDT', 'critique', es.edt_id, es.id, es.bon_de_travail_id, es.support_id,
         jsonb_build_object('phase_id',es.phase_id,'action_proposee','retirer_phase')
    from public.edt_supports es
    join public.edt_phases p on p.id = es.phase_id
   where (p_edt_id is null or es.edt_id = p_edt_id) and p.edt_id <> es.edt_id
  order by 2, 1, 3, 4;
$$;

-- Réparation contrôlée. p_apply=false ne modifie rien et retourne uniquement
-- le nombre d'actions proposées. L'application exige un administrateur.
create or replace function public.reparer_integrite_edt_v013(
  p_edt_id bigint default null,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issues integer;
  v_updated integer := 0;
  v_id bigint;
begin
  select count(*) into v_issues
    from public.diagnostiquer_integrite_edt_v013(p_edt_id);

  if not p_apply then
    return jsonb_build_object(
      'ok', true, 'dry_run', true, 'source_de_verite', 'edt_supports',
      'edt_id', p_edt_id, 'actions_proposees', v_issues
    );
  end if;

  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Validation Administrateur obligatoire pour appliquer une réparation.';
  end if;

  update public.bons_de_travail bt
     set edt_support_id = es.id, edt_id = es.edt_id, support_id = es.support_id,
         phase_id = es.phase_id, assigne_a = es.assigne_a, priorite = es.priorite,
         date_cible = es.date_cible::text, progression = es.progression,
         statut = case es.statut
           when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
           when 'Annulé' then 'Annulée' else 'À faire' end,
         updated_at = now()
    from public.edt_supports es
   where bt.id = es.bon_de_travail_id
     and (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.edt_support_id,bt.edt_id,bt.support_id,bt.phase_id,bt.assigne_a,
          bt.priorite,bt.date_cible,bt.progression,bt.statut)
         is distinct from
         (es.id,es.edt_id,es.support_id,es.phase_id,es.assigne_a,
          es.priorite,es.date_cible::text,es.progression,
          case es.statut when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
            when 'Annulé' then 'Annulée' else 'À faire' end);
  get diagnostics v_updated = row_count;

  for v_id in select distinct es.edt_id from public.edt_supports es
    where p_edt_id is null or es.edt_id = p_edt_id
  loop
    perform public.refresh_edt_enterprise(v_id);
  end loop;

  return jsonb_build_object(
    'ok', true, 'dry_run', false, 'source_de_verite', 'edt_supports',
    'edt_id', p_edt_id, 'issues_avant', v_issues, 'lignes_reparees', v_updated
  );
end;
$$;

revoke all on function public.diagnostiquer_integrite_edt_v013(bigint) from public;
revoke all on function public.reparer_integrite_edt_v013(bigint,boolean) from public;
grant execute on function public.diagnostiquer_integrite_edt_v013(bigint) to authenticated;
grant execute on function public.reparer_integrite_edt_v013(bigint,boolean) to authenticated;

commit;
