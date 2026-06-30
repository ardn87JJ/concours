import { CalendarDays, MessageSquare } from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { Task } from '../types'
import { formatDeadline, isOverdue } from '../lib/format'
import { AvatarGroup } from './Avatar'
import { PriorityBadge, StatusBadge } from './Badge'

export function TaskCard({ task, onClick, showStatus = true }: { task: Task; onClick: () => void; showStatus?: boolean }) {
  const { categories, users } = useApp()
  const category = categories.find(item => item.id === task.categoryId)
  const assignees = users.filter(user => task.assigneeIds.includes(user.id))
  const overdue = isOverdue(task)

  return (
    <button className={`task-card ${overdue ? 'is-overdue' : ''}`} onClick={onClick}>
      <div className="task-card-top">
        <span className="category-label" style={{ color: category?.color }}>
          <span style={{ background: category?.color }} />{category?.name}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <strong className="task-title">{task.title}</strong>
      <div className="task-card-meta">
        <span className={overdue ? 'overdue-text' : ''}><CalendarDays size={15} /> {formatDeadline(task, { day: 'numeric', month: 'short' })}</span>
        {task.comments.length > 0 && <span><MessageSquare size={14} />{task.comments.length}</span>}
        <AvatarGroup users={assignees} />
      </div>
      {showStatus && <StatusBadge status={task.status} />}
    </button>
  )
}
