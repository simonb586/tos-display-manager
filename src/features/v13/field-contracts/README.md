# Contrats de configuration des champs — 13.1-A3.2

**Statut officiel : Frozen**

La sous-phase 13.1-A3.2 et les contrats `1.0.0` sont gelés. Ils constituent la
référence officielle du projet. Aucun changement de comportement ne peut leur
être apporté sans nouvelle sous-phase et approbation explicite. Toute évolution
incompatible doit utiliser une nouvelle version majeure (`2.x` ou supérieure)
et fournir une stratégie de migration documentée. Les décisions produit
intégrées à `1.0.0` sont figées.

Ce module définit des contrats JSON purs et versionnés. Il ne lit ni n’écrit
`relation_fields`, ne contacte pas Supabase et ne résout aucune configuration
pour les consommateurs existants.

## Modèle

```text
Métadonnées physiques PostgreSQL (lecture seule)
                    │
                    ▼
        Enveloppe administrative future
   ┌─────────┬──────────┬────────────┬─────────┐
   │ Display │Validation│ Permissions│ Terrain │
   ├─────────┼──────────┼────────────┼─────────┤
   │ Import/ │ Relations│ Calculs    │Activation
   │ Export  │          │            │
   └─────────┴──────────┴────────────┴─────────┘
                    │
                    ▼
        Brouillon versionné uniquement

Les consommateurs actifs restent déconnectés en A3.2.
```

La configuration physique décrit le schéma réel et reste prioritaire. La
configuration administrative décrit une intention. Une intention en brouillon
n’est pas une configuration active. Une propriété absente est normalisée avec
la valeur par défaut du contrat; une valeur `null` signifie « hériter du
comportement historique », sauf règle conservatrice explicitement documentée.

## Version initiale

Tous les contrats commencent à la version `1.0.0`. Le registre associe une
version à une définition immuable. Une version inconnue est refusée. Une future
évolution rétrocompatible ajoutera une nouvelle entrée de registre et un
adaptateur explicite; elle ne modifiera pas silencieusement la signification
d’une version publiée.

## Contrats et valeurs par défaut

### DisplayConfig — futures phases A4 et A10

| Propriété | Défaut |
|---|---|
| `showInGrid` | `null` |
| `showInForm` | `null` |
| `showIn360` | `null` |
| `displayOrder` | `null` |
| `readonlyOverride` | `null` |

Toutes les valeurs `null` héritent du comportement historique.
`readonlyOverride` vise uniquement les futurs éditeurs universels de grille,
formulaire et fiche 360. Il ne concerne ni Terrain, ni les imports, ni les
exports et ne peut jamais rendre modifiable un champ protégé.

### ValidationConfig — futures phases A5 et A10

`requiredOverride`, les longueurs, les bornes, `allowedValues` et
`errorMessages` valent `null`. Aucune validation supplémentaire n’est donc
appliquée. Les contraintes physiques et serveur restent l’autorité.

### PermissionConfig — futures phases A6 et A10

`generalRule` et `roleRules` valent `null`. `priorityStrategy` vaut
`deny-wins` et `conservativeDeny` vaut toujours `true`. Tout refus explicite
l’emporte; une règle spécifique ne contourne pas un refus général; une règle
absente ou invalide n’accorde aucun droit. Le contrat ne remplace jamais RLS,
l’authentification ou les permissions serveur et ne peut que restreindre
l’interface.

### TerrainConfig — futures phases A7 et A10

Les propriétés Terrain valent `null` et héritent du comportement historique.
`terrainDisplayOrder` est indépendant de `displayOrder`.
Les champs critiques par défaut sont `support_id`, `photo_principale_url`,
`photo_miniature_url` et `visuel_actuel_cadre`. Ce contrat n’est pas consommé
par `TerrainApp`.

### ImportExportConfig — futures phases A8 et A10

Les disponibilités, noms, `importAliases`, `exportAliases` et valeur par défaut
valent `null`. Les noms et alias d’import sont distincts de ceux d’export.
Un alias ne remplace jamais silencieusement un ancien en-tête.
`exchangeContractVersion` vaut `1.0.0`. La valeur par défaut demeure
déclarative et n’est jamais écrite dans une table métier.

### RelationConfig — futures phases A9 et A10

Les informations de relation valent `null`, le statut vaut `draft` et
`relationRulesCompatibility` vaut `legacy-authoritative`. `relation_rules` et
le Studio des relations conservent donc leur autorité historique. Le catalogue
et le modèle normalisé servent uniquement à cataloguer, comparer et
diagnostiquer jusqu’à une migration d’autorité explicitement autorisée.

### CalculationConfig — futures phases A9 et A10

Le type, les dépendances, l’expression et la gestion des valeurs nulles valent
`null`. `cycleDetection` vaut `required`. Une expression est exclusivement un
arbre JSON composé de littéraux, de références de champs et d’opérateurs
prédéfinis; les chaînes JavaScript ou SQL ne sont pas acceptées comme
expressions.

### ActivationConfig — future phase A10

Le statut par défaut vaut `draft`. Les versions, la date, l’acteur et la portée
valent `null`. Les portées reconnues sont `field`, `table`, `module` et
`global`, mais les premiers pilotes sont limités à `field` et `table`.
Toute future activation devra être explicite, atomique, auditée, réversible et
précédée d’un snapshot; elle ne modifiera aucune donnée métier. Les autres
statuts sont documentaires en A3.2; aucune fonction d’activation ou moteur de
résolution n’existe.

## Politique des champs techniquement protégés

En version `1.0.0`, `support_id`, les clés primaires, clés étrangères, colonnes
générées, colonnes identity et tous les noms terminant par `_id` sont totalement
non configurables. Le Gestionnaire ne peut modifier aucune de leurs propriétés,
y compris le libellé, l’aide, la visibilité, l’ordre, la lecture seule ou le
type. Une réévaluation exigera une nouvelle version contractuelle.

## Règles communes

- Objets JSON simples uniquement.
- Propriétés inconnues refusées.
- Normalisation déterministe.
- Sérialisation stable par tri récursif des clés.
- Absence ou `undefined` remplacé par le défaut déclaré.
- `null` conservé comme héritage explicite.
- Valeurs non finies, fonctions, symboles, `BigInt` et cycles refusés.
- Aucun JavaScript, SQL ou callback dans les contrats.
- Aucun contrat ne peut élargir un droit serveur ou affaiblir RLS.

## Décisions désormais gelées pour `1.0.0`

Les sept décisions relatives aux champs techniques, à `readonlyOverride`, à
`deny-wins`, à l’ordre Terrain, aux alias d’échange, à l’autorité de
`relation_rules` et aux portées d’activation font partie de la définition
initiale `1.0.0`. Leur modification exigera une version contractuelle
ultérieure. La mise en œuvre fonctionnelle reste hors du périmètre A3.2.
