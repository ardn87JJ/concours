# Changelog

Les modifications importantes du projet sont consignées ici. Le format
s'inspire de Keep a Changelog et le projet utilise actuellement la version
applicative `0.1.0`.

## [Non publié]

### Ajouté

- mémoire projet pérenne avec contexte, architecture, roadmap et consignes Codex ;
- documentation des prérequis, scripts, flux, conventions et limites ;
- inventaire des risques techniques et des validations manuelles attendues.
- sélection obligatoire du concours sur l'écran de connexion avant l'affichage
  des profils correspondants.
- mot de passe obligatoire à la connexion de chaque profil ;
- définition du mot de passe initial lors de la création d'un membre ;
- réinitialisation du mot de passe d'un membre par un administrateur ;
- page « Mon profil » permettant à chaque membre de modifier son mot de passe
  après vérification du secret actuel ;
- indicateur de configuration du mot de passe dans les fiches membres.
- navigation mobile dédiée entre la liste des conversations et le chat, afin
  de maintenir le champ d'envoi visible sur les profils standards.
- heure d'échéance facultative pour les tâches, affichée dans les principales
  vues et incluse dans l'export CSV.
- export iCalendar `.ics` d'une tâche depuis sa fiche, avec prise en charge des
  événements journée entière et des échéances horaires.
- configuration locale Supabase et variables publiques d'exemple ;
- migration PostgreSQL initiale avec modèle multi-concours, contraintes,
  index et RLS fermé ;
- déploiement vérifié de la migration initiale sur le projet Supabase lié ;
- client officiel `@supabase/supabase-js` préparé sans basculement immédiat du
  stockage local ;
- politique `.gitignore` pour les environnements, dépendances et artefacts
  générés.
- politiques RLS déployées pour les administrateurs, responsables, bénévoles,
  messages, notifications et audit ;
- annuaire de connexion public limité, sans exposition des contacts ;
- Edge Functions `bootstrap-admin` et `manage-member` déployées ;
- script interactif de création du premier concours et administrateur ;
- couche frontend Supabase pour l'annuaire, Auth et la gestion des comptes,
  gardée derrière un mode de transition explicite.
- écran de connexion Supabase alimenté par l'annuaire public du concours ;
- chargement du snapshot métier depuis Supabase après authentification ;
- mutations Supabase branchées pour catégories, tâches, commentaires,
  messages, lectures et notifications ;
- persistance de la sélection de concours et du profil courant dans la session
  du navigateur pour le mode Supabase.

### Vérifié

- `npm run build` réussi le 30 juin 2026 ;
- `npm run lint` réussi le 30 juin 2026.

### Points connus

- multi-concours incomplet, notamment pour les catégories et l'initialisation
  des utilisateurs ;
- authentification locale non adaptée à un usage de production ;
- absence de tests automatisés ;
- recherche d'en-tête non fonctionnelle ;
- dépendances, build et sorties TypeScript actuellement suivis par Git ;
- artefacts `dist/` localement divergents du dernier commit avant la création
  de cette documentation ;
- synchronisation des écritures métier Supabase encore incomplète sur le front ;
- lecture distante branchée, mais migration des mutations locales vers Supabase
  encore en cours.

## [0.1.0] - 2026-06-29

### Ajouté

- première version fonctionnelle d'Attelage Pilot ;
- données de démonstration pour un concours, neuf utilisateurs, huit catégories
  et trente-six tâches ;
- tableaux de bord, tâches, Kanban, timeline, Gantt et progression ;
- gestion des tâches, catégories, utilisateurs et concours ;
- espaces par rôle et permissions côté client ;
- import CSV, export CSV et sauvegarde JSON ;
- commentaires, blocages, notifications, messages et journal d'activité ;
- connexion locale et mot de passe administrateur PBKDF2 ;
- publication automatisée sur GitHub Pages.

### Modifié

- ajout des actions administrateur d'édition et suppression ;
- rattachement des utilisateurs aux concours ;
- filtrage des profils de connexion par concours ;
- synchronisation du stockage au focus, au changement de visibilité et entre
  onglets ;
- correction des chemins d'assets GitHub Pages, puis adoption d'une base Vite
  relative.

## Règle de maintenance

Après toute modification importante, ajouter une entrée sous `[Non publié]`
dans la rubrique appropriée : `Ajouté`, `Modifié`, `Corrigé`, `Supprimé`,
`Sécurité`, `Vérifié` ou `Points connus`. Ne pas réécrire l'historique publié.
