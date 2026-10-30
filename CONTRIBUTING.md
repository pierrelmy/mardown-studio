# Contribuer à Markdown Studio

Ce guide couvre le développement, les validations et la publication. Pour installer
l’application, consultez le [README](README.md#installer-depuis-github).

## Environnement de développement

Utilisez Node.js 22.12 ou supérieur et npm. La CI utilise Node.js 24 ; les tests locaux
ont également été exécutés sur macOS Apple Silicon avec Node.js 26. Le test de
l’installateur macOS importe directement du TypeScript et nécessite Node.js 24 ou supérieur.

```sh
git clone https://github.com/pierrelmy/mardown-studio.git
cd mardown-studio
npm ci
npm run dev
```

Le renderer nécessite le preload Electron et ne fonctionne pas comme un site autonome.
Les commandes `dev`, `start` et `test:desktop` installent le binaire Electron s’il manque.
Pour relancer séparément son téléchargement :

```sh
npx install-electron --no
```

## Scripts

| Commande                   | Usage                                                    |
| -------------------------- | -------------------------------------------------------- |
| `npm run dev`              | Application Electron et rechargement du renderer         |
| `npm run check`            | Format, typage strict et tests unitaires                 |
| `npm run format`           | Formatage des sources                                    |
| `npm run build`            | Compilation des processus principal, preload et renderer |
| `npm start`                | Prévisualisation desktop du build                        |
| `npm test`                 | Tests unitaires                                          |
| `npm run test:coverage`    | Tests, rapports de couverture et seuils                  |
| `npm run coverage:summary` | Résumé Markdown du dernier rapport                       |
| `npm run test:desktop`     | Compilation puis tests dans une vraie fenêtre Electron   |
| `npm run pack`             | Application empaquetée dans `release/`                   |
| `npm run test:installer`   | Test macOS réel après `npm run pack`                     |
| `npm run dist`             | Installateurs locaux pour la plateforme courante         |
| `npm run release:plan`     | Calcul de la version et du changelog sans publication    |

`npm run pack` et `npm run dist` ne publient rien sur GitHub.

## Organisation du code

```text
electron/
  main.ts                       Fenêtre, IPC, dialogues et fermeture
  preload.ts                    API minimale exposée au renderer
  update-helper.cjs             Remplacement du bundle et restauration macOS
  services/
    file.service.ts             Autorisations, révisions et sauvegardes
    session.service.ts          Chemins et préférences persistantes
    export.service.ts           Export HTML et impression PDF
    update.service.ts           États et coordination des mises à jour
    mac-update.service.ts       Téléchargement vérifié et préparation macOS
    release-notes.service.ts    Historique GitHub paginé
    update-backend.ts           Adaptateur electron-updater Windows/Linux
shared/
  types.ts                      Contrats IPC et données des documents
  document-themes.ts            Catalogue et tokens des thèmes
  updates.ts                    États et notes de version
src/
  components/                   Interface, éditeur et aperçu
  hooks/useStudio.ts            Cycle de vie des documents
  services/                     Markdown assaini, Mermaid et export portable
  styles/                       Interface et typographie des documents
scripts/                        Rapports CI et préparation des releases
tests/                          Tests unitaires, desktop et installateur
```

Les composants restent spécialisés ; les opérations système appartiennent au processus
principal. Les styles d’aperçu et d’export partagent le catalogue de thèmes. Les polices
de texte sont celles du système et peuvent donc varier légèrement selon l’OS.

## Tests et couverture

Avant une PR :

```sh
npm run check
npm run test:coverage
npm run build
```

Pour un changement dans l’interface ou le cycle de vie des fichiers :

```sh
npm run test:desktop
```

Pour l’installateur macOS :

```sh
npm run pack
npm run test:installer
```

Les tests utilisent des profils et fichiers temporaires. La suite desktop remplace
les dialogues natifs par des choix déterministes ; le scénario de mise à jour de
l’interface utilise aussi des réponses IPC contrôlées. Les opérations de fichiers et
les confirmations de documents modifiés restent réelles. Une session graphique est
nécessaire ; Linux utilise Xvfb dans la CI. `STUDIO_TEST_ARTIFACT_DIR` permet de choisir
le dossier de sortie des captures et exports.

Le test installateur macOS prépare un ZIP réel et vérifie l’empreinte, le bundle, la
signature ad hoc et l’architecture. Il remplace une copie temporaire de l’application,
la relance avec un profil isolé et attend sa confirmation de démarrage. Les scénarios
de restauration après échec sont également couverts par les tests unitaires.

### Consulter la couverture

Ouvrez `coverage/index.html` après `npm run test:coverage`. Les rapports comprennent
aussi `lcov.info`, `coverage-summary.json` et, après `npm run coverage:summary`, `summary.md`.

Dans GitHub Actions, le résumé des jobs affiche le total et le détail par fichier.
Les artefacts `coverage-report` et `coverage-report-<os>` restent disponibles 14 jours,
les captures desktop 7 jours et les paquets de CI 3 jours.

La couverture inclut le TypeScript de production, le helper macOS et le calcul de
version. Les tests desktop ne contribuent pas à la mesure unitaire. Les seuils sont
centralisés dans [vitest.config.ts](vitest.config.ts) : 14 % des lignes, 12 % des
instructions, 7 % des fonctions et 14 % des branches pour l’ensemble ; les services
fichiers et session exigent chacun 85 % des lignes, 80 % des instructions et fonctions,
et 75 % des branches. Les seuils doivent progresser avec les tests.

## Fichiers et sécurité

- `contextIsolation` et la sandbox sont activés ; `nodeIntegration` est désactivé.
- Le renderer ne reçoit pas d’API Node générique. L’origine et les arguments IPC sont validés.
- Les chemins sont résolus avec `realpath` et limités au workspace ou aux fichiers explicitement ouverts.
- Le protocole `studio-asset` ne sert que des images raster autorisées.
- Les nouvelles fenêtres, navigations et permissions Chromium sont refusées. Les liens HTTP(S)/mailto passent par le système.
- Le HTML brut est échappé, le rendu est assaini par DOMPurify, KaTeX fonctionne sans confiance et Mermaid en mode strict.

Une sauvegarde compare l’empreinte SHA-256 à la version lue, écrit et synchronise un
fichier temporaire voisin, vérifie de nouveau la révision, puis remplace le fichier.
Les écritures d’un même chemin sont sérialisées. Cette protection ne constitue pas un
verrou partagé : une écriture externe exactement entre la dernière vérification et
le remplacement reste une limite. Les arrêts forcés ne déclenchent pas les confirmations
de fermeture ; les brouillons importants doivent être enregistrés.

## Commits et pull requests

Décrivez le problème, le comportement obtenu et les vérifications exécutées. Utilisez
les Conventional Commits, par exemple :

```text
feat(editor): add heading navigation
fix(files): preserve content after an external edit
docs: clarify installation on macOS
```

## Packaging et publication

Construisez les formats natifs sur leur système respectif :

```sh
npm run dist -- --mac      # DMG et ZIP
npm run dist -- --win      # NSIS
npm run dist -- --linux    # AppImage et DEB
```

La [CI](.github/workflows/ci.yml) s’exécute sur chaque push et PR. Elle contrôle le
format et TypeScript, puis les tests, la couverture, la compilation, les scénarios
desktop et le packaging sur les trois plateformes. Le test installateur est exécuté
après le packaging macOS.

Le workflow [Release](.github/workflows/release.yml) démarre après une CI réussie sur
un push de `main`. Les PR ne publient rien. Il regroupe les commits depuis le dernier
tag stable et applique l’évolution la plus importante :

| Type de changement                               | Version    |
| ------------------------------------------------ | ---------- |
| `feat:` ou `feat(scope):`                        | Mineure    |
| `type!:` ou `BREAKING CHANGE:` dans le corps     | Majeure    |
| Autres commits, dont `fix:`, `docs:` et `chore:` | Corrective |

La version est appliquée dans les runners, sans commit automatique dans les sources.
Le tag cible le commit exact validé. Les paquets macOS universels, Windows x64 et Linux
x64 sont construits avant de publier la release et son changelog. Le job de publication
utilise le `GITHUB_TOKEN` avec `contents: write` ; aucun jeton personnel n’est embarqué.
La préparation locale écrit dans `release-plan/` et ne publie rien.

### Fonctionnement de l’installateur macOS

Les builds actuels utilisent une signature ad hoc. Le helper dédié permet l’installation
sans compte Apple Developer ; il ne s’appuie pas sur Squirrel.Mac.

1. Le ZIP doit provenir du dépôt public configuré et correspondre à l’architecture.
2. Sa taille et son SHA-256 sont comparés aux métadonnées de l’API GitHub.
3. Les chemins de l’archive, l’identifiant du bundle, la version, l’architecture,
   la signature ad hoc et les liens symboliques sont vérifiés.
4. Après confirmation des documents, le helper attend la fermeture du processus,
   conserve l’ancien bundle en sauvegarde et met le nouveau à sa place.
5. Le nouveau processus démarre avec le même profil et confirme l’initialisation de l’interface.
6. Sans confirmation sous deux minutes ou en cas d’échec de lancement, l’ancien bundle
   est restauré et relancé. La sauvegarde est nettoyée après un démarrage confirmé.

Le helper et le nettoyage des bundles utilisent le système de fichiers physique
`original-fs` pour éviter le parcours virtuel des archives ASAR. Les préparations
abandonnées sont nettoyées au prochain lancement. Les marqueurs et le résultat de
l’installation sont dans `updates/` sous le profil Electron, notamment `last-result.json`.
La restauration couvre l’installation et le démarrage initial, pas une panne ultérieure.

La confiance repose sur HTTPS et les métadonnées du dépôt GitHub. Une signature ad hoc
ne prouve pas une identité Apple et ne remplace pas la notarisation. L’installateur ne
modifie pas les réglages de sécurité de macOS. Windows utilise NSIS et `electron-updater` ;
Linux utilise `electron-updater` pour les AppImage.

## Licence des contributions

Le projet utilise la [licence Markdown Studio — redistribution gratuite](LICENSE),
avec interdiction de revente. Les contributions soumises pour intégration au projet
sont proposées sous cette même licence, sauf accord écrit distinct. Chaque contributeur
conserve les droits d’auteur sur son travail ; aucune cession de propriété n’est demandée.
Conservez les mentions de licences des composants tiers que vous ajoutez.
