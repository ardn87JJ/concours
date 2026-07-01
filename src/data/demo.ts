import type { AppData, Category, Priority, Task, TaskStatus, User } from '../types'

const contestId = 'contest-1'

export const categories: Category[] = [
  { id: 'cat-terrain', name: 'Terrain & pistes', color: '#2f7459', icon: '🌿' },
  { id: 'cat-chevaux', name: 'Boxes & chevaux', color: '#a8663b', icon: '🐴' },
  { id: 'cat-benevoles', name: 'Bénévoles', color: '#d38a28', icon: '🤝' },
  { id: 'cat-securite', name: 'Sécurité', color: '#c64c4c', icon: '🛡️' },
  { id: 'cat-officiels', name: 'Jury & officiels', color: '#7555a5', icon: '⚖️' },
  { id: 'cat-restauration', name: 'Restauration', color: '#d6637d', icon: '☕' },
  { id: 'cat-communication', name: 'Communication', color: '#347ca5', icon: '📣' },
  { id: 'cat-logistique', name: 'Matériel & logistique', color: '#5c6570', icon: '🔧' },
]

export const users: User[] = [
  { id: 'u1', contestId, name: 'Claire Martin', role: 'admin', contact: 'claire@attelage.fr', initials: 'CM', color: '#345f50' },
  { id: 'u2', contestId, name: 'Julien Moreau', role: 'manager', contact: '06 18 25 32 40', initials: 'JM', color: '#93633d', managedCategoryIds: ['cat-terrain', 'cat-logistique'] },
  { id: 'u3', contestId, name: 'Sophie Bernard', role: 'manager', contact: 'sophie@attelage.fr', initials: 'SB', color: '#6b5a97', managedCategoryIds: ['cat-chevaux', 'cat-officiels'] },
  { id: 'u4', contestId, name: 'Thomas Leroy', role: 'manager', contact: '06 22 44 65 81', initials: 'TL', color: '#33758a', managedCategoryIds: ['cat-benevoles', 'cat-securite'] },
  { id: 'u5', contestId, name: 'Émilie Roux', role: 'volunteer', contact: '06 30 11 29 74', initials: 'ER', color: '#b35d71' },
  { id: 'u6', contestId, name: 'Marc Petit', role: 'volunteer', contact: 'marc.petit@mail.fr', initials: 'MP', color: '#667b42' },
  { id: 'u7', contestId, name: 'Nathalie Simon', role: 'volunteer', contact: '06 41 58 69 20', initials: 'NS', color: '#b57532' },
  { id: 'u8', contestId, name: 'Lucas Fontaine', role: 'volunteer', contact: '06 70 32 18 95', initials: 'LF', color: '#476a9d' },
  { id: 'u9', contestId, name: 'Manon Dubois', role: 'volunteer', contact: 'manon.dubois@mail.fr', initials: 'MD', color: '#856b4d' },
]

