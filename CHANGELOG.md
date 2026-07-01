# Changelog

Les modifications importantes du projet sont consignées ici. Le format
s'inspire de Keep a Changelog et le projet utilise actuellement la version
applicative `0.1.0`.

## [Non publié]

### Ajouté

- vue bénévole repensée pour mobile avec cartes colorées, statistiques lisibles
  et détail des tâches dépliable directement dans la liste ;
- commandes tactiles de statut, commentaires et ajout au calendrier intégrés
  au détail déplié des tâches bénévoles.
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
- Edge Functions `create-contest` et `delete-contest` pour la gestion serveur
  des concours ;
- suppression de membre côté serveur avec vérification de rôle et nettoyage des
  rattachements ;
- script interactif de création du premier concours et administrateur ;
- couche frontend Supabase pour l'annuaire, Auth et la gestion des comptes,
  gardée derrière un mode de transition explicite.
- écran de connexion Supabase alimenté par l'annuaire public du concours ;
- chargement du snapshot métier depuis Supabase après authentification ;
- mutations Supabase branchées pour catégories, tâches, commentaires,
  messages, lectures, notifications, création/suppression de concours et
  gestion des membres ;
- gestion en mémoire de la sélection de concours et du profil courant pendant
  la session React en mode Supabase.
- suppression de toute persistance navigateur en mode Supabase : plus de
  `sessionStorage` ni de session Auth conservée entre rechargements.

### Corrigé

- l'import CSV attend désormais la création effective des profils Supabase,
  conserve les lignes échouées et affiche les erreurs au lieu de confirmer
  prématurément l'opération.
- les Edge Functions authentifiées valident désormais la session dans leur
  propre code sans dépendre du contrôle JWT historique incompatible avec les
  nouvelles clés Supabase ; les messages d'erreur serveur sont transmis au
  frontend.
- les prérequêtes CORS des Edge Functions acceptent tous les en-têtes envoyés
  automatiquement par `supabase-js`, notamment `x-client-info`, afin que les
  créations de membres atteignent effectivement le serveur.
- les profils importés conservent désormais un état « mot de passe à
  initialiser » ; leur première connexion permet de créer directement le mot
  de passe personnel, sans vérification du contact.
- la création manuelle d’un membre utilise désormais l’identifiant Supabase
  réellement créé avant de définir son mot de passe initial.
- la longueur minimale applicative des mots de passe passe de 8 à 6 caractères,
  qui est la limite minimale imposée par Supabase Auth.
- le compositeur de messages reste ancré dans la zone visible sur mobile et
  lorsque le clavier virtuel réduit la hauteur disponible ; les vues de
  supervision indiquent explicitement leur mode lecture seule.
- la hauteur minimale fixe de la messagerie est supprimée sur ordinateur afin
  que le champ d’envoi reste visible dans les fenêtres de faible hauteur.
- l’envoi de message attend désormais la réponse Supabase, recharge le message
  dès son insertion et affiche les erreurs au lieu de les ignorer ; le panneau
  desktop utilise une colonne flexible indépendante de CSS Grid.
- l’écriture d’un message, de son état de lecture, de ses notifications et de
  son audit est regroupée dans une fonction SQL transactionnelle ; le
  compositeur est positionné explicitement au bas de toute conversation
  sélectionnée.
- la ligne Grid implicite de la messagerie est contrainte à la hauteur du
  panneau, empêchant une longue liste de membres de repousser le compositeur
  plusieurs écrans plus bas sur ordinateur.
- les messages directs, leurs aperçus et leur état « Vous » utilisent désormais
  exclusivement l’identité réellement authentifiée.
- la supervision administrateur des conversations privées est supprimée :
  chaque échange direct est visible uniquement par ses deux participants.
- les messages, lectures, notifications de messagerie et audits existants sont
  purgés afin de repartir avec un historique cohérent.

### Vérifié

- `npm run build` réussi le 30 juin 2026 ;
- `npm run lint` réussi le 30 juin 2026.
- `npm run build` et `npm run lint` réussis le 1er juillet 2026.

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
