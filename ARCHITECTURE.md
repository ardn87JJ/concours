# Architecture

## Vue d'ensemble

Attelage Pilot est une application monopage rendue entièrement dans le
navigateur.

```text
Interaction utilisateur
        ↓
Vues et composants React
        ↓
useApp() / AppContext
        ↓
Règles d'autorisation + mutations immuables
        ↓
localStorage du navigateur ou snapshot Supabase selon le backend activé
```

La navigation repose sur un état React `view`. Le mode local continue d'utiliser
`AppContext` et `localStorage`, tandis que le mode Supabase charge l'annuaire
public, la session Auth et le snapshot métier après connexion.

En mode Supabase, la session Auth n'est pas persistée côté navigateur et le
contexte de concours/profil reste uniquement en mémoire durant la session React.

## Structure du dépôt

| Chemin | Responsabilité |
| --- | --- |
| `src/main.tsx` | monte React, `StrictMode` et `AppProvider` |
| `src/App.tsx` | shell, connexion, navigation et toutes les vues principales |
| `src/store/AppContext.tsx` | état global, persistance, migrations, permissions, notifications et audit |
| `src/types/index.ts` | modèle métier TypeScript |
| `src/data/demo.ts` | concours, catégories, utilisateurs, tâches et messages initiaux |
| `src/components/` | composants réutilisables de tâche, avatar, badge et progression |
| `src/lib/csv.ts` | analyse et modèle d'import CSV |
| `src/lib/format.ts` | libellés, dates, retards et délais |
| `src/lib/calendar.ts` | génération locale des événements iCalendar `.ics` |
| `src/lib/password.ts` | dérivation et vérification PBKDF2 |
| `src/lib/supabase.ts` | initialisation conditionnelle du client Supabase |
| `src/lib/supabaseApi.ts` | annuaire, Auth et appels aux Edge Functions |
| `src/lib/supabaseData.ts` | chargement du snapshot métier distant |
| `src/styles.css` | design global et responsive |
| `index.html` | point d'entrée HTML Vite |
| `vite.config.ts` | configuration Vite et base relative |
| `eslint.config.js` | règles ESLint TypeScript/React |
| `tsconfig*.json` | compilation TypeScript par références |
| `.github/workflows/deploy.yml` | build et publication GitHub Pages |
| `supabase/migrations/` | migrations PostgreSQL versionnées |
| `supabase/config.toml` | configuration Supabase locale et Auth |
| `supabase/functions/` | bootstrap et gestion sécurisée des comptes membres |
| `dist/` | sortie générée de production, actuellement suivie par Git |

Les fichiers `vite.config.js`, `vite.config.d.ts`, `*.tsbuildinfo` et le contenu
de `dist/` sont des sorties générées. `node_modules/` est installé localement
mais aussi suivi dans l'état actuel du dépôt ; ce n'est pas une source
applicative.

## Modèle de données

`AppData` agrège :

- `contests` : métadonnées des concours ;
- `categories` : domaines de travail, actuellement globaux ;
- `users` : profils rattachés à un concours ;
- `tasks` : tâches rattachées à un concours et une catégorie, avec date
  d'échéance obligatoire et heure d'échéance facultative ;
- `messages` : canal général ou échange direct ;
- `notifications` : événements destinés à un utilisateur ;
- `auditLog` : journal des mutations importantes ;
- `activeContestId` et `currentUserId` : contexte courant.

Relations principales :

```text
Contest 1 ── n User
Contest 1 ── n Task n ── n User
Category 1 ── n Task
Task 1 ── n Comment
Contest 1 ── n Message
User 1 ── n Notification
Contest 1 ── n AuditEvent
```

La relation catégorie-concours manque dans le modèle actuel.

## État et persistance

`AppProvider` initialise l'état avec `loadData()` en mode local, ou avec un
chargement Supabase après authentification :

1. lecture de `attelage-pilot-data-v1` dans `localStorage` en mode local ;
2. utilisation des données de démonstration si aucune donnée n'existe ;
3. chargement des concours, profils, catégories, tâches, messages,
   notifications et audit depuis Supabase après connexion Auth ;
4. migration légère des messages, notifications, événements, utilisateurs et
   versions de mot de passe en mode local ;
5. ajout des notifications d'échéance en mode local ;
6. exposition des données et actions via `useApp()`.

