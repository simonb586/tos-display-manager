begin;
alter table public.campagnes_maitres add column if not exists business_context text not null default 'marketing';
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.campagnes_maitres'::regclass and conname='campagnes_maitres_business_context_v120_check') then
  alter table public.campagnes_maitres add constraint campagnes_maitres_business_context_v120_check check (business_context in ('marketing', 'operational_communication'));
 end if;
end $$;
-- Backfill historique ponctuel seulement. L'application ne classe jamais par le nom.
update public.campagnes_maitres set business_context='operational_communication',updated_at=now()
where lower(trim(nom_campagne))='exo info' and business_context is distinct from 'operational_communication';
create index if not exists campagnes_maitres_business_context_v120_idx on public.campagnes_maitres(business_context,statut,date_fin);
comment on column public.campagnes_maitres.business_context is 'Source de vérité Est lié à : marketing ou operational_communication.';
commit;
