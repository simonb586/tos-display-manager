begin;
do $$
declare v_owner uuid;v_conflicts integer;
begin
 select auth_user_id into v_owner from public.utilisateurs where statut='Actif' and role='Administrateur' and auth_user_id is not null order by id limit 1;
 if v_owner is null then raise exception 'TOS_AUTOMATION_SEED_NO_ADMIN_OWNER';end if;
 select count(*) into v_conflicts from public.automation_definitions where lower(trim(name)) in(
  'installation d’un visuel','retrait d’un visuel','inspection','déclaration d’un enjeu','création d’edt','modification d’un edt','bon de travail terminé','réouverture d’un bt','nouvelle campagne','changement de campagne','téléversement d’une photo','suppression d’une photo','nouvelle requête client','inventaire faible','mise à jour du prochain edt')
  and id not in(select id from (values
   ('13900000-0000-4000-8000-000000000001'::uuid),('13900000-0000-4000-8000-000000000002'::uuid),('13900000-0000-4000-8000-000000000003'::uuid),('13900000-0000-4000-8000-000000000004'::uuid),('13900000-0000-4000-8000-000000000005'::uuid),('13900000-0000-4000-8000-000000000006'::uuid),('13900000-0000-4000-8000-000000000007'::uuid),('13900000-0000-4000-8000-000000000008'::uuid),('13900000-0000-4000-8000-000000000009'::uuid),('13900000-0000-4000-8000-000000000010'::uuid),('13900000-0000-4000-8000-000000000011'::uuid),('13900000-0000-4000-8000-000000000012'::uuid),('13900000-0000-4000-8000-000000000013'::uuid),('13900000-0000-4000-8000-000000000014'::uuid),('13900000-0000-4000-8000-000000000015'::uuid))x(id));
 if v_conflicts<>0 then raise exception 'TOS_AUTOMATION_SEED_NAME_CONFLICTS:%',v_conflicts;end if;

 alter table public.automation_definitions disable trigger prepare_automation_definition_v0131;
 insert into public.automation_definitions(id,name,status,priority,definition,schema_version,created_by,updated_by,approved_by,approved_at)
 select id,name,'active','normal',jsonb_build_object('kind','automation','template_key',template_key,'system_template',true,'configuration_only',true,'description',description,'triggers',jsonb_build_array(trigger_key),'locations',jsonb_build_array('admin_portal'),'targets',(select jsonb_agg(jsonb_build_object('module',m,'fields','[]'::jsonb)) from unnest(modules)m),'actions',to_jsonb(actions),'conditions',to_jsonb(conditions),'afterActions',jsonb_build_array('show_confirmation','append_history'),'notifications','[]'::jsonb),1,v_owner,v_owner,v_owner,now()
 from(values
 ('13900000-0000-4000-8000-000000000001'::uuid,'visual-install','Installation d’un visuel','Prépare les étapes de suivi après une installation terrain.','installation_completed',array['infrastructures','campaign_history'],array['Mettre à jour le visuel actif','Ajouter l’intervention à l’historique'],array['active_support']),
 ('13900000-0000-4000-8000-000000000002'::uuid,'visual-removal','Retrait d’un visuel','Prépare la mise à jour du support après le retrait d’un visuel.','data_removed',array['infrastructures','campaign_history'],array['Archiver le visuel précédent','Mettre à jour la fiche du support'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000003'::uuid,'inspection','Inspection','Centralise les suites à donner après une inspection.','inspection_completed',array['inspections','infrastructures'],array['Consigner le résultat','Planifier la prochaine inspection'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000004'::uuid,'issue','Déclaration d’un enjeu','Prépare le suivi et les avis associés à un nouvel enjeu.','issue_reported',array['issues','notifications'],array['Créer le suivi','Aviser les responsables'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000005'::uuid,'edt-create','Création d’EDT','Prépare le suivi d’un nouvel EDT.','edt_started',array['edt'],array['Initialiser le suivi'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000006'::uuid,'edt-update','Modification d’un EDT','Harmonise les informations liées lorsqu’un EDT change.','data_updated',array['edt','work_orders'],array['Mettre à jour les éléments concernés'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000007'::uuid,'workorder-complete','Bon de travail terminé','Prépare la clôture et la traçabilité du bon de travail.','data_updated',array['work_orders','campaign_history'],array['Consigner la date de fin','Ajouter au suivi'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000008'::uuid,'workorder-reopen','Réouverture d’un BT','Prépare la reprise d’un bon de travail.','data_updated',array['work_orders'],array['Réactiver le suivi'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000009'::uuid,'campaign-new','Nouvelle campagne','Prépare les activités associées à une nouvelle campagne.','campaign_selected',array['campaigns','visuals'],array['Préparer les visuels'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000010'::uuid,'campaign-change','Changement de campagne','Prépare le remplacement coordonné d’une campagne.','campaign_selected',array['campaigns','infrastructures'],array['Actualiser les supports concernés'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000011'::uuid,'photo-upload','Téléversement d’une photo','Prépare le classement d’une nouvelle photo.','photo_taken',array['photos'],array['Classer la photo','Actualiser la miniature'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000012'::uuid,'photo-delete','Suppression d’une photo','Prépare la traçabilité après une suppression autorisée.','data_removed',array['photos'],array['Actualiser la galerie','Consigner l’action'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000013'::uuid,'client-request','Nouvelle requête client','Prépare le traitement d’une nouvelle demande client.','data_updated',array['work_orders','notifications'],array['Créer le suivi','Aviser le coordonnateur'],array[]::text[]),
 ('13900000-0000-4000-8000-000000000014'::uuid,'low-inventory','Inventaire faible','Prépare un avis lorsque le seuil minimal est atteint.','data_updated',array['poster_inventory','notifications'],array['Créer un avis'],array['non_empty_value']),
 ('13900000-0000-4000-8000-000000000015'::uuid,'next-edt','Mise à jour du prochain EDT','Actualise l’information opérationnelle du prochain EDT.','data_updated',array['edt','infrastructures'],array['Actualiser le prochain EDT'],array[]::text[])
 )v(id,template_key,name,description,trigger_key,modules,actions,conditions)
 on conflict(id) do nothing;
 alter table public.automation_definitions enable trigger prepare_automation_definition_v0131;
 if (select count(*) from public.automation_definitions where definition->>'system_template'='true')<>15 then raise exception 'TOS_AUTOMATION_SEED_COUNT_MISMATCH';end if;
end$$;
commit;
