import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, CalendarPlus, MessageSquare, Trash2, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { Priority, Task, TaskStatus } from '../types'
import { downloadTaskCalendar } from '../lib/calendar'
import { Avatar } from './Avatar'
import { priorityLabels, statusLabels } from '../lib/format'

interface Props {
  task?: Task
  onClose: () => void
  embedded?: boolean
}

export function TaskModal({ task, onClose, embedded = false }: Props) {
  const { activeContestId, contests, categories, users, currentUserId, addTask, updateTask, deleteTask, addComment } = useApp()
  const currentUser = users.find(user => user.id === currentUserId)
  const contest = contests.find(item => item.id === activeContestId)
  const isAdmin = currentUser?.role === 'admin'
  const isManager = Boolean(task && currentUser?.role === 'manager' && (currentUser.managedCategoryIds ?? []).includes(task.categoryId))
  const canEdit = Boolean(isAdmin || isManager)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? categories[0]?.id ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal')
  const [startDate, setStartDate] = useState(task?.startDate ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? [])
  const [comment, setComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const values = { title, description, categoryId, status, priority, startDate: startDate || undefined, dueDate, dueTime: dueTime || undefined, assigneeIds }
    if (task) updateTask(task.id, canEdit ? values : { status })
    else addTask({ ...values, contestId: activeContestId })
    onClose()
  }

  const toggleAssignee = (id: string) =>
    setAssigneeIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  const content = (
      <div className={`modal ${embedded ? 'embedded-task' : ''}`}>
        <header className="modal-header">
          <div><span className="eyebrow">{task ? embedded ? 'Modification dans la page' : 'Détail de la tâche' : 'Nouvelle tâche'}</span><h2>{task ? task.title : 'Créer une tâche'}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={21} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field full"><span>Titre</span><input disabled={!canEdit} required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Installer la signalétique" /></label>
            <label className="field full"><span>Description</span><textarea disabled={!canEdit} value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Informations utiles pour l’équipe…" /></label>
            <div className="form-grid">
              <label className="field"><span>Catégorie</span><select disabled={!isAdmin} value={categoryId} onChange={e => setCategoryId(e.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}</select></label>
              <label className="field"><span>Date de début</span><input disabled={!canEdit} type="date" max={dueDate} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
              <label className="field"><span>Échéance</span><input disabled={!canEdit} required type="date" min={startDate} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
              <label className="field"><span>Heure d’échéance (facultative)</span><input disabled={!canEdit} type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} /></label>
              <label className="field"><span>Statut</span><select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="field"><span>Priorité</span><select disabled={!canEdit} value={priority} onChange={e => setPriority(e.target.value as Priority)}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            </div>
            {canEdit && <div className="field full">
              <span>Personnes assignées</span>
              <div className="assignee-picker">
                {users.map(user => (
                  <button type="button" key={user.id} className={assigneeIds.includes(user.id) ? 'selected' : ''} onClick={() => toggleAssignee(user.id)}>
                    <Avatar user={user} size="sm" /><span>{user.name}</span>
                  </button>
                ))}
              </div>
            </div>}
            {task && (
              <section className="comments">
                <h3><MessageSquare size={18} /> Commentaires <span>{task.comments.length}</span></h3>
                {task.comments.map(item => {
                  const author = users.find(user => user.id === item.authorId)
                  return <div className="comment" key={item.id}><Avatar user={author} size="sm" /><div><strong>{author?.name}</strong><time>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</time><p>{item.text}</p></div></div>
                })}
                {task.comments.length === 0 && <p className="empty-inline">Aucun commentaire pour le moment.</p>}
                <div className="comment-input"><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Ajouter une information ou signaler un blocage…" /><button type="button" disabled={!comment.trim()} onClick={() => { addComment(task.id, comment.trim()); setComment('') }}>Envoyer</button></div>
              </section>
            )}
          </div>
          <footer className="modal-footer">
            {task && <div className="modal-secondary-actions">
              <button type="button" className="secondary-btn" onClick={() => contest && downloadTaskCalendar(task, contest, categories.find(category => category.id === task.categoryId)?.name)}><CalendarPlus size={17} /> Ajouter au calendrier</button>
              {isAdmin && (
                confirmDelete
                  ? <button type="button" className="danger-btn" onClick={() => { deleteTask(task.id); onClose() }}><AlertTriangle size={17} /> Confirmer</button>
                  : <button type="button" className="text-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /> Supprimer</button>
              )}
            </div>}
            <div className="footer-actions"><button type="button" className="secondary-btn" onClick={onClose}>Annuler</button><button className="primary-btn" type="submit">{task ? (canEdit ? 'Enregistrer' : 'Mettre à jour le statut') : 'Créer la tâche'}</button></div>
          </footer>
        </form>
      </div>
  )

  if (embedded) return <div className="task-inline-editor">{content}</div>

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      {content}
    </div>
  )
}
