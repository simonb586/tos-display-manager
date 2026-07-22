-- Vérification transactionnelle de la synchronisation EDT supports <-> BT.
-- Exécuter après V0_13_0_SECURISATION_SYNC_EDT_BT.sql.
--
-- Toutes les lignes manipulées sont synthétiques et identifiées par un suffixe
-- unique fondé sur l'identifiant de transaction. Le ROLLBACK final annule les
-- lignes et changements transactionnels. PostgreSQL ne restaure toutefois pas
-- les valeurs consommées par les séquences (y compris celles de l'audit) : les
-- prochains identifiants peuvent donc avancer après ce test, sans ligne résiduelle.

begin;

do $$
declare
  v_suffix text := txid_current()::text;
  v_no_edt text;
  v_support_id text;
  v_bt_no text;
  v_rpc_support_id text;
  v_rpc_bt_no text;
  v_test_email text;
  v_auth_user_id uuid;
  v_edt_id bigint;
  v_edt_support_id bigint;
  v_bt_id bigint;
  v_rpc_edt_support_id bigint;
  v_rpc_bt_id bigint;
  v_trigger_count integer;
begin
  v_no_edt := 'EDT-TEST-SYNC-V013-' || v_suffix;
  v_support_id := 'SUPPORT-TEST-SYNC-V013-' || v_suffix;
  v_bt_no := 'BT-TEST-SYNC-V013-' || v_suffix;
  v_rpc_support_id := 'SUPPORT-TEST-RPC-V013-' || v_suffix;
  v_rpc_bt_no := 'BT-TEST-RPC-V013-' || v_suffix;
  v_test_email := 'test-sync-v013-' || v_suffix || '@example.invalid';
  v_auth_user_id := md5('tdm-sync-v013-' || v_suffix)::uuid;

  -- Identité synthétique utilisée uniquement pour satisfaire le contrôle de rôle
  -- de retirer_support_edt_v0129(). Les claims sont locaux à la transaction.
  insert into public.utilisateurs(nom, courriel, role, statut, auth_user_id, updated_at)
  values ('Test Sync V013 ' || v_suffix, v_test_email, 'Administrateur', 'Actif', v_auth_user_id, now());
  perform set_config('request.jwt.claim.sub', v_auth_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_auth_user_id::text, 'role', 'authenticated')::text,
    true
  );

  -- EDT et infrastructures entièrement synthétiques : aucune donnée métier
  -- existante n'est sélectionnée ni modifiée par le vérificateur.
  insert into public.suivi_des_edt(no_edt, nom, statut, progression, updated_at)
  values (v_no_edt, 'EDT synthétique ' || v_suffix, 'Planifié', 0, now())
  returning id into v_edt_id;

  insert into public.infrastructures(support_id, prochain_edt_cible, updated_at)
  values (v_support_id, v_no_edt, now());
  insert into public.infrastructures(support_id, prochain_edt_cible, updated_at)
  values (v_rpc_support_id, v_no_edt, now());

  -- 1. Insertion d'une affectation edt_supports et de son BT synthétique.
  insert into public.edt_supports(
    edt_id, support_id, statut, priorite, progression, updated_at
  ) values (
    v_edt_id, v_support_id, 'Planifié', 'Normale', 0, now()
  ) returning id into v_edt_support_id;

  insert into public.bons_de_travail(
    no_bt, type_bt, support_id, no_edt, edt_id, edt_support_id,
    priorite, statut, progression, updated_at
  ) values (
    v_bt_no, 'Installation', v_support_id, v_no_edt, v_edt_id,
    v_edt_support_id, 'Normale', 'À faire', 0, now()
  ) returning id into v_bt_id;

  update public.edt_supports
     set bon_de_travail_id = v_bt_id
   where id = v_edt_support_id;

  -- 2. Mise à jour de progression depuis edt_supports vers le BT.
  update public.edt_supports set progression = 40 where id = v_edt_support_id;
  if (select progression from public.bons_de_travail where id = v_bt_id) is distinct from 40 then
    raise exception 'TEST 2 ÉCHEC: progression EDT support non propagée au BT.';
  end if;

  -- 3. Mise à jour du statut depuis edt_supports vers le BT.
  update public.edt_supports
     set statut = 'Terminé', progression = 100
   where id = v_edt_support_id;
  if (select statut from public.bons_de_travail where id = v_bt_id) is distinct from 'Terminée' then
    raise exception 'TEST 3 ÉCHEC: statut EDT support non propagé au BT.';
  end if;

  -- 4. Modification du BT lié vers edt_supports. L'absence de stack overflow
  -- pendant ces mises à jour croisées prouve que la chaîne converge sans boucle.
  update public.bons_de_travail
     set statut = 'En cours', progression = 55, assigne_a = v_test_email,
         date_cible = '2099-12-31'
   where id = v_bt_id;
  if not exists (
    select 1 from public.edt_supports
     where id = v_edt_support_id
       and statut is not distinct from 'En cours'
       and progression is not distinct from 55
       and assigne_a is not distinct from v_test_email
       and date_cible is not distinct from date '2099-12-31'
  ) then
    raise exception 'TEST 4 ÉCHEC: modification BT non propagée à EDT support.';
  end if;

  -- 5. Retrait direct : la FK conserve le BT et remet son lien à NULL.
  delete from public.edt_supports where id = v_edt_support_id;
  if exists (select 1 from public.edt_supports where id = v_edt_support_id) then
    raise exception 'TEST 5 ÉCHEC: affectation synthétique non supprimée.';
  end if;
  if (select edt_support_id from public.bons_de_travail where id = v_bt_id) is not null then
    raise exception 'TEST 5 ÉCHEC: lien BT non remis à NULL par la FK.';
  end if;

  -- 6. Test distinct de la RPC métier de retrait avec une seconde paire
  -- entièrement synthétique. Le statut À faire autorise la suppression du BT.
  insert into public.edt_supports(
    edt_id, support_id, statut, priorite, progression, updated_at
  ) values (
    v_edt_id, v_rpc_support_id, 'Planifié', 'Normale', 0, now()
  ) returning id into v_rpc_edt_support_id;

  insert into public.bons_de_travail(
    no_bt, type_bt, support_id, no_edt, edt_id, edt_support_id,
    priorite, statut, progression, updated_at
  ) values (
    v_rpc_bt_no, 'Installation', v_rpc_support_id, v_no_edt, v_edt_id,
    v_rpc_edt_support_id, 'Normale', 'À faire', 0, now()
  ) returning id into v_rpc_bt_id;
  update public.edt_supports
     set bon_de_travail_id = v_rpc_bt_id
   where id = v_rpc_edt_support_id;

  perform public.retirer_support_edt_v0129(v_edt_id, v_rpc_support_id);
  if exists (select 1 from public.edt_supports where id = v_rpc_edt_support_id) then
    raise exception 'TEST 6 ÉCHEC: la RPC n''a pas supprimé l''affectation.';
  end if;
  if exists (select 1 from public.bons_de_travail where id = v_rpc_bt_id) then
    raise exception 'TEST 6 ÉCHEC: la RPC n''a pas supprimé le BT À faire.';
  end if;
  if (select prochain_edt_cible from public.infrastructures where support_id = v_rpc_support_id) is not null then
    raise exception 'TEST 6 ÉCHEC: la RPC n''a pas libéré prochain_edt_cible.';
  end if;

  -- 7. Vérification structurelle : relation, fonction, état et définition de
  -- chaque trigger sont contrôlés, en plus de leur nom.
  select count(*)::integer
    into v_trigger_count
    from pg_trigger t
   where not t.tgisinternal
     and t.tgenabled <> 'D'
     and (
       (t.tgname = 'sync_edt_support_from_bt_v013_insert'
        and t.tgrelid = 'public.bons_de_travail'::regclass
        and t.tgfoid = 'public.sync_edt_support_from_bt_v0129()'::regprocedure
        and pg_get_triggerdef(t.oid) ilike '%AFTER INSERT ON public.bons_de_travail%')
       or
       (t.tgname = 'sync_edt_support_from_bt_v013_update'
        and t.tgrelid = 'public.bons_de_travail'::regclass
        and t.tgfoid = 'public.sync_edt_support_from_bt_v0129()'::regprocedure
        and pg_get_triggerdef(t.oid) ilike '%AFTER UPDATE%ON public.bons_de_travail%')
       or
       (t.tgname = 'sync_bt_from_edt_support_v013'
        and t.tgrelid = 'public.edt_supports'::regclass
        and t.tgfoid = 'public.sync_bt_from_edt_support_v0129()'::regprocedure
        and pg_get_triggerdef(t.oid) ilike '%AFTER UPDATE%ON public.edt_supports%')
     );
  if v_trigger_count <> 3 then
    raise exception 'TEST 7 ÉCHEC: triggers v0.13 valides attendus %, trouvés %.', 3, v_trigger_count;
  end if;
  if exists (
    select 1 from pg_trigger t
     where not t.tgisinternal
       and (
         (t.tgname = 'sync_edt_support_from_bt_v0129'
          and t.tgrelid = 'public.bons_de_travail'::regclass)
         or
         (t.tgname = 'sync_bt_from_edt_support_v0129'
          and t.tgrelid = 'public.edt_supports'::regclass)
       )
  ) then
    raise exception 'TEST 7 ÉCHEC: un ancien trigger récursif est encore actif.';
  end if;

  raise notice 'OK: données de test entièrement synthétiques suffixe %', v_suffix;
  raise notice 'OK: insertion affectation edt_supports';
  raise notice 'OK: progression EDT support -> BT';
  raise notice 'OK: statut EDT support -> BT';
  raise notice 'OK: statut, progression, assignation et date BT -> EDT support';
  raise notice 'OK: retrait direct et dél liaison FK';
  raise notice 'OK: RPC retirer_support_edt_v0129';
  raise notice 'OK: structure complète des triggers v0.13';
  raise notice 'OK: aucune récursion ni stack depth exceeded';
end;
$$;

rollback;