Chaque changement de l'état sérialise l'ensemble de `AppData`. Des écouteurs
rechargent le stockage sur modification depuis un autre onglet, focus de la
fenêtre ou changement de visibilité en mode local. Le mode Supabase conserve la
sélection courante uniquement en mémoire pendant la session React et recharge
le snapshot métier après authentification.

Limites :

- écriture globale et synchrone à chaque mutation ;
- aucune gestion de conflit entre onglets ;
- aucune validation de schéma ou migration versionnée de l'ensemble des données ;
- un JSON invalide réinitialise silencieusement sur les données de démonstration ;
- capacité et durée de vie dépendantes du navigateur.

## Schéma Supabase déployé

La migration initiale appliquée au projet lié crée :

- `contests`, `profiles` et `contest_members` ;
- `categories` et `manager_categories` ;
- `tasks`, `task_assignees` et `comments` ;
- `messages` et `message_reads` ;
- `notifications` et `audit_events`.

Les identifiants sont des UUID. Les relations composites garantissent qu'une
tâche, une catégorie, une assignation, un commentaire ou un message reste dans
son concours. Les statuts, priorités, rôles et types d'événements utilisent des
enums PostgreSQL. Des index couvrent les échéances, conversations,
notifications et journaux.

Toutes les tables ont RLS activé. La migration initiale révoque les privilèges
des rôles `anon` et `authenticated` et réserve l'accès à `service_role`. Les
politiques déployées ensuite ouvrent uniquement les opérations autorisées aux
membres authentifiés.

### Matrice RLS déployée

- visiteur anonyme : exécution des deux fonctions d'annuaire de connexion
  uniquement ;
- membre authentifié : lecture des données de ses concours ;
- bénévole assigné : modification limitée au statut de sa tâche par une
  politique et un trigger de contrôle ;
- responsable : modification des tâches et assignations de ses catégories ;
- administrateur : gestion des concours, catégories, tâches et supervision des
  échanges de son concours ;
- notifications : lecture du propriétaire ou de l'administrateur, marquage lu
  par le propriétaire ;
- audit : lecture administrateur et insertion par l'acteur concerné.

### Edge Functions

- `bootstrap-admin` crée une seule fois le premier compte Auth, son profil, son
  concours, son appartenance administrateur et les catégories initiales ;
- `create-contest` exige une session administrateur, crée un concours et ses
  catégories initiales, puis rattache l'acteur comme administrateur ;
- `delete-contest` exige une session administrateur et supprime un concours si
  au moins un autre concours reste disponible ;
- `manage-member` exige une session administrateur du concours pour créer un
  compte, réinitialiser son mot de passe ou retirer un membre du concours ;
- les identifiants Auth utilisent une adresse technique dérivée de l'UUID,
  invisible dans l'interface ;
- les clés secrètes restent exclusivement dans l'environnement Supabase.

### Transition frontend

`src/lib/supabaseApi.ts` fournit l'annuaire, la connexion par profil, le
bootstrap, la déconnexion, la gestion des concours, des membres et le
changement de mot de passe. `src/lib/supabaseData.ts` charge le snapshot métier
distant lorsque l'utilisateur est authentifié. Le store en mode Supabase
persiste les mutations principales de catégorie, tâche, commentaire, message,
lecture, création/suppression de concours et gestion des membres avant de
recharger l'état distant. `VITE_DATA_BACKEND` peut basculer vers `supabase`
pour activer ce chemin ; le maintien d'un mode local reste nécessaire tant que
toutes les mutations visibles n'ont pas été raccordées.

## Flux d'une mutation

Exemple d'une mise à jour de tâche :

1. une vue appelle `updateTask` ;
2. le store retrouve l'acteur et la tâche ;
3. le rôle détermine les champs autorisés ;
4. la tâche est remplacée immuablement ;
5. notifications et événements d'audit sont ajoutés ;
6. React restitue les vues ;
7. l'effet de persistance écrit le nouvel `AppData`.

Les permissions importantes sont donc implémentées dans `AppContext.tsx`.
Le masquage des boutons dans les composants n'est qu'une seconde couche
d'interface.

## Authentification locale

- en mode local, l'identifiant connecté est conservé uniquement pendant la
  session navigateur ;
