-- Preserve the existing invoker/RLS context and include only reference lookup fields.
DO $patch$DECLARE definition text;needle text;BEGIN
 SELECT pg_get_functiondef('public.portal_business_context(text,text)'::regprocedure) INTO definition;
 needle:='RETURN public.photo_visible_json(jsonb_build_object('||chr(10)||'   ''photos'',';
 IF position(needle in definition)=0 THEN RAISE EXCEPTION 'support_read_contract_changed';END IF;
 definition:=replace(definition,needle,'RETURN public.photo_visible_json(jsonb_build_object('||chr(10)||
 '   ''support'',(SELECT jsonb_build_object(''support_id'',i.support_id,''client_id'',i.client_id,''visuel_id'',i.visuel_id,''visuel_campagne'',i.visuel_campagne,''visuel_en_expo'',i.visuel_en_expo,''campagne_actuelle'',i.campagne_actuelle,''campagne_selon_visuel'',i.campagne_selon_visuel) FROM public.infrastructures i WHERE i.support_id=p_id),'||chr(10)||'   ''photos'',');
 EXECUTE definition;
END $patch$;
DO $patch$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.save_photo_import_context(bigint,jsonb)'::regprocedure) INTO definition;
 IF position('SET import_context=p_context,' in definition)=0 THEN RAISE EXCEPTION 'import_context_contract_changed';END IF;
 definition:=replace(definition,'SET import_context=p_context,','SET import_context=p_context,
 ocr_text=coalesce(p_context->''input''->>''ocrText'',ocr_text),
 ocr_confidence=CASE WHEN jsonb_typeof(p_context->''input''->''ocrConfidence'')=''number'' THEN (p_context->''input''->>''ocrConfidence'')::numeric ELSE ocr_confidence END,');
 EXECUTE definition;
END $patch$;
