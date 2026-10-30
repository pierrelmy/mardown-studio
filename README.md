# Markdown Studio

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
- Export HTML autonome (polices et images locales intégrées) et PDF A4. Les exports
  utilisent une page claire adaptée à la lecture et à l’impression.

Les brouillons sans chemin doivent être enregistrés une première fois pour activer
l’autosave. Les documents sont toujours des fichiers `.md` ordinaires sur disque.
La session contient uniquement des chemins et des préférences, jamais le texte des documents.

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
npm run check         # format, TypeScript strict et tests unitaires
npm run build         # contrôle TypeScript puis compilation des trois processus
npm start             # lancer le build compilé
npm run test:desktop  # compilation + tests dans une vraie fenêtre Electron
npm run format        # formater les sources
npm run pack          # application non installée dans release/
npm run dist          # paquet distribuable pour la plateforme courante
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
certificat personnel. Une diffusion publique macOS nécessite un certificat Developer ID
et une notarisation configurés par le responsable de publication. Les certificats et
secrets de signature ne sont pas inclus dans le dépôt. Windows et Linux disposent de
cibles configurées et d’une CI de compilation, mais doivent être validés sur leur OS.

Le cahier des charges source reste dans `docs/`, ignoré conformément au `.gitignore`
initial du dépôt.
