alter table public.utilisateurs add column if not exists premiere_connexion_le timestamptz;
alter table public.utilisateurs add column if not exists compte_active_le timestamptz;

create or replace function public.mark_current_user_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.utilisateurs
  set statut='Actif', invitation_statut='Compte activé', premiere_connexion_le=coalesce(premiere_connexion_le,now()), compte_active_le=coalesce(compte_active_le,now()), derniere_activite_le=now(), updated_at=now()
  where auth_user_id=auth.uid() or lower(courriel)=lower(auth.jwt()->>'email');
end;
$$;
grant execute on function public.mark_current_user_active() to authenticated;

create or replace function public.diagnostic_activation_v0123()
returns table(invitations_en_attente bigint, comptes_actives bigint, utilisateurs_jamais_connectes bigint)
language sql security definer set search_path=public as $$
select
 (select count(*) from public.utilisateurs where invitation_statut='Invitation envoyée'),
 (select count(*) from public.utilisateurs where invitation_statut='Compte activé' or premiere_connexion_le is not null),
 (select count(*) from public.utilisateurs where premiere_connexion_le is null);
$$;
grant execute on function public.diagnostic_activation_v0123() to authenticated;