- l'écran demande d'abord le concours et ne présente que ses profils ;
- chaque profil doit fournir son mot de passe ;
- au premier accès de l'administrateur initial, un mot de passe est dérivé avec
  PBKDF2 ;
- un administrateur peut définir ou réinitialiser le mot de passe d'un membre ;
- un membre peut modifier le sien après vérification du secret actuel ;
- seules l'empreinte, le sel et la version sont conservés ;
- la comparaison est effectuée côté navigateur ;
- en mode Supabase, l'authentification repose sur la session Auth distante et
  ne persiste plus dans le navigateur ;
- un administrateur connecté peut simuler un autre profil.

Ce dispositif empêche un accès administrateur accidentel via l'interface, mais
ne constitue pas une authentification sécurisée face à un utilisateur ayant
accès au stockage ou au code client.

Un profil importé par CSV sans mot de passe ne peut pas se connecter tant qu'un
administrateur ne l'a pas initialisé.

## Notifications, messages et audit

Les actions du store produisent des notifications d'assignation, commentaire,
message, statut ou échéance. Les lectures de messages sont enregistrées dans
`readByIds`.

Les mutations principales ajoutent un `AuditEvent`. Ce journal est persistant
localement et visible par les administrateurs, mais il n'est ni infalsifiable
ni exhaustif : certaines actions de paramétrage et de lecture ne sont pas
journalisées.

## Interface

`App.tsx` contient les vues :

- connexion ;
- tableau de bord ;
- liste des tâches ;
- Kanban ;
- timeline et Gantt ;
- catégories ;
- équipe et import CSV ;
- espace responsable ;
- notifications ;
- historique ;
- tâches personnelles ;
- avancement ;
- messagerie ;
- paramètres, concours et exports.

Les composants de `src/components/` extraient uniquement les éléments les plus
réutilisés. Les styles utilisent des classes globales, des variables CSS et
trois paliers responsive (`1100px`, `780px`, `420px`).

## Build et déploiement

`npm run build` enchaîne :

1. `tsc -b` pour les projets TypeScript ;
2. `vite build` pour produire `dist/`.

Le workflow GitHub Pages utilise Node.js 20, `npm ci`, le build, ajoute
`dist/.nojekyll`, puis publie l'artefact Pages. Vite génère des URLs relatives
avec `base: './'`.

## Dépendances importantes

- `react` et `react-dom` : rendu et état ;
- `lucide-react` : icônes ;
- `vite` et `@vitejs/plugin-react` : développement et build ;
- `typescript` : typage strict ;
- `eslint`, `typescript-eslint` et plugins React : analyse statique.

Les API navigateur (`Web Crypto`, stockage, Blob, URL et File) font également
partie des dépendances d'exécution.

## Export calendrier

Le détail d'une tâche peut générer localement un événement iCalendar conforme
au format RFC 5545. Une tâche sans heure produit un événement sur la journée ;
une tâche avec heure produit un créneau d'une heure en temps local. Le fichier
UTF-8 `.ics` contient le titre, la description, la catégorie, le concours et
le lieu, puis est ouvert ou importé par l'application calendrier choisie par
l'utilisateur.

## Conventions observées

- composants et types en `PascalCase` ;
- fonctions, variables et actions en `camelCase` ;
- unions TypeScript pour statuts, priorités et rôles ;
- imports relatifs sans alias ;
- composants fonctionnels et hooks ;
- mises à jour immuables avec `map`, `filter` et spread ;
- textes utilisateur en français ;
- points-virgules omis ;
- chaînes en apostrophes simples ;
- deux espaces d'indentation ;
- dates calendrier en `YYYY-MM-DD`, horodatages en ISO UTC ;
- heures d'échéance facultatives en `HH:mm` ;
- aucun framework de test ou de formatage automatique configuré.

## Risques techniques connus

- concentration excessive dans `App.tsx`, `AppContext.tsx` et `styles.css` ;
- isolation multi-concours incomplète ;
- données et autorisations exclusivement côté client ;
- absence de tests de permissions, migrations et suppressions en cascade ;
- artefacts et dépendances versionnés ;
- données globales parfois utilisées par des vues pourtant liées au concours actif ;
- chargement externe des polices ;
- recherche globale affichée dans l'en-tête mais non fonctionnelle.
