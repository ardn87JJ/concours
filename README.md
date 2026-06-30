# Attelage Pilot

Attelage Pilot est une application web de préparation et de suivi d'un concours
d'attelage. Elle centralise les tâches, responsables, bénévoles, échéances,
messages et indicateurs d'avancement d'une équipe organisatrice.

La version actuelle est un prototype frontend autonome : elle ne possède ni API
ni base de données et conserve toutes les données dans le navigateur.

## État du projet

- version du paquet : `0.1.0` ;
- branche principale : `main` ;
- frontend fonctionnel et responsive ;
- build TypeScript et lint valides au 30 juin 2026 ;
- déploiement automatisé sur GitHub Pages ;
- aucun test automatisé ;
- usage de production non recommandé sans backend et authentification serveur.

Lire impérativement les documents suivants avant toute modification :

- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) : vision, règles métier et limites ;
- [ARCHITECTURE.md](./ARCHITECTURE.md) : structure et flux techniques ;
- [ROADMAP.md](./ROADMAP.md) : état des fonctionnalités et priorités ;
- [CHANGELOG.md](./CHANGELOG.md) : historique fonctionnel et technique ;
- [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md) : règles de contribution Codex.

## Stack

- React 18 ;
- TypeScript 5.6 en mode strict ;
- Vite 6 ;
- CSS global sans framework ;
- Lucide React pour les icônes ;
- Context API et `localStorage` pour l'état et la persistance ;
- Web Crypto API pour les mots de passe des profils ;
- ESLint 9 ;
- GitHub Actions et GitHub Pages.

## Prérequis

- Node.js 20 recommandé, identique au workflow GitHub Actions ;
- npm, avec le fichier `package-lock.json` fourni ;
- navigateur moderne prenant en charge `crypto.subtle`, `crypto.randomUUID`,
  `localStorage` et `sessionStorage`.

## Installation

```bash
git clone https://github.com/ardn87JJ/concours.git
cd concours
npm ci
```

Pour une installation locale sans exigence de reproductibilité, `npm install`
fonctionne également, mais `npm ci` est préférable.

## Lancement

```bash
npm run dev
```

Ouvrir ensuite l'URL affichée par Vite, généralement
`http://localhost:5173`.

La première connexion de l'administrateur initial demande de créer son mot de
passe. Il doit ensuite définir les mots de passe des autres membres depuis la
gestion de l'équipe. Chaque membre peut modifier son propre mot de passe depuis
la page « Mon profil ».

## Scripts disponibles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | démarre le serveur Vite de développement |
| `npm run build` | vérifie TypeScript puis génère le build dans `dist/` |
| `npm run lint` | analyse les fichiers TypeScript et TSX avec ESLint |
| `npm run preview` | sert localement le dernier contenu de `dist/` |

Il n'existe actuellement ni script de test, ni suite de tests automatisés.

## Fonctionnalités présentes

- connexion locale par sélection de profil ;
- protection PBKDF2 de tous les profils ;
- rôles administrateur, responsable de catégorie et bénévole ;
- tableau de bord, indicateurs, échéances et progression ;
- listes filtrables, Kanban, timeline et Gantt ;
- création, modification, assignation et suppression des tâches ;
- heure d'échéance facultative pour les tâches ;
- export d'une tâche au format calendrier `.ics`, compatible avec les
  principales applications de calendrier ;
- commentaires et signalement des blocages ;
- gestion des catégories, utilisateurs et concours ;
- import CSV des membres et export CSV des tâches ;
- sauvegarde JSON sans empreintes de mot de passe ;
- espaces adaptés aux responsables et bénévoles ;
- messagerie générale, messages directs et supervision administrateur ;
- notifications et journal d'activité ;
- synchronisation locale entre onglets et au retour du focus ;
- interface responsive.

## Format CSV des membres

Le séparateur peut être `;` ou `,` et le fichier doit être en UTF-8.

```csv
nom;role;email;telephone
Marie Dupont;bénévole;marie.dupont@example.fr;06 12 34 56 78
Paul Martin;responsable catégorie;paul.martin@example.fr;
Anne Bernard;administrateur;;06 98 76 54 32
```

`nom` et `role` sont obligatoires. Chaque ligne doit contenir au moins un email
ou un téléphone. Les rôles reconnus sont `administrateur`,
`responsable catégorie` et `bénévole`, avec quelques alias documentés dans
`src/lib/csv.ts`.

## Données et sécurité

La clé de stockage est `attelage-pilot-data-v1`. Toutes les données métier et
les empreintes des mots de passe résident dans le
`localStorage` du navigateur. La session active est conservée dans
`sessionStorage` sous `attelage-session-user`.

Conséquences :

- aucune synchronisation entre appareils ou navigateurs ;
- aucune sauvegarde serveur ;
- les données peuvent être perdues si le stockage du navigateur est effacé ;
- les profils sans mot de passe configuré ne peuvent pas se connecter ;
- les contrôles de rôle sont uniquement exécutés côté client ;
- l'application ne doit pas recevoir de données personnelles sensibles.

Utiliser l'export JSON avant toute opération risquée. Ne jamais committer de
fichier d'environnement, sauvegarde utilisateur ou donnée réelle.

## Structure rapide

```text
src/
├── components/       composants d'interface réutilisables
├── data/             données de démonstration
├── lib/              CSV, dates, libellés et mots de passe
├── store/            état global, règles d'action et persistance
├── types/            modèle TypeScript
├── App.tsx           navigation et vues principales
├── main.tsx          point d'entrée React
└── styles.css        styles globaux et responsive
```

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour le détail.

## Publication

Le workflow `.github/workflows/deploy.yml` exécute `npm ci`, puis
`npm run build`, et publie `dist/` sur GitHub Pages à chaque push sur `main`.
Le `base` Vite vaut actuellement `./`, afin de produire des chemins relatifs.

Dans GitHub, `Settings > Pages > Build and deployment` doit utiliser
`GitHub Actions`. L'URL attendue est :
<https://ardn87jj.github.io/concours/>.

## Points d'attention pour contribuer

- ne pas modifier directement les bundles de `dist/` ;
- ne pas traiter `node_modules/` comme du code source ;
- préserver les données locales lors d'une évolution du modèle ;
- appliquer les autorisations à la fois dans l'interface et dans le store ;
- limiter les modifications ciblées dans `App.tsx`, actuellement très volumineux ;
- documenter toute décision importante dans la mémoire projet.