const taskSeed: Array<[string, string, TaskStatus, Priority, string, string[]]> = [
  ['Faire l’état des lieux des pistes', 'cat-terrain', 'done', 'high', '2026-08-18', ['u2']],
  ['Commander le sable pour la carrière', 'cat-terrain', 'in_progress', 'urgent', '2026-08-25', ['u2', 'u6']],
  ['Baliser le parcours de marathon', 'cat-terrain', 'todo', 'high', '2026-09-10', ['u2', 'u6', 'u8']],
  ['Installer les obstacles de maniabilité', 'cat-terrain', 'todo', 'high', '2026-09-11', ['u2', 'u8']],
  ['Tondre les abords et zones public', 'cat-terrain', 'todo', 'normal', '2026-09-08', ['u6']],
  ['Contrôler le drainage de la carrière', 'cat-terrain', 'blocked', 'high', '2026-09-02', ['u2']],
  ['Réserver les boxes démontables', 'cat-chevaux', 'done', 'high', '2026-08-15', ['u3']],
  ['Établir le plan des boxes', 'cat-chevaux', 'in_progress', 'normal', '2026-09-01', ['u3', 'u9']],
  ['Préparer les points d’eau chevaux', 'cat-chevaux', 'todo', 'high', '2026-09-11', ['u9']],
  ['Organiser la zone vétérinaire', 'cat-chevaux', 'todo', 'high', '2026-09-09', ['u3']],
  ['Recruter 25 bénévoles', 'cat-benevoles', 'in_progress', 'urgent', '2026-08-28', ['u4']],
  ['Créer le planning des bénévoles', 'cat-benevoles', 'todo', 'high', '2026-09-04', ['u4', 'u5']],
  ['Préparer le briefing des équipes', 'cat-benevoles', 'todo', 'normal', '2026-09-10', ['u4']],
  ['Distribuer badges et chasubles', 'cat-benevoles', 'todo', 'normal', '2026-09-12', ['u5']],
  ['Valider le dispositif de secours', 'cat-securite', 'done', 'urgent', '2026-08-20', ['u1', 'u4']],
  ['Installer barrières et rubalise', 'cat-securite', 'todo', 'high', '2026-09-11', ['u4', 'u8']],
  ['Contrôler les extincteurs', 'cat-securite', 'todo', 'normal', '2026-09-09', ['u8']],
  ['Afficher les numéros d’urgence', 'cat-securite', 'todo', 'high', '2026-09-11', ['u5']],
  ['Confirmer les juges et commissaires', 'cat-officiels', 'done', 'high', '2026-08-12', ['u1', 'u3']],
  ['Réserver les hébergements officiels', 'cat-officiels', 'in_progress', 'normal', '2026-08-30', ['u3']],
  ['Préparer les dossiers du jury', 'cat-officiels', 'todo', 'high', '2026-09-07', ['u3', 'u9']],
  ['Installer la tribune du jury', 'cat-officiels', 'todo', 'normal', '2026-09-11', ['u6']],
  ['Choisir le prestataire restauration', 'cat-restauration', 'done', 'normal', '2026-08-10', ['u7']],
  ['Commander les repas bénévoles', 'cat-restauration', 'in_progress', 'high', '2026-09-03', ['u7']],
  ['Organiser le café d’accueil', 'cat-restauration', 'todo', 'normal', '2026-09-12', ['u7', 'u5']],
  ['Prévoir les tickets repas', 'cat-restauration', 'todo', 'low', '2026-09-08', ['u7']],
  ['Publier le programme en ligne', 'cat-communication', 'in_progress', 'high', '2026-09-01', ['u1', 'u5']],
  ['Créer la signalétique directionnelle', 'cat-communication', 'todo', 'high', '2026-09-05', ['u5', 'u8']],
  ['Préparer les publications réseaux sociaux', 'cat-communication', 'in_progress', 'normal', '2026-09-06', ['u5']],
  ['Contacter la presse locale', 'cat-communication', 'todo', 'normal', '2026-09-02', ['u1']],
  ['Faire l’inventaire du matériel', 'cat-logistique', 'done', 'high', '2026-08-22', ['u6']],
  ['Louer les radios et talkies-walkies', 'cat-logistique', 'blocked', 'urgent', '2026-09-03', ['u6']],
  ['Installer tables, chaises et barnums', 'cat-logistique', 'todo', 'high', '2026-09-11', ['u6', 'u8']],
  ['Préparer les lots et récompenses', 'cat-logistique', 'in_progress', 'normal', '2026-09-08', ['u9']],
  ['Organiser le nettoyage du site', 'cat-logistique', 'todo', 'normal', '2026-09-14', ['u6', 'u7']],
  ['Tester la sonorisation', 'cat-logistique', 'todo', 'high', '2026-09-11', ['u6']],
]

export const demoData: AppData = {
  contests: [{
    id: contestId,
    name: 'Concours d’Attelage du Val d’Or',
    location: 'Domaine équestre de Saint-Laurent',
    startDate: '2026-09-12',
    endDate: '2026-09-13',
    description: 'Concours national d’attelage — dressage, marathon et maniabilité.',
    color: '#1f5746',
  }],
  categories,
  users,
  tasks: taskSeed.map(([title, categoryId, status, priority, dueDate, assigneeIds], index): Task => {
    const start = new Date(`${dueDate}T12:00:00`)
    start.setDate(start.getDate() - (4 + index % 8))
    return {
    id: `task-${index + 1}`,
    contestId,
    title,
    description: `Préparer et valider : ${title.toLocaleLowerCase('fr')}.`,
    categoryId,
    status,
    priority,
    startDate: start.toISOString().slice(0, 10),
    dueDate,
    assigneeIds,
    comments: index === 5 ? [{
      id: 'comment-1',
      authorId: 'u2',
      text: 'En attente du passage de l’entreprise de terrassement.',
      createdAt: '2026-08-27T09:30:00.000Z',
    }] : [],
    createdAt: '2026-08-01T08:00:00.000Z',
  }}),
  messages: [
    { id: 'message-1', contestId, senderId: 'u1', text: 'Bonjour à tous, bienvenue dans l’espace d’organisation du concours !', createdAt: '2026-08-25T08:30:00.000Z', readByIds: ['u1'] },
    { id: 'message-2', contestId, senderId: 'u4', text: 'Le recrutement des bénévoles avance bien. Il reste encore cinq postes à pourvoir.', createdAt: '2026-08-25T09:12:00.000Z', readByIds: ['u4'] },
    { id: 'message-3', contestId, senderId: 'u2', text: 'Je partage le plan définitif du parcours dès validation du terrain.', createdAt: '2026-08-25T10:05:00.000Z', readByIds: ['u2'] },
    { id: 'message-4', contestId, senderId: 'u3', recipientId: 'u1', text: 'Les hébergements des officiels sont presque tous confirmés.', createdAt: '2026-08-26T14:20:00.000Z', readByIds: ['u3'] },
  ],
  notifications: [],
  auditLog: [],
  activeContestId: contestId,
  currentUserId: 'u1',
}
