# Instructions permanentes pour Codex

## Avant toute modification

- Toujours lire `README.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`,
  `ROADMAP.md` et `CHANGELOG.md` avant toute modification.
- Lire également les fichiers directement concernés et vérifier l'état Git.
- Avant de coder, expliquer brièvement le plan d'action.
- Signaler les risques, incohérences ou zones ambiguës.
- Ne pas toucher aux données sensibles, fichiers d'environnement, sauvegardes
  utilisateur ou secrets.

## Pendant la modification

- Ne jamais remplacer un fichier entier sans expliquer pourquoi.
- Privilégier les modifications ciblées, minimales et non destructives.
- Ne supprimer aucun fichier sans demande ou validation explicite.
- Ne pas lancer de refonte globale.
- Ne pas ajouter de dépendance inutile.
- Ne pas inventer de fonctionnalités non demandées.
- Respecter l'architecture existante.
- Préserver les changements locaux qui ne relèvent pas de la tâche.
- Ne pas modifier manuellement `dist/`, `node_modules/`, `*.tsbuildinfo`,
  `vite.config.js` ou `vite.config.d.ts` : ce sont des artefacts ou dépendances.
- Conserver les contrôles d'autorisation dans `src/store/AppContext.tsx`, même
  si l'interface masque déjà une action.
- Toute évolution du modèle persistant doit inclure une stratégie de migration
  qui évite la perte des données existantes.
- Si une décision importante manque, ajouter une note dans
  `PROJECT_CONTEXT.md` ou `ROADMAP.md`.

## Validation

- Exécuter les contrôles proportionnés au changement.
- Pour le code applicatif, exécuter au minimum :

```bash
npm run build
npm run lint
```

- Documenter les erreurs TypeScript, build ou lint visibles sans les corriger
  automatiquement si elles sont hors périmètre.
- Ne pas considérer l'absence de tests automatisés comme une validation
  suffisante ; proposer les vérifications manuelles pertinentes.

## Après modification

- Résumer précisément les fichiers modifiés.
- Expliquer les validations exécutées et leur résultat.
- Lister les risques ou vérifications manuelles restantes.
- Maintenir `CHANGELOG.md` à jour après chaque modification importante.
- Mettre à jour `ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `ROADMAP.md` ou
  `README.md` si le comportement ou une décision décrite a changé.

## Contexte technique à préserver

- stack React 18, TypeScript strict et Vite 6 ;
- application frontend locale, sans backend ;
- stockage `localStorage` sous `attelage-pilot-data-v1` ;
- session `sessionStorage` sous `attelage-session-user` ;
- rôles `admin`, `manager`, `volunteer` ;
- interface en français ;
- déploiement GitHub Pages depuis `main` ;
- migrations Supabase versionnées dans `supabase/migrations` ;
- ne jamais exposer une clé `sb_secret_`, un mot de passe PostgreSQL ou un
  token personnel dans le frontend ou Git ;
- toutes les tables Supabase exposées doivent conserver RLS activé ;
- toute nouvelle opération frontend Supabase doit être couverte par une
  politique RLS ou une Edge Function authentifiée ;
- ne pas activer `VITE_DATA_BACKEND=supabase` avant que toutes les mutations
  visibles dans le parcours concerné soient raccordées ;
- conventions détaillées dans `ARCHITECTURE.md`.

## Points nécessitant une validation humaine

- matrice des rôles et permissions ;
- supervision administrateur des messages directs ;
- stratégie multi-concours ;
- changement de stockage ou ajout d'un backend ;
- migration des mots de passe ou de la clé de stockage ;
- règles de suppression en cascade ;
- modification du format CSV ;
- politique de suivi Git des dépendances et artefacts ;
- configuration de production et traitement de données personnelles.
