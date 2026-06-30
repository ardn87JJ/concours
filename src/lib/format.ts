import type { Priority, Task, TaskStatus, UserRole } from '../types'

export const statusLabels: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
  blocked: 'Bloquée',
}

export const priorityLabels: Record<Priority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Responsable catégorie',
  volunteer: 'Bénévole',
}

export const formatDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', options ?? { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))

export const formatDeadline = (task: Task, options?: Intl.DateTimeFormatOptions) =>
  `${formatDate(task.dueDate, options)}${task.dueTime ? ` à ${task.dueTime}` : ''}`

export const compareTaskDeadlines = (a: Task, b: Task) =>
  `${a.dueDate}T${a.dueTime ?? '23:59'}`.localeCompare(`${b.dueDate}T${b.dueTime ?? '23:59'}`)

export const isOverdue = (task: Task) =>
  task.status !== 'done' && new Date(`${task.dueDate}T${task.dueTime ?? '23:59:59'}`) < new Date()

export const daysUntil = (date: string) =>
  Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000)
