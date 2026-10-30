# Markdown Studio

[![CI](https://github.com/pierrelmy/mardown-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/pierrelmy/mardown-studio/actions/workflows/ci.yml)
[![Couverture — rapport CI](https://img.shields.io/badge/couverture-rapport_CI-blue)](https://github.com/pierrelmy/mardown-studio/actions/workflows/ci.yml)

Application desktop de rédaction Markdown locale, construite avec Electron, React,
TypeScript, electron-vite, Tailwind et CodeMirror 6. L’interface est en français.

## Démarrage

Prérequis : Node.js **22.12 ou supérieur** et npm. Le développement et les tests
ont été vérifiés sur macOS Apple Silicon avec Node 26.

```sh
npm ci
npm run dev
```

Les commandes `dev`, `start` et `test:desktop` installent automatiquement le binaire
Electron s’il manque, puis réutilisent l’installation existante. Le premier lancement
nécessite un accès réseau, sauf si le téléchargement est déjà en cache. Electron
utilise désormais un téléchargement au premier lancement plutôt qu’un script
`postinstall` ; `npm ci` seul ne crée donc pas nécessairement le binaire.

Pour installer ce binaire séparément ou réessayer après une erreur réseau :

```sh
npx install-electron --no
```

`npm run dev` ouvre une véritable fenêtre Electron avec rechargement du renderer.
L’interface nécessite le preload Electron ; elle ne fonctionne pas comme un site
web indépendant.

## Fonctionnalités

- Ouverture de fichiers `.md` et de dossiers locaux avec explorateur récursif.
- Création de documents et dossiers, renommage et suppression confirmée dans la corbeille.
- Onglets indépendants avec indicateur de modifications et protection à la fermeture.
- CodeMirror : Markdown, indentation, recherche/remplacement, pliage et raccourcis habituels.
- Aperçu en direct : tableaux, tâches, code coloré, KaTeX (`$…$`, `$$…$$`) et Mermaid.
- Modes éditeur, aperçu et partage avec séparation redimensionnable au clavier ou à la souris.
- Thèmes sombre et clair ; compteurs de mots, caractères et lignes.
- Sauvegarde manuelle, « Enregistrer sous » et autosave après 900 ms d’inactivité.
- Détection des changements externes toutes les 2,5 secondes : rechargement des onglets
  propres et signalement des conflits pour les onglets modifiés.
- Restauration du workspace, des fichiers ouverts, de l’onglet actif et des préférences.
- Quatre thèmes de document : Studio, Éditorial, Technique et Minuit, indépendants du thème de l’application.
- Taille du texte, interligne et largeur de lecture personnalisables et persistants.
- Export HTML autonome (polices et images locales intégrées) et PDF A4 ou Letter,
  avec le même thème, la même typographie et les mêmes palettes de code et de diagrammes que l’aperçu.

Les brouillons sans chemin doivent être enregistrés une première fois pour activer
l’autosave. Les documents sont toujours des fichiers `.md` ordinaires sur disque.
La session contient uniquement des chemins et des préférences, jamais le texte des documents.

## Personnaliser les documents

Cliquez sur l’icône **palette** dans la barre supérieure pour ouvrir **Style du document**.
Les cartes donnent un aperçu des quatre thèmes ; la sélection s’applique immédiatement.
Vous pouvez choisir une taille de texte de 12 à 24 px, un interligne de 1,4 à 2,2 et une
largeur de lecture étroite, standard ou large. **Réinitialiser** rétablit les valeurs par défaut.

Ces préférences sont globales à l’application et sont restaurées à la prochaine ouverture.
Elles ne modifient pas les fichiers Markdown. Le thème clair/sombre de l’interface reste
indépendant du thème de document : une interface sombre peut afficher un document ivoire.
La boîte **Exporter** permet de choisir le thème et le format PDF (A4 ou Letter) avant
l’enregistrement. La largeur de lecture reste plafonnée par la largeur du papier en PDF.
Les polices sont celles du système, ce qui peut produire de légères différences entre OS.

Le catalogue et les tokens sont centralisés dans `shared/document-themes.ts` ; les styles
d’aperçu et d’export utilisent les mêmes variables. Les sessions plus anciennes sont
migrées automatiquement vers le thème Studio sans perdre leurs autres préférences.

## Raccourcis

| Action                           | macOS       | Windows / Linux       |
| -------------------------------- | ----------- | --------------------- |
| Nouveau document                 | ⌘ N         | Ctrl N                |
| Ouvrir un fichier                | ⌘ O         | Ctrl O                |
| Ouvrir un dossier                | ⌘ ⇧ O       | Ctrl Shift O          |
| Enregistrer                      | ⌘ S         | Ctrl S                |
| Enregistrer sous / copie         | ⌘ ⇧ S       | Ctrl Shift S          |
| Fermer l’onglet                  | ⌘ W         | Ctrl W                |
| Afficher / masquer l’explorateur | ⌘ B         | Ctrl B                |
| Changer de mode                  | ⌘ \\        | Ctrl \\               |
| Rechercher dans le document      | ⌘ F         | Ctrl F                |
| Annuler / rétablir               | ⌘ Z / ⌘ ⇧ Z | Ctrl Z / Ctrl Shift Z |

## Scripts et validation

```sh
npm run test:coverage # tests unitaires + couverture et seuils
npm run check         # format, TypeScript strict et tests unitaires
npm run build         # contrôle TypeScript puis compilation des trois processus
npm start             # lancer le build compilé
npm run test:desktop  # compilation + tests dans une vraie fenêtre Electron
npm run format        # formater les sources
npm run pack          # application non installée dans release/
npm run dist          # paquet distribuable pour la plateforme courante
npm run release:plan  # calcul local de la prochaine version et de son changelog
npm run test:installer # test macOS après npm run pack : remplacement et relance réels
```

Les tests unitaires utilisent de vrais fichiers temporaires. Les tests desktop
utilisent un profil isolé et des fichiers temporaires ; seuls les dialogues natifs
sont remplacés par des choix déterministes. Ils couvrent le rendu, les accès IPC,
les opérations fichiers, les sauvegardes, conflits, exports et la restauration.
Ils nécessitent une session graphique et affichent le chemin de leurs captures et exports.

Les limites de cette version : fichiers de 20 Mo maximum, 20 000 entrées par workspace,
arborescence limitée à 24 niveaux ; fichiers cachés, liens symboliques et `node_modules`
exclus de l’explorateur. Les images relatives sont accessibles dans un workspace ; les
images HTTPS et les images raster en data URL sont prises en charge. Les SVG locaux
ne sont pas chargés. Les images HTTPS restent des liens réseau dans l’export HTML.
Les liens internes vers d’autres fichiers, la recherche globale, la palette de
commandes et le Live Preview intégré sont des évolutions, conformément au périmètre V1.

## CI et rapports de couverture

La [CI GitHub Actions](https://github.com/pierrelmy/mardown-studio/actions/workflows/ci.yml)
s’exécute à chaque push et à chaque ouverture ou mise à jour de PR, ainsi que manuellement.
Elle vérifie le format et TypeScript, puis exécute les tests unitaires avec couverture V8.
En parallèle, macOS, Windows et Linux exécutent les tests unitaires avec les mêmes
seuils de couverture, la compilation,
les tests dans une vraie application Electron et le packaging natif (`npm run pack`).
Linux utilise Xvfb pour la fenêtre desktop. Aucun secret ou compte externe n’est requis.

Pour voir la couverture dans GitHub, cliquez sur le badge **couverture — rapport CI**,
ouvrez une exécution puis son résumé : le job **Tests unitaires et couverture** affiche
les pourcentages par fichier et le total (lignes, instructions, fonctions et branches).
L’artefact **coverage-report** contient aussi le rapport HTML navigable (`index.html`),
`lcov.info`, `coverage-summary.json` et `summary.md`. Les artefacts
**coverage-report-macos-latest**, **coverage-report-windows-latest** et
**coverage-report-ubuntu-latest** donnent les mesures propres à chaque plateforme.
Les rapports sont conservés 14 jours, y compris
lorsque les tests ou les seuils échouent si Vitest a pu produire le rapport. Les captures
et exports desktop de chaque OS sont conservés 7 jours ; les paquets natifs sont
archivés avec leurs permissions et téléchargeables pendant 3 jours. Le badge CI affiche l’état du
workflow ; le badge couverture ouvre les rapports, sans afficher de pourcentage figé.

En local :

```sh
npm run test:coverage
npm run coverage:summary
# Ouvrir coverage/index.html dans un navigateur
```

La couverture inclut tout le TypeScript de production (`electron/`, `src/`, `shared/`),
à l’exception des déclarations de types. Les tests desktop ne sont pas instrumentés
par Vitest : leurs résultats sont distincts de la couverture unitaire. La base initiale
est de 14,1 % des lignes pour l’ensemble du projet. Les seuils globaux initiaux sont
14 % des lignes, 12 % des instructions, 7 % des fonctions et 14 % des branches.
Les services fichiers et session ont chacun des seuils plus élevés : 85 % des lignes,
80 % des instructions et des fonctions, 75 % des branches. Une régression sous ces seuils
fait échouer la CI. Les valeurs sont centralisées dans `vitest.config.ts` et pourront
être relevées à mesure que la couverture de l’interface progresse.

## Architecture et sauvegarde

```text
electron/
  main.ts                  Fenêtre, validations IPC, dialogues natifs et fermeture
  preload.ts               Contrat minimal exposé par contextBridge
  services/
    file.service.ts        Autorisations, révisions, écriture atomique, arborescence
    session.service.ts     Préférences et chemins de la dernière session
    export.service.ts      Images intégrées, sauvegarde HTML et impression PDF
shared/types.ts            Types des documents, préférences et API IPC
src/
  components/              Éditeur, aperçu, explorateur, onglets, barre et dialogues
  hooks/useStudio.ts       Cycle de vie des documents et synchronisation avec le disque
  services/                Rendu assaini, file de rendu Mermaid et export portable
  styles/                  Tokens des thèmes et typographie de l’aperçu
```

Le processus principal valide l’origine et les arguments IPC. Le renderer fonctionne
avec `contextIsolation`, sandbox activée et `nodeIntegration` désactivée. Il ne reçoit
aucun accès Node générique. Les chemins sont résolus avec `realpath` et limités au
workspace choisi ou aux fichiers explicitement ouverts. Le protocole `studio-asset`
ne sert que des images raster autorisées. Les nouvelles fenêtres, navigations et
permissions Chromium sont refusées. Les liens HTTP(S)/mailto passent par le navigateur
système. Le HTML brut Markdown est échappé et le rendu est assaini par DOMPurify ; KaTeX
fonctionne sans confiance et Mermaid en mode strict. Aucun contenu Markdown n’est exécuté.

Chaque sauvegarde compare une empreinte SHA-256 à la version lue, écrit dans un fichier
temporaire voisin, synchronise son contenu, vérifie à nouveau la révision puis remplace
le fichier. Les écritures d’un même chemin sont sérialisées. Une modification externe
refuse la sauvegarde et propose de recharger ou d’enregistrer une copie. Cette protection
ne constitue pas un verrou partagé avec les autres éditeurs : une écriture externe
exactement entre la dernière vérification et le remplacement reste une limite du système
de fichiers. Les arrêts forcés du processus ou de l’ordinateur ne déclenchent pas le
dialogue de fermeture ; sauvegardez les brouillons importants.

## Distribution

Electron Builder prépare les formats suivants sur leur système respectif :

```sh
npm run dist -- --mac      # DMG et ZIP
npm run dist -- --win      # installateur NSIS
npm run dist -- --linux    # AppImage et DEB
```

Le build macOS local utilise une signature ad hoc (`identity: "-"`), sans utiliser de
certificat personnel. Les releases macOS suivent ici le même choix, sans compte Apple
Developer : leur mise à jour utilise l’installateur dédié décrit ci-dessous. Une
signature Developer ID et une notarisation restent recommandées pour une distribution
publique sans avertissement Gatekeeper. Aucun certificat ou secret n’est inclus dans
l’application. Windows et Linux disposent de
cibles configurées et d’une CI de compilation, mais doivent être validés sur leur OS.

Le cahier des charges source reste dans `docs/`, ignoré conformément au `.gitignore`
initial du dépôt.

## Versions et mises à jour automatiques

Le workflow **Release** démarre après une CI réussie sur un push de `main`. Les PR
n’effectuent aucune publication. Le dépôt public de distribution est
[pierrelmy/mardown-studio](https://github.com/pierrelmy/mardown-studio/releases).

Les commits depuis le dernier tag publié déterminent la prochaine version :

| Commits inclus                                         | Évolution                             |
| ------------------------------------------------------ | ------------------------------------- |
| `feat:` ou `feat(scope):`                              | Mineure, par exemple 0.2.0 → 0.3.0    |
| `type!:` ou corps contenant `BREAKING CHANGE:`         | Majeure, par exemple 0.3.0 → 1.0.0    |
| Tous les autres, y compris `fix:`, `docs:` et `chore:` | Corrective, par exemple 0.3.0 → 0.3.1 |

Chaque push validé produit une release couvrant tous les commits non encore publiés.
Plusieurs commits dans un même push sont regroupés et l’évolution la plus importante
l’emporte. Le tag est attaché au commit exact validé par la CI. La version est appliquée
à `package.json` et au lockfile dans les runners de build, sans commit de bot dans les
sources ni boucle de publication. La version source sert de base avant le premier tag.
`npm run release:plan` permet de consulter le calcul dans `release-plan/` sans publier.

Les paquets macOS universels (Apple Silicon et Intel), Windows x64 et Linux x64 sont
construits séparément. La release n’est rendue publique qu’une fois tous les paquets
construits et envoyés, avec le changelog et les métadonnées de mise à jour. Le workflow
utilise le `GITHUB_TOKEN` du job de publication avec `contents: write`, sans secret
personnel pour ce dépôt public. Les premières exécutions de publication devront être
vérifiées dans GitHub Actions.

### Dans l’application

Au démarrage d’une application installée, une vérification cherche une release stable
plus récente. Le bouton de version dans la barre d’état ouvre **Versions et mises à
jour** ; une nouvelle version ouvre également cette fenêtre si aucun autre dialogue
n’est actif. Le changelog paginé inclut toutes les releases stables strictement après
la version installée et jusqu’à la dernière version, dans l’ordre décroissant.
Les versions de brouillon et de prépublication sont exclues.

**Télécharger la mise à jour** prépare le paquet avec une progression visible.
**Installer et relancer** demande quoi faire des documents non sauvegardés, attend les
écritures en cours et persiste la session. Une annulation conserve l’application et les
brouillons. Fermer normalement une application après téléchargement n’installe rien.
En développement (`npm run dev`), les installations et les vérifications réseau sont
désactivées ; le numéro de version reste consultable.

La version actuelle sans ce système doit être remplacée **une première fois** par une
nouvelle build, par exemple avec `npm run dist -- --mac`, ou par la première release
GitHub contenant ce code. Ensuite les mises à jour sont proposées dans l’application.
Sur macOS, placez l’application dans un dossier accessible en écriture, typiquement
`Applications` ; l’application lancée depuis un DMG monté n’est pas remplaçable.

### Installateur macOS sans compte Apple

Le mécanisme natif Squirrel nécessite une identité de signature cohérente. Pour cet
usage personnel sans certificat Developer ID, un helper dédié est copié hors de
`app.asar` et utilise le mode Node d’Electron pour réaliser le remplacement :

1. Le ZIP doit provenir du dépôt GitHub configuré et correspondre à l’architecture.
2. Sa taille et son empreinte SHA-256 sont comparées aux métadonnées de l’API GitHub.
3. Les chemins de l’archive sont contrôlés, puis le bundle est extrait dans un dossier
   temporaire voisin de l’application. L’identifiant `studio.markdown.app`, la version,
   l’architecture, la validité de la signature ad hoc et les liens symboliques sont vérifiés.
4. Après l’accord concernant les documents, le helper attend la fermeture du processus.
   L’ancien bundle est renommé en sauvegarde, puis remplacé par le bundle préparé.
5. Le nouveau processus est lancé avec le même profil. Il confirme son démarrage quand
   l’interface et la restauration de session sont initialisées.
6. Sans confirmation sous deux minutes, ou en cas d’échec de lancement, le helper arrête
   le nouveau processus, restaure l’ancien bundle et le relance. La sauvegarde n’est
   supprimée qu’après la confirmation d’un démarrage réussi. Si le helper garde encore
   un fichier ouvert, la nouvelle application termine le nettoyage en arrière-plan.

Les fichiers Markdown restent en dehors du bundle et ne sont pas remplacés. Les logs
et marqueurs sont dans `updates/` sous le profil Electron, avec `last-result.json` pour
le résultat de l’installation. Les préparations abandonnées sont nettoyées au prochain
lancement. La restauration couvre l’installation et le démarrage initial, pas une panne
qui surviendrait après la confirmation d’initialisation.

La confiance du téléchargement repose sur HTTPS et les métadonnées du dépôt GitHub :
la signature ad hoc ne prouve pas une identité Apple. Ce mécanisme ne remplace pas une
notarisation et n’essaie pas de modifier les réglages de sécurité de macOS. Gatekeeper
peut demander une autorisation lors de la première installation manuelle.
Windows utilise l’updater NSIS ; Linux utilise `electron-updater` pour les AppImage.

Le test `npm run test:installer` crée des copies temporaires d’un vrai paquet macOS,
prépare un ZIP réel, vérifie son intégrité et son bundle, le remplace puis contrôle la
relance et la confirmation du nouveau processus. Les tests unitaires simulent aussi
un échec de démarrage et vérifient la restauration de l’ancienne application. La CI
macOS exécute ce test après son packaging.
