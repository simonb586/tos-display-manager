-- À exécuter séparément, uniquement après validation du dry-run. Transactionnel et idempotent.
begin;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,old_value,new_value,source,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,utilisateur,action,coalesce(table_concernee,'Journal'),'historical_event',id::text,to_jsonb(ancienne_valeur),to_jsonb(nouvelle_valeur),'journal_des_evenements',raw_data,'journal_des_evenements',id::text,created_at,'direct','exact' from public.journal_des_evenements
where action is not null and table_concernee is not null
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,old_value,new_value,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,user_id,user_email,action,'Opérations',entity_type,coalesce(entity_id,entity_reference),old_data,new_data,'operations_history',null,jsonb_build_object('details',details,'reference',entity_reference),'operations_history',id::text,created_at,'direct','exact' from public.operations_history
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,campaign_id,edt_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,utilisateur,etape,'Terrain','terrain_sync',reference,details->>'campagne_id',details->>'edt',support_id,'terrain_sync_diagnostics',statut,details,'terrain_sync_diagnostics',id::text,created_at,'direct','exact' from public.terrain_sync_diagnostics
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,utilisateur,type_operation,'Terrain','terrain_operation',reference,support_id,'terrain_operations',statut,details||jsonb_build_object('etape',etape,'erreur',erreur,'completed_at',completed_at),'terrain_operations',id::text,created_at,'direct','exact' from public.terrain_operations
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_id,action,module,entity_type,entity_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,user_id,action,'Photos','photo',photo_id,support_id,'photo_action_log',details->>'resultat',details||jsonb_build_object('nom_fichier',nom_fichier),'photo_action_log',id::text,created_at,'direct','exact' from public.photo_action_log
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,campaign_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,utilisateur,declencheur,'Campagnes','propagation',operation_id::text,campagne_id::text,support_id,'journal_propagations',statut,details,'journal_propagations',id::text,created_at,'direct','exact' from public.journal_propagations
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_id,action,module,entity_type,entity_id,old_value,new_value,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select changed_at,changed_by,'configuration_modifiee','Gestionnaire des champs','relation_field',relation_field_id::text,old_values,new_values,'relation_field_config_audit',configuration_status,jsonb_build_object('table_name',table_name,'field_name',field_name),'relation_field_config_audit',id::text,changed_at,'direct','exact' from public.relation_field_config_audit
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,campaign_id,edt_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select coalesce(prise_le,created_at),utilisateur,'photo_ajoutee','Photos','photo',id::text,campagne_id::text,null,support_id,'support_photos',statut_validation,jsonb_build_object('type_photo',type_photo,'nom_fichier',nom_fichier,'visuel_id',visuel_id),'support_photos',id::text,coalesce(prise_le,created_at),'derived','derived' from public.support_photos where coalesce(prise_le,created_at) is not null
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,campaign_id,edt_id,support_id,source,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,utilisateur,'campagne_enregistree','Campagnes','campaign_history',id::text,campagne,no_edt,support_id,'historique_des_campagnes',raw_data||jsonb_build_object('visuel',visuel,'date_installation',date_installation,'date_retrait',date_retrait),'historique_des_campagnes',id::text,created_at,'derived','derived' from public.historique_des_campagnes
where created_at is not null and support_id is not null and coalesce(campagne,visuel,no_edt) is not null
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,edt_id,support_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,assigne_a,'edt_support_enregistre','EDT','edt_support',id::text,edt_id::text,support_id,'edt_supports',statut,to_jsonb(edt_supports)-'id','edt_supports',id::text,created_at,'derived','derived' from public.edt_supports
where created_at is not null and support_id is not null and edt_id is not null
on conflict(source_system,source_record_id) do nothing;
insert into public.activity_events(occurred_at,actor_email,action,module,entity_type,entity_id,campaign_id,edt_id,client_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
select created_at,coordonnateur,'edt_enregistre','EDT','edt',id::text,campagne,no_edt,client,'suivi_des_edt',statut,raw_data,'suivi_des_edt',id::text,created_at,'derived','derived' from public.suivi_des_edt
where created_at is not null and no_edt is not null
on conflict(source_system,source_record_id) do nothing;
commit;
