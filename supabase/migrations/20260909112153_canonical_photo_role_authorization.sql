-- Canonical photo authorization only. Terrain bucket remains unchanged.
CREATE OR REPLACE FUNCTION public.tos_current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE WHEN count(*) = 1 AND min(u.role) IN
    ('Administrateur', 'Coordonnateur', 'Installateur', 'Client', 'Client-Admin')
    THEN min(u.role) ELSE NULL END
  FROM public.utilisateurs u
  WHERE auth.uid() IS NOT NULL
    AND u.auth_user_id = auth.uid()
    AND lower(coalesce(u.statut, '')) = 'actif';
$function$;
REVOKE EXECUTE ON FUNCTION public.tos_current_role() FROM PUBLIC, anon;
-- Existing authenticated/service_role grants are preserved.

ALTER POLICY support_photos_delete_admin_v0129_lot3 ON public.support_photos
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.tos_current_role() = 'Administrateur'
  AND EXISTS (
    SELECT 1 FROM public.utilisateurs u
    WHERE u.auth_user_id = auth.uid()
      AND lower(coalesce(u.statut,'')) = 'actif'
      AND u.role = 'Administrateur'
      AND (
        (
          support_photos.client_id IS NOT NULL
          AND (u.client_id IS NULL OR u.client_id = support_photos.client_id)
          AND EXISTS (
            SELECT 1 FROM public.infrastructures i JOIN public.clients c ON c.id=i.client_id
            WHERE i.support_id = support_photos.support_id
              AND i.client_id = support_photos.client_id
          )
        )
        OR (
          -- Explicitly unassigned import-review items are internal, not client data.
          u.client_id IS NULL AND support_photos.client_id IS NULL
          AND support_photos.support_id IS NULL AND support_photos.source='mass_import'
          AND support_photos.review_status IN ('needs_review','unmatched','ignored','error')
        )
      )
  )
);
