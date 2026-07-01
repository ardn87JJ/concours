import type { AppData, AuditEvent, Comment, Message, Notification, Task, User } from '../types'
import { supabase } from './supabase'

interface ContestRow {
  id: string
  name: string
  location: string
  start_date: string
  end_date: string
  description: string
  color: string
}

interface ProfileRow {
  id: string
  display_name: string
  contact: string
  initials: string
  color: string
  password_initialized: boolean
}

interface ContestMemberRow {
  contest_id: string
  user_id: string
  role: User['role']
}

interface ManagerCategoryRow {
  contest_id: string
  category_id: string
  user_id: string
}

interface CategoryRow {
  id: string
  contest_id: string
  name: string
  color: string
  icon: string
}

interface TaskRow {
  id: string
  contest_id: string
  title: string
  description: string
  category_id: string
  status: Task['status']
  priority: Task['priority']
  start_date: string | null
  due_date: string
  due_time: string | null
  created_at: string
}

interface TaskAssigneeRow {
  task_id: string
  user_id: string
}

interface CommentRow {
  id: string
  contest_id: string
  task_id: string
  author_id: string | null
  text: string
  created_at: string
}

interface MessageRow {
  id: string
  contest_id: string
  sender_id: string
  recipient_id: string | null
  text: string
  created_at: string
}

interface MessageReadRow {
  message_id: string
  user_id: string
  read_at: string
}

interface NotificationRow {
  id: string
  contest_id: string
  user_id: string
  type: Notification['type']
  title: string
  text: string
  task_id: string | null
  message_id: string | null
  created_at: string
  read_at: string | null
}

interface AuditEventRow {
  id: string
  contest_id: string
  actor_id: string | null
  action: AuditEvent['action']
  entity_type: AuditEvent['entityType']
  entity_id: string | null
  description: string
  created_at: string
}

