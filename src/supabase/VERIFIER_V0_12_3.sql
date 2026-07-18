select * from public.diagnostic_activation_v0123();
select courriel,nom,role,statut,invitation_statut,premiere_connexion_le,compte_active_le from public.utilisateurs order by nom nulls last,courriel;
