# Rapport — LOT A — Visuels de l’application terrain

Date : 23 juillet 2026
Branche : `bloc-13-moteur-edt`
Commit de départ : `c4a16fa9f0ff808517e823270ead41f76888a70a`

## Résultat

Le filtre strict de format a été remplacé par une normalisation commune qui gère les
espaces, les virgules décimales, les points, les symboles `x`/`×`, les unités et les
orientations textuelles. La largeur et la hauteur restent ordonnées afin de ne pas
confondre deux orientations physiques.

Un visuel terrain est maintenant admissible seulement si :

- le visuel est actif;
- son format normalisé correspond au support;
- sa campagne est publiée sur le terrain;
- sa campagne est à l’état `Active`.

L’interface affiche un diagnostic lorsque la liste est vide : support, format brut,
clé normalisée, compteurs intermédiaires, formats disponibles et bouton de reprise.
Les erreurs Supabase ne sont plus présentées comme un simple résultat vide.

## Nouveaux composants et services

Aucun nouveau composant React autonome.

Nouveaux modules :

- `src/lib/displayFormat.js` : normalisation pure et testable;
- `scripts/verifier_visuels_terrain_v01210.mjs` : tests locaux de normalisation.

Service enrichi :

- `src/services/campaignVisualService.js` : diagnostic détaillé et sélection admissible.

## Migration SQL préparée

- `supabase/V0_12_10_VISUELS_TERRAIN.sql`
- `supabase/VERIFIER_V0_12_10_VISUELS_TERRAIN.sql`

La migration ajoute :

- `tdm_normalize_display_format(text)`;
- `diagnostic_visuels_support_v01210(text)`;
- `finaliser_installation_terrain_v01210(...)`.

La nouvelle RPC contrôle le rôle, le visuel actif, la campagne publiée et active et
le format normalisé, puis délègue l’écriture atomique à la RPC v0.12.7.3 existante.

Ces fichiers n’ont pas été exécutés sur une base Supabase.

## Fichiers modifiés

- `src/components/TerrainApp.jsx`
- `src/features/terrain/bloc5-terrain.css`
- `src/services/campaignVisualService.js`
- `src/services/terrainService.js`

## Fichiers créés

- `src/lib/displayFormat.js`
- `scripts/verifier_visuels_terrain_v01210.mjs`
- `supabase/V0_12_10_VISUELS_TERRAIN.sql`
- `supabase/VERIFIER_V0_12_10_VISUELS_TERRAIN.sql`
- `captures/lot-a-build-login.png`
- `RAPPORT_LOT_A_VISUELS_TERRAIN.md`

## Tests exécutés

Commande :

```text
node scripts/verifier_visuels_terrain_v01210.mjs
```

Résultat : `OK: 11 vérifications des visuels terrain réussies.`

Cas couverts :

- `20 x 28 Portrait` et `20x28`;
- virgule et point décimaux;
- symbole `×`;
- unités;
- zéros décimaux;
- format textuel;
- valeur nulle;
- orientation dimensionnelle conservée;
- priorité des champs de format du support;
- statut de campagne accentué.

Le vérificateur SQL a été préparé, mais n’a pas été exécuté puisqu’aucune base de
production ne devait être modifiée ou sollicitée.

## Build

Commande :

```text
npm.cmd run build
```

Résultat : succès.

- Vite 6.4.3;
- 1 996 modules transformés;
- durée : 27,34 secondes.

Avertissement non bloquant déjà structurel au projet : le principal fragment
JavaScript minifié dépasse 500 kB.

## Capture d’écran

`captures/lot-a-build-login.png` confirme que la compilation locale s’ouvre
correctement jusqu’à l’écran d’authentification.

La vue terrain authentifiée n’a pas été capturée : aucun compte ni secret de
production n’a été utilisé pendant ce lot.

## Risques et problèmes connus

- La nouvelle interface appelle `finaliser_installation_terrain_v01210`; la migration
  correspondante devra exister dans l’environnement ciblé avant tout déploiement de
  ce code.
- Le diagnostic charge actuellement tous les visuels actifs pour produire ses
  compteurs. Le volume actuel est adapté; un catalogue beaucoup plus volumineux
  devrait utiliser la RPC de diagnostic.
- La normalisation ne permute jamais largeur et hauteur. C’est volontaire pour
  préserver l’orientation physique.
- La disponibilité réelle des données et les politiques RLS doivent être testées
  dans un environnement Preview avec un compte Installateur.
- Aucun test d’installation réelle, téléversement de photo ou écriture Supabase n’a
  été effectué.

## Contraintes respectées

- travail uniquement dans `tos-display-manager-stable`;
- branche `bloc-13-moteur-edt`;
- aucune modification de `.env.local`;
- aucun secret lu ou modifié;
- aucun push, merge ou déploiement;
- aucune migration exécutée;
- aucune base de production modifiée.