const requireClient = () => {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

const groupBy = <T, K extends keyof T & string>(rows: T[], key: K) =>
  rows.reduce<Record<string, T[]>>((acc, row) => {
    const bucket = row[key] as unknown as string
    ;(acc[bucket] ??= []).push(row)
    return acc
  }, {})

export async function loadSupabaseAppData(): Promise<AppData> {
  const client = requireClient()

  const [
    contestsResult,
    profilesResult,
    membersResult,
    categoriesResult,
    managerCategoriesResult,
    tasksResult,
    assigneesResult,
    commentsResult,
    messagesResult,
    messageReadsResult,
    notificationsResult,
    auditResult,
  ] = await Promise.all([
    client.from('contests').select('id, name, location, start_date, end_date, description, color').order('start_date', { ascending: true }),
    client.from('profiles').select('id, display_name, contact, initials, color, password_initialized').order('display_name', { ascending: true }),
    client.from('contest_members').select('contest_id, user_id, role'),
    client.from('categories').select('id, contest_id, name, color, icon').order('name', { ascending: true }),
    client.from('manager_categories').select('contest_id, category_id, user_id'),
    client.from('tasks').select('id, contest_id, title, description, category_id, status, priority, start_date, due_date, due_time, created_at').order('due_date', { ascending: true }),
    client.from('task_assignees').select('task_id, user_id'),
    client.from('comments').select('id, contest_id, task_id, author_id, text, created_at').order('created_at', { ascending: true }),
    client.from('messages').select('id, contest_id, sender_id, recipient_id, text, created_at').order('created_at', { ascending: true }),
    client.from('message_reads').select('message_id, user_id, read_at'),
    client.from('notifications').select('id, contest_id, user_id, type, title, text, task_id, message_id, created_at, read_at').order('created_at', { ascending: true }),
    client.from('audit_events').select('id, contest_id, actor_id, action, entity_type, entity_id, description, created_at').order('created_at', { ascending: true }),
  ])

  const firstError = [
    contestsResult.error,
    profilesResult.error,
    membersResult.error,
    categoriesResult.error,
    managerCategoriesResult.error,
    tasksResult.error,
    assigneesResult.error,
    commentsResult.error,
    messagesResult.error,
    messageReadsResult.error,
    notificationsResult.error,
    auditResult.error,
  ].find(Boolean)
  if (firstError) throw firstError

  const contests = (contestsResult.data ?? []) as ContestRow[]
  const profiles = new Map((profilesResult.data ?? []).map((profile: ProfileRow) => [profile.id, profile]))
  const members = (membersResult.data ?? []) as ContestMemberRow[]
  const categories = (categoriesResult.data ?? []) as CategoryRow[]
  const managerCategories = (managerCategoriesResult.data ?? []) as ManagerCategoryRow[]
  const tasks = (tasksResult.data ?? []) as TaskRow[]
  const assignees = (assigneesResult.data ?? []) as TaskAssigneeRow[]
  const comments = (commentsResult.data ?? []) as CommentRow[]
  const messages = (messagesResult.data ?? []) as MessageRow[]
  const reads = (messageReadsResult.data ?? []) as MessageReadRow[]
  const notifications = (notificationsResult.data ?? []) as NotificationRow[]
  const audit = (auditResult.data ?? []) as AuditEventRow[]

  const users: User[] = members.flatMap(member => {
    const profile = profiles.get(member.user_id)
    if (!profile) return []
    const managedCategoryIds = managerCategories
      .filter(item => item.contest_id === member.contest_id && item.user_id === member.user_id)
      .map(item => item.category_id)
    return [{
      id: member.user_id,
      contestId: member.contest_id,
      name: profile.display_name,
      role: member.role,
      contact: profile.contact,
      initials: profile.initials,
      color: profile.color,
      passwordInitialized: profile.password_initialized,
      managedCategoryIds: managedCategoryIds.length ? managedCategoryIds : undefined,
    }]
  })

  const taskAssignees = groupBy(assignees, 'task_id')
  const taskComments = groupBy(comments, 'task_id')
  const messageReads = groupBy(reads, 'message_id')

  return {
    contests: contests.map(contest => ({
      id: contest.id,
      name: contest.name,
      location: contest.location,
      startDate: contest.start_date,
      endDate: contest.end_date,
      description: contest.description,
      color: contest.color,
    })),
    categories: categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    })),
    users,
    tasks: tasks.map(task => ({
      id: task.id,
      contestId: task.contest_id,
      title: task.title,
      description: task.description,
      categoryId: task.category_id,
      status: task.status,
      priority: task.priority,
      startDate: task.start_date ?? undefined,
      dueDate: task.due_date,
      dueTime: task.due_time ?? undefined,
      assigneeIds: (taskAssignees[task.id] ?? []).map(row => row.user_id),
      comments: (taskComments[task.id] ?? []).map((comment): Comment => ({
        id: comment.id,
        authorId: comment.author_id ?? '',
        text: comment.text,
        createdAt: comment.created_at,
      })),
      createdAt: task.created_at,
    })),
    messages: messages.map(message => {
      const messageReadRows = messageReads[message.id] ?? []
      const readByIds = [...new Set([message.sender_id, ...messageReadRows.map(row => row.user_id)])]
      return {
        id: message.id,
        contestId: message.contest_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id ?? undefined,
        text: message.text,
        createdAt: message.created_at,
        readByIds,
      } satisfies Message
    }),
    notifications: notifications.map(notification => ({
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      text: notification.text,
      createdAt: notification.created_at,
      read: Boolean(notification.read_at),
      taskId: notification.task_id ?? undefined,
      messageId: notification.message_id ?? undefined,
    })),
    auditLog: audit.map(event => ({
      id: event.id,
      contestId: event.contest_id,
      actorId: event.actor_id ?? '',
      action: event.action,
      entityType: event.entity_type,
      entityId: event.entity_id ?? '',
      description: event.description,
      createdAt: event.created_at,
    })),
    activeContestId: contests[0]?.id ?? '',
    currentUserId: users[0]?.id ?? '',
  }
}
