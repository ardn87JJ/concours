# Contexte du projet

## Vision

Attelage Pilot vise à fournir à l'équipe d'un concours d'attelage un point de
coordination simple, lisible sur ordinateur et mobile. L'outil doit réduire les
tableurs et échanges dispersés en donnant à chacun ses actions, échéances et
interlocuteurs.

La version actuelle est une V1 de démonstration dont les vues utilisent encore
le stockage du navigateur. La migration vers Supabase est engagée : projet
hébergé configuré, schéma PostgreSQL versionné et déployé, client préparé, sans
basculement de la source de données à ce stade.

Le travail en cours a déjà basculé l'écran de connexion et le chargement du
snapshot métier sur Supabase après authentification. Les écritures métier du
front sont migrées par lots pour les éléments principaux du concours
(catégories, tâches, commentaires, messages, lectures, comptes membres et
gestion des concours). Le mode local doit rester disponible comme filet de
sécurité tant que toutes les vues ne sont pas raccordées.

## Utilisateurs et besoins

### Administrateur

L'administrateur prépare le concours, structure les catégories, gère les
membres et les tâches, supervise l'avancement et les échanges, exporte les
données et consulte le journal d'activité.

### Responsable de catégorie

Le responsable suit les catégories qui lui sont attribuées. Il peut modifier
et réassigner leurs tâches, changer leur statut et échanger avec l'équipe.

### Bénévole

Le bénévole consulte ses tâches dans une interface simplifiée, met leur statut
à jour, signale un blocage, commente et utilise la messagerie.

## Décisions déjà prises

- interface et contenus en français ;
- application frontend React/TypeScript sans backend pour la V1 ;
- persistance dans `localStorage` sous `attelage-pilot-data-v1` ;
- session locale dans `sessionStorage` ;
- état et actions métier centralisés dans `AppContext` ;
- identifiants créés avec `crypto.randomUUID()` ;
- dates métier stockées sous forme `YYYY-MM-DD` et horodatages en ISO ;
- heure d'échéance facultative stockée au format `HH:mm` ; sans heure, une
  tâche reste due jusqu'à la fin de sa journée d'échéance ;
- ajout manuel d'une tâche à un calendrier externe par export iCalendar
  `.ics`, sans transmission à un service tiers ;
- chaque concours possède une couleur hexadécimale `#RRGGBB` servant de base
  à une palette d’interface calculée avec des nuances sombres et claires ;
- mots de passe des profils dérivés par PBKDF2-SHA-256, 210 000
  itérations, sel aléatoire de 16 octets et version de format `2` ;
- aucun mot de passe ni dérivé exporté dans les sauvegardes JSON ;
- chaque profil doit disposer d'un mot de passe, créé ou réinitialisé par un
  administrateur et modifiable par son membre après vérification du mot de
  passe actuel ;
- la connexion commence par la sélection d'un concours, qui limite ensuite la
  liste des profils affichés ;
- droits réappliqués dans les actions du store, pas seulement masqués dans
  l'interface ;
- publication statique avec GitHub Actions et GitHub Pages ;
- Supabase retenu pour PostgreSQL, Auth, Data API et Realtime ;
- comptes Auth basés sur un identifiant email technique invisible ; les
  utilisateurs continuent à sélectionner leur profil et ne saisissent pas
  d'email ;
- en mode Supabase, aucune session ni donnée métier n'est conservée dans le
  navigateur après rechargement ;
- l'écran de connexion lit l'annuaire public Supabase ; les profils listés
  dépendent du concours sélectionné ;
- les mutations principales du concours passent progressivement par Supabase ;
- schéma géré par migrations dans `supabase/migrations` ;
- RLS obligatoire sur toutes les tables exposées ; aucune politique ouverte
  avant validation de la matrice d'accès ;
- annuaire de connexion public limité aux concours et aux noms, rôles,
  initiales et couleurs des profils ; les contacts restent protégés ;
- bootstrap du premier concours autorisé uniquement tant que la base ne
  contient aucun concours ;
- création et réinitialisation des comptes membres réservées à une Edge
  Function qui vérifie le rôle administrateur ;
- création de concours et suppression de membre/concours désormais servies par
  des Edge Functions authentifiées côté serveur ;
- absence volontaire de dépendance UI ou de framework CSS.

## Règles métier observées

- statuts : `todo`, `in_progress`, `done`, `blocked` ;
- priorités : `low`, `normal`, `high`, `urgent` ;
- rôles : `admin`, `manager`, `volunteer` ;
- un administrateur peut gérer toutes les entités du concours actif ;
- un administrateur peut modifier les informations et la couleur d’un concours
  auquel il appartient ;
