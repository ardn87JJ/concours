import type { Priority, TaskStatus } from '../types'
import { priorityLabels, statusLabels } from '../lib/format'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge status-${status}`}><i />{statusLabels[status]}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority}`}>{priorityLabels[priority]}</span>
}
