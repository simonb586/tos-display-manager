-- Vérification autonome de la normalisation des formats terrain.
-- N'écrit aucune donnée métier.

begin;

do $$
begin
  if public.tdm_normalize_display_format('20 x 28 Portrait') <> '20x28' then
    raise exception 'ÉCHEC: format avec orientation.';
  end if;
  if public.tdm_normalize_display_format('24,25 × 18 pouces') <> '24.25x18' then
    raise exception 'ÉCHEC: virgule, symbole multiplication ou unité.';
  end if;
  if public.tdm_normalize_display_format('24.250x18.0') <> '24.25x18' then
    raise exception 'ÉCHEC: zéros décimaux.';
  end if;
  if public.tdm_normalize_display_format('  Abribus  ') <> 'abribus' then
    raise exception 'ÉCHEC: format textuel.';
  end if;
  if public.tdm_normalize_display_format(null) <> '' then
    raise exception 'ÉCHEC: valeur NULL.';
  end if;

  if to_regprocedure(
    'public.finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text)'
  ) is null then
    raise exception 'ÉCHEC: RPC d''installation v0.12.10 absente.';
  end if;
  if to_regprocedure('public.diagnostic_visuels_support_v01210(text)') is null then
    raise exception 'ÉCHEC: RPC de diagnostic absente.';
  end if;

  raise notice 'OK: normalisation des formats terrain.';
  raise notice 'OK: RPC d''installation protégée.';
  raise notice 'OK: RPC de diagnostic visible.';
end;
$$;

rollback;