- un responsable ne peut modifier que les tâches de ses catégories ;
- un bénévole assigné ne peut modifier que le statut d'une tâche ;
- une catégorie supprimée réaffecte ses tâches à la première catégorie restante ;
- la dernière catégorie ne peut pas être supprimée ;
- un utilisateur supprimé est retiré des assignations et notifications ;
- un administrateur ne peut ni se supprimer lui-même ni supprimer le dernier
  administrateur d'un concours ;
- le dernier concours ne peut pas être supprimé ;
- les notifications d'échéance sont créées à trois jours ou moins, une fois
  par tâche, utilisateur et jour ;
- l'import CSV rejette les lignes invalides et les contacts déjà présents ;
- le journal d'activité est réservé à la vue administrateur.

## Fonctionnalités importantes déjà présentes

- gestion des tâches, catégories, membres et concours ;
- visualisations tableau, Kanban, timeline et Gantt ;
- indicateurs globaux et par catégorie ;
- espaces personnels responsable et bénévole ;
- commentaires, blocages, notifications et activité ;
- messagerie générale et directe ;
- confidentialité des messages directs entre leurs participants ;
- import de membres, export des tâches et sauvegarde du concours ;
- mots de passe locaux de tous les profils avec migration de version ;
- synchronisation du stockage lors des événements `storage`, `focus` et
  `visibilitychange`.

## Contraintes actuelles

- aucune synchronisation distante active tant que les vues utilisent
  `localStorage` ;
- le mode Supabase charge désormais les données distantes après connexion,
  et plusieurs écritures métier sont déjà persistées à distance sans écrire de
  données métier dans `localStorage` ;
- aucune confidentialité réelle des messages ou données face à un utilisateur
  ayant accès au navigateur ;
- aucune récupération de mot de passe ;
- aucune validation de schéma complète lors du chargement de `localStorage` ;
- aucun test automatisé ;
- `App.tsx`, `AppContext.tsx` et `styles.css` concentrent beaucoup de
  responsabilités ;
- les données initiales sont datées d'août et septembre 2026 ;
- Google Fonts est chargé depuis un service externe, avec repli système ;
- le dépôt suit actuellement `node_modules/`, `dist/` et plusieurs sorties de
  compilation, faute de `.gitignore`.

## Zones ambiguës ou incomplètes

### Multi-concours

Le modèle contient plusieurs concours et les tâches, utilisateurs, messages et
événements possèdent un `contestId`. Cependant :

- les catégories n'ont pas de `contestId` et sont donc globales ;
- plusieurs vues utilisent la liste globale des utilisateurs ;
- créer un concours ne crée aucun administrateur pour celui-ci ;
- changer de concours peut sélectionner automatiquement le premier profil,
  sans authentification propre à ce concours ;
- les notifications ne portent pas directement de `contestId`.

Le multi-concours doit être considéré comme expérimental tant que son modèle
d'isolation et son parcours de création ne sont pas validés.

### Authentification et messagerie privée

Chaque profil exige désormais un mot de passe. Le premier administrateur peut
initialiser le sien lors de sa première connexion. Un administrateur définit ou
réinitialise ensuite ceux des membres depuis la gestion de l'équipe. Un membre
déjà connecté peut modifier son secret depuis « Mon profil » après saisie du
mot de passe actuel.

Les membres importés par CSV initialisent leur mot de passe lors de leur
première connexion.

Les administrateurs ne peuvent pas lire les conversations directes auxquelles
ils ne participent pas. Les politiques RLS de `messages` et des états de
lecture appliquent la même confidentialité à tous les rôles.

### Source de vérité des artefacts

Le workflow reconstruit `dist/`, mais le dépôt suit également ses fichiers.
`node_modules/` est aussi versionné. Il faut décider si les artefacts générés
restent suivis ou sont retirés du suivi dans une intervention dédiée.

## À ne pas modifier sans validation

- les rôles et leur matrice de droits ;
- la confidentialité des messages directs ;
- le format ou la clé de stockage sans stratégie de migration ;
- l'algorithme ou la version des mots de passe sans migration testée ;
- la suppression en cascade d'un concours, d'une catégorie ou d'un utilisateur ;
- le schéma CSV public ;
- les données de démonstration servant de scénario métier ;
- la stratégie GitHub Pages et la valeur `base` de Vite ;
- la séparation entre vue simplifiée et vue administrateur ;
- toute modification majeure de la stratégie Supabase, du schéma ou du
  fournisseur d'identité déjà validé.

## Principes de contribution

- préserver les données existantes ;
- maintenir les contrôles de permission dans le store ;
- limiter les nouvelles dépendances ;
- ne pas ajouter de fonctionnalité implicite ;
- mettre à jour la documentation et le changelog avec les décisions ;
- valider au minimum avec `npm run build` et `npm run lint`.
