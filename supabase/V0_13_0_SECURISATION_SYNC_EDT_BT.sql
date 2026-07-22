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

commit;
