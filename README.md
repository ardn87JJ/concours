# Attelage Pilot

Première version fonctionnelle d’une application de préparation et de suivi d’un concours d’attelage.

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir l’adresse indiquée par Vite.

## Architecture

- `src/types` : modèle de données métier
- `src/data` : jeu de démonstration (1 concours, 9 utilisateurs, 8 catégories, 36 tâches)
- `src/store` : état applicatif et persistance `localStorage`
- `src/lib` : règles et formatage partagés
- `src/components` : composants réutilisables
- `src/App.tsx` : navigation et vues de la V1

## Fonctionnalités de la V1

- tableau de bord et indicateurs administrateur ;
- liste filtrable, Kanban et timeline ;
- création, modification et suppression de tâches ;
- assignation multiple, commentaires et signalement de blocage ;
- gestion simple des catégories et utilisateurs ;
- espace bénévole simplifié ;
- changement de profil simulé avec restriction des vues ;
- import CSV des membres avec validation et détection des doublons ;
- planning en timeline ou diagramme de Gantt ;
- messagerie d’équipe avec canal général et conversations directes ;
- messages non lus et centre de notifications (assignations, commentaires, messages, statuts et échéances) ;
- espace responsable avec modification et réassignation des tâches de ses catégories ;
- journal d’activité réservé aux administrateurs ;
- export CSV des tâches et sauvegarde JSON sans données de mot de passe ;
- écran de connexion local par sélection de profil et simulation réservée aux administrateurs ;
- protection des profils administrateurs par mot de passe dérivé avec PBKDF2-SHA-256 ;
- interface responsive et données persistées dans le navigateur.

## Format CSV des membres

Le séparateur peut être `;` ou `,`. Le fichier doit être encodé en UTF-8.

```csv
nom;role;email;telephone
Marie Dupont;bénévole;marie.dupont@example.fr;06 12 34 56 78
Paul Martin;responsable catégorie;paul.martin@example.fr;
Anne Bernard;administrateur;;06 98 76 54 32
```

`nom` et `role` sont obligatoires. Chaque ligne doit aussi contenir au moins un
email ou un téléphone. Les rôles acceptés sont `administrateur`,
`responsable catégorie` et `bénévole`.

La couche de stockage est isolée dans `src/store/AppContext.tsx`, ce qui permet de la remplacer ensuite par une API avec authentification sans réécrire les vues.

## Publication sur GitHub Pages

Le projet est déjà configuré pour être publié via GitHub Actions.

1. Pousse le code sur le dépôt `https://github.com/ardn87JJ/concours.git`.
2. Crée ou vérifie la branche `main`.
3. Dans GitHub, ouvre `Settings > Pages`.
4. Dans `Build and deployment`, choisis `GitHub Actions`.
5. À chaque push sur `main`, le workflow génère `dist/` puis déploie l'application.

Le `base` Vite est réglé sur `/concours/`, ce qui correspond au chemin GitHub Pages du dépôt `concours`, quel que soit le compte propriétaire.

Si le site est publié via GitHub Pages utilisateur, l'URL finale sera en pratique du type `https://ardn87jj.github.io/concours/`.
