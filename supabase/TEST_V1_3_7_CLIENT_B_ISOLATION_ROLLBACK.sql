-- Scénario transactionnel destructif-récupérable : termine toujours par ROLLBACK.
begin;
do $$declare v_client_b bigint;v_marker text:='CLIENT_B_ISOLATION_SENTINEL_V137';v_marylene uuid;v_result jsonb;
begin
 select auth_user_id into v_marylene from public.utilisateurs where client_id=2 and role='Client-Admin' and statut='Actif' and auth_user_id is not null order by id limit 1;
 if v_marylene is null then raise exception 'MARYLENE_ACTIVE_EXO_PROFILE_MISSING';end if;
 insert into public.clients(nom_client,type_client,statut)values(v_marker,'TEST','Actif')returning id into v_client_b;
 insert into public.infrastructures(support_id,site,type_support,emplacement_visibilite,client_id)values(v_marker,v_marker,'TEST',v_marker,v_client_b);
 perform set_config('request.jwt.claim.sub',v_marylene::text,true);
 select public.client_portal_list_v1362('supports',1,100,jsonb_build_object('search',v_marker))into v_result;
 if (v_result->>'total')::bigint<>0 or v_result::text like '%'||v_marker||'%' then raise exception 'CLIENT_B_LEAK_CLIENT_PORTAL';end if;
 if exists(select 1 from public.infrastructures where support_id=v_marker and client_id=2)then raise exception 'CLIENT_B_OWNERSHIP_CORRUPTION';end if;
 raise notice 'PASS Client B absent des recherches, pages, exports et carte fondés sur la projection serveur.';
end$$;
rollback;
