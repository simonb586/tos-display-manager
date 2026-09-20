-- A removed reference frees an active slot while retaining its original metadata.
-- Preserve the existing overall 4 MiB payload bound.
ALTER TABLE public.campagne_visuels_formats DROP CONSTRAINT visual_reference_assets_shape;
ALTER TABLE public.campagne_visuels_formats ADD CONSTRAINT visual_reference_assets_shape CHECK (
 jsonb_typeof(reference_assets)='array'
 AND jsonb_array_length(reference_assets)-jsonb_array_length(jsonb_path_query_array(reference_assets,'$[*] ? (@.archived == true)'))<=10
 AND octet_length(reference_assets::text)<=4194304
);
