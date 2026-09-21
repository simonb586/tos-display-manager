-- Storage deletion is allowed only after the guarded RPC reserves a draft.
-- Existing restrictive tenant policies continue to apply.
CREATE POLICY review_batch_reserved_delete ON storage.objects FOR DELETE TO authenticated
USING (
 bucket_id='support-photos'
 AND (SELECT public.tos_current_role())='Administrateur'
 AND EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=(SELECT auth.uid()) AND u.statut='Actif' AND u.role='Administrateur')
 AND EXISTS(SELECT 1 FROM public.support_photos p WHERE p.storage_bucket=objects.bucket_id AND p.storage_path=objects.name AND p.review_delete_requested_at IS NOT NULL AND p.import_finalized_at IS NULL AND p.movement_history_id IS NULL AND NOT coalesce(p.est_principale,false) AND NOT coalesce(p.is_current_visual,false))
);
