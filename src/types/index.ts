export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type UserRole = 'admin' | 'manager' | 'volunteer'

export interface Contest {
  id: string
  name: string
  location: string
  startDate: string
  endDate: string
  description: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export interface User {
  id: string
  contestId: string
  name: string
  role: UserRole
  contact: string
  initials: string
  color: string
  managedCategoryIds?: string[]
  passwordHash?: string
  passwordSalt?: string
  passwordVersion?: number
}

export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string
}

export interface Message {
  id: string
  contestId: string
  senderId: string
  recipientId?: string
  text: string
  createdAt: string
  readByIds: string[]
}

export type NotificationType = 'assignment' | 'comment' | 'message' | 'status' | 'deadline'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  text: string
  createdAt: string
  read: boolean
  taskId?: string
  messageId?: string
}

export interface AuditEvent {
  id: string
  contestId: string
  actorId: string
  action: 'create' | 'update' | 'delete' | 'comment' | 'assign' | 'status' | 'message' | 'import'
  entityType: 'task' | 'user' | 'message' | 'category'
  entityId: string
  description: string
  createdAt: string
}

export interface Task {
  id: string
  contestId: string
  title: string
  description: string
  categoryId: string
  status: TaskStatus
  priority: Priority
  startDate?: string
  dueDate: string
  dueTime?: string
  assigneeIds: string[]
  comments: Comment[]
  createdAt: string
}

export interface AppData {
  contests: Contest[]
  categories: Category[]
  users: User[]
  tasks: Task[]
  messages: Message[]
  notifications: Notification[]
  auditLog: AuditEvent[]
  activeContestId: string
  currentUserId: string
}
