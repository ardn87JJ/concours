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
localStorage du navigateur
```

Il n'existe actuellement ni routeur, ni serveur applicatif, ni API, ni base de
données. La navigation repose sur un état React `view`.

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
| `src/styles.css` | design global et responsive |
| `index.html` | point d'entrée HTML Vite |
| `vite.config.ts` | configuration Vite et base relative |
| `eslint.config.js` | règles ESLint TypeScript/React |
| `tsconfig*.json` | compilation TypeScript par références |
| `.github/workflows/deploy.yml` | build et publication GitHub Pages |
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

`AppProvider` initialise l'état avec `loadData()` :

1. lecture de `attelage-pilot-data-v1` dans `localStorage` ;
2. utilisation des données de démonstration si aucune donnée n'existe ;
3. migration légère des messages, notifications, événements, utilisateurs et
   versions de mot de passe ;
4. ajout des notifications d'échéance ;
5. exposition des données et actions via `useApp()`.

Chaque changement de l'état sérialise l'ensemble de `AppData`. Des écouteurs
rechargent le stockage sur modification depuis un autre onglet, focus de la
fenêtre ou changement de visibilité.

Limites :

- écriture globale et synchrone à chaque mutation ;
- aucune gestion de conflit entre onglets ;
- aucune validation de schéma ou migration versionnée de l'ensemble des données ;
- un JSON invalide réinitialise silencieusement sur les données de démonstration ;
- capacité et durée de vie dépendantes du navigateur.

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

- l'identifiant connecté est stocké dans `sessionStorage` ;
- l'écran demande d'abord le concours et ne présente que ses profils ;
- chaque profil doit fournir son mot de passe ;
- au premier accès de l'administrateur initial, un mot de passe est dérivé avec
  PBKDF2 ;
- un administrateur peut définir ou réinitialiser le mot de passe d'un membre ;
- un membre peut modifier le sien après vérification du secret actuel ;
- seules l'empreinte, le sel et la version sont conservés ;
- la comparaison est effectuée côté navigateur ;
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
