# Roadmap

Cette roadmap décrit l'état constaté au 30 juin 2026. Les priorités proposées
doivent être validées avant toute évolution fonctionnelle.

## Terminé

### Socle

- [x] application React/TypeScript avec Vite ;
- [x] modèle métier typé ;
- [x] état global et persistance `localStorage` ;
- [x] données de démonstration ;
- [x] interface responsive ;
- [x] lint et build configurés ;
- [x] déploiement GitHub Pages.
- [x] projet Supabase créé et lié ;
- [x] schéma PostgreSQL initial versionné ;
- [x] migration initiale appliquée sur le projet Supabase distant ;
- [x] politiques RLS par rôle et concours déployées ;
- [x] annuaire public limité pour l'écran de connexion ;
- [x] Edge Function de bootstrap déployée ;
- [x] Edge Function de création/réinitialisation des membres déployée ;
- [x] couche frontend Supabase pour Auth et gestion des comptes ;
- [x] RLS fermé et index du modèle métier ;
- [x] client Supabase préparé ;

### Organisation

- [x] tableau de bord et progression ;
- [x] CRUD des tâches ;
- [x] filtres, Kanban, timeline et Gantt ;
- [x] catégories modifiables ;
- [x] gestion et import CSV des membres ;
- [x] assignations multiples, commentaires et blocages ;
- [x] heure d'échéance facultative pour les tâches ;
- [x] ajout d'une tâche à un calendrier externe par fichier iCalendar ;
- [x] gestion initiale de plusieurs concours ;
- [x] export CSV et sauvegarde JSON.

### Collaboration et rôles

- [x] espaces administrateur, responsable et bénévole ;
- [x] sélection du concours avant l'affichage des profils de connexion ;
- [x] permissions métier de base dans le store ;
- [x] messagerie générale et directe ;
- [x] notifications et états de lecture ;
- [x] journal d'activité ;
- [x] simulation de profil par l'administrateur ;
- [x] mot de passe obligatoire pour tous les profils ;
- [x] création et réinitialisation du mot de passe d'un membre par
  l'administrateur ;
- [x] modification du mot de passe par le membre avec vérification du secret
  actuel ;
- [x] synchronisation entre onglets et au retour du focus.

### Documentation

- [x] mémoire projet initiale ;
- [x] architecture et contexte documentés ;
- [x] règles permanentes Codex ;
- [x] changelog initial.

## En cours ou partiellement terminé

- [~] multi-concours : écrans et identifiants présents, isolation des catégories,
  profils, notifications et parcours de création incomplète ;
- [~] authentification : écran de connexion et session Supabase branchés, mais
  la synchronisation des écritures métier n'est pas encore complète ;
- [~] migrations : quelques valeurs par défaut et version de mot de passe,
  sans version globale du schéma ;
- [~] synchronisation : entre onglets d'un même stockage seulement, sans
  résolution de conflit ;
- [~] historique : couvre les principales mutations, pas toutes les actions ;
- [~] recherche : champ visuel présent dans l'en-tête, sans comportement ;
- [~] sauvegarde : export disponible, restauration absente.

## Priorité 0 — Stabiliser le dépôt

- [ ] valider la mémoire projet avec le propriétaire ;
- [ ] décider du statut de `node_modules/`, `dist/`, `*.tsbuildinfo` et des
  fichiers JS/déclarations générés ;
- [ ] ajouter une politique `.gitignore` dans une intervention dédiée ;
- [ ] confirmer la stratégie de publication GitHub Pages et la valeur `base` ;
- [ ] définir les versions Node/npm supportées ;
- [ ] ajouter une vérification CI du lint en plus du build ;
- [ ] vérifier manuellement le site GitHub Pages.

## Priorité 1 — Sécuriser le comportement existant

- [ ] ajouter des tests unitaires aux règles du store, CSV et mots de passe ;
- [ ] ajouter des tests de parcours critiques : connexion, droits, suppression,
  import, export et changement de concours ;
- [ ] versionner le schéma `AppData` et définir des migrations explicites ;
- [ ] éviter la perte silencieuse des données si le stockage est invalide ;
- [ ] clarifier et corriger l'isolation multi-concours ;
- [ ] valider le parcours de création du premier administrateur d'un concours ;
- [ ] filtrer systématiquement utilisateurs, tâches, messages, notifications et
  événements par concours ;
- [ ] documenter ou implémenter une restauration de sauvegarde.

## Priorité 2 — Préparer un usage réel

- [x] choisir Supabase comme backend ;
- [~] définir API, base de données, comptes, sessions, rôles et migrations :
  schéma initial prêt, politiques et fonctions Auth restantes ;
- [x] exécuter le bootstrap du premier concours et administrateur ;
- [ ] migrer les données de démonstration ;
- [~] remplacer progressivement `AppContext` par les requêtes Supabase :
  couche Auth et chargement distant prêts, écritures métier restantes ;
- [ ] activer et tester les abonnements Realtime ;
- [ ] définir les exigences RGPD et la politique de conservation ;
- [ ] faire valider la supervision des messages directs ;
- [ ] ajouter sauvegarde, synchronisation et récupération de compte ;
- [ ] définir les environnements développement, préproduction et production.

## Priorité 3 — Maintenabilité et ergonomie

- [ ] découper progressivement `App.tsx` par vue, sans refonte globale ;
- [ ] séparer les domaines du store si les tests garantissent le comportement ;
- [ ] structurer les styles par responsabilité ou composant ;
- [ ] rendre la recherche globale fonctionnelle ou retirer son affordance ;
- [ ] ajouter des états d'erreur et confirmations cohérents ;
- [ ] réaliser un audit d'accessibilité ;
- [ ] mesurer les performances sur mobile.

## Hors périmètre tant qu'ils ne sont pas demandés

- application mobile native ;
- paiement ou inscriptions des concurrents ;
- résultats sportifs et classement ;
- intégration à une fédération ;
- automatisation email/SMS ;
- gestion documentaire avancée ;
- refonte graphique globale.

## Prochaine étape recommandée

Effectuer un lot de stabilisation du dépôt, séparé des changements métier :

1. faire valider les ambiguïtés listées dans `PROJECT_CONTEXT.md` ;
2. nettoyer le suivi des artefacts avec une politique Git explicite ;
3. ajouter une base de tests sur le store actuel ;
4. seulement ensuite corriger l'isolation multi-concours.

Ce séquencement réduit le risque de modifier des règles métier sans filet de
régression.

## Dernière avancée constatée

- connexion distante branchée sur le backend Supabase ;
- chargement des concours et profils de connexion depuis Supabase ;
- chargement du snapshot métier depuis Supabase après authentification ;
- le stockage local reste en secours pour le mode non Supabase.
