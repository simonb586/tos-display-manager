-- TOS Display Manager — Phase 13.1-A3
-- Configuration générale des champs en brouillon.
-- Migration additive : aucune table métier et aucune colonne physique métier ne sont modifiées.

begin;

create table if not exists public.relation_field_config_audit (
  id bigserial primary key,
  relation_field_id bigint not null,
  table_name text not null,
  field_name text not null,
  old_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  configuration_status text not null default 'draft'
    check (configuration_status = 'draft')
);

create index if not exists relation_field_config_audit_field_idx
  on public.relation_field_config_audit(relation_field_id, changed_at desc);

alter table public.relation_field_config_audit owner to postgres;
alter sequence public.relation_field_config_audit_id_seq owner to postgres;

revoke all on public.relation_field_config_audit from public, anon, authenticated;
revoke all on sequence public.relation_field_config_audit_id_seq from public, anon, authenticated;

create or replace function public.save_relation_field_general_draft_v0131a3(
  p_table_name text,
  p_field_name text,
  p_field_label text,
  p_field_type text,
  p_help_text text,
  p_display_order integer
)
returns public.relation_fields
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if auth.uid() is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if nullif(trim(p_table_name), '') is null or nullif(trim(p_field_name), '') is null then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.technical_name_locked, true) = false then
    raise exception 'Le nom technique doit demeurer verrouillé.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at', 'auth_user_id',
       'photo_principale_url', 'photo_miniature_url', 'visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if nullif(trim(p_field_label), '') is null or char_length(trim(p_field_label)) > 160 then
    raise exception 'Le libellé doit contenir entre 1 et 160 caractères.';
  end if;

  if p_field_type is null or p_field_type not in (
    'short_text', 'long_text', 'number', 'currency', 'date', 'datetime',
    'boolean', 'single_select', 'multi_select', 'photo', 'file',
    'relation', 'calculated'
  ) then
    raise exception 'Type fonctionnel invalide.';
  end if;

  if char_length(coalesce(p_help_text, '')) > 4000 then
    raise exception 'Le texte d''aide dépasse 4 000 caractères.';
  end if;

  if p_display_order is not null and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  v_old_values := jsonb_build_object(
    'field_label', v_old.field_label,
    'field_type', v_old.field_type,
    'help_text', v_old.help_text,
    'display_order', v_old.display_order,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set field_label = trim(p_field_label),
         field_type = p_field_type,
         help_text = nullif(trim(coalesce(p_help_text, '')), ''),
         display_order = p_display_order,
         configuration_status = 'draft',
         technical_name_locked = true,
         updated_at = now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := jsonb_build_object(
    'field_label', v_updated.field_label,
    'field_type', v_updated.field_type,
    'help_text', v_updated.help_text,
    'display_order', v_updated.display_order,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    auth.uid(),
    now(),
    'draft'
  );

  return v_updated;
end;
$$;

alter function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) owner to postgres;

revoke all on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) from public, anon;

grant execute on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) to authenticated;

comment on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) is 'Met à jour uniquement les métadonnées générales autorisées de relation_fields, force draft et journalise le changement.';

commit;
