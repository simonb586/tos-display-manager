select * from public.diagnostic_rapports_v09();

select id, numero_edt, campagne, client, destinataires, statut, created_at
from public.communications_finales
order by created_at desc
limit 20;

select id, statut, rapport_final_envoye, rapport_final_path
from public.suivi_des_edt
where rapport_final_envoye = true
limit 20;
