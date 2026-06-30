import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoData } from '../data/demo'
import { changeOwnSupabasePassword, createMember, dataBackend, resetMemberPassword } from '../lib/supabaseApi'
import { createPasswordCredential } from '../lib/password'
import { PASSWORD_VERSION } from '../lib/password'
import { supabase } from '../lib/supabase'
import { loadSupabaseAppData } from '../lib/supabaseData'
import type { AppData, AuditEvent, Category, Comment, Contest, Message, Notification, Task, User } from '../types'

interface AppContextValue extends AppData {
  ready: boolean
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'comments'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  addComment: (taskId: string, text: string) => void
  addCategory: (category: Omit<Category, 'id'>) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  addUser: (user: Omit<User, 'id' | 'contestId'>) => Promise<string>
  addUsers: (users: Array<Omit<User, 'id' | 'contestId'>>) => void
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => void
  sendMessage: (message: Pick<Message, 'recipientId' | 'text'>) => void
  markConversationRead: (participantId?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  initializePassword: (userId: string, password: string) => Promise<void>
  setUserPassword: (userId: string, password: string) => Promise<void>
  changeOwnPassword: (userId: string, password: string) => Promise<void>
  addContest: (contest: Omit<Contest, 'id'>) => string
  deleteContest: (id: string) => void
  setActiveContestId: (id: string) => void
  setCurrentUserId: (id: string) => void
  resetDemo: () => void
}

const STORAGE_KEY = 'attelage-pilot-data-v1'
const ACTIVE_CONTEST_KEY = 'attelage-active-contest'
const CURRENT_USER_KEY = 'attelage-current-user'
const AppContext = createContext<AppContextValue | null>(null)

const audit = (contestId: string, actorId: string, event: Omit<AuditEvent, 'id' | 'contestId' | 'actorId' | 'createdAt'>): AuditEvent => ({
  ...event,
  id: crypto.randomUUID(),
  contestId,
  actorId,
  createdAt: new Date().toISOString(),
})

const notify = (userId: string, notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>): Notification => ({
  ...notification,
  id: crypto.randomUUID(),
  userId,
  createdAt: new Date().toISOString(),
  read: false,
})

const getContestUsers = (data: AppData, contestId = data.activeContestId) =>
  data.users.filter(user => user.contestId === contestId)

const addDeadlineNotifications = (data: AppData): AppData => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayKey = today.toISOString().slice(0, 10)
  const additions: Notification[] = []
  data.tasks.filter(task => task.status !== 'done').forEach(task => {
    const due = new Date(`${task.dueDate}T00:00:00`)
    const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    if (days > 3) return
    task.assigneeIds.forEach(userId => {
      const id = `deadline-${task.id}-${userId}-${dayKey}`
      if (data.notifications.some(notification => notification.id === id)) return
      additions.push({
        id,
        userId,
        type: 'deadline',
        title: days < 0 ? 'Tâche en retard' : days === 0 ? 'Échéance aujourd’hui' : `Échéance dans ${days} jour${days > 1 ? 's' : ''}`,
        text: task.title,
        taskId: task.id,
        createdAt: new Date().toISOString(),
        read: false,
      })
    })
  })
  return additions.length ? { ...data, notifications: [...data.notifications, ...additions] } : data
}

const loadData = (): AppData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return addDeadlineNotifications(demoData)
    const parsed = JSON.parse(stored) as AppData
    const migrated = {
      ...parsed,
      messages: (parsed.messages ?? []).map(message => ({ ...message, readByIds: message.readByIds ?? [message.senderId] })),
      notifications: parsed.notifications ?? [],
      auditLog: parsed.auditLog ?? [],
      users: parsed.users.map(user => {
        const demoUser = demoData.users.find(item => item.id === user.id)
        const migratedUser = {
          ...user,
          contestId: user.contestId ?? demoUser?.contestId ?? parsed.activeContestId,
          managedCategoryIds: user.managedCategoryIds ?? demoUser?.managedCategoryIds ?? [],
        }
        if (!migratedUser.passwordHash || migratedUser.passwordVersion === PASSWORD_VERSION) return migratedUser
        const safeUser = { ...migratedUser }
        delete safeUser.passwordHash
        delete safeUser.passwordSalt
        delete safeUser.passwordVersion
        return safeUser
      }),
    }
    return addDeadlineNotifications(migrated)
  } catch {
    return addDeadlineNotifications(demoData)
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => dataBackend === 'supabase' ? demoData : loadData())
  const [ready, setReady] = useState(dataBackend !== 'supabase')

  useEffect(() => {
    if (dataBackend !== 'supabase') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }, [data])

  useEffect(() => {
    if (dataBackend !== 'supabase' || !supabase) return
    const client = supabase
    let cancelled = false

    const hydrate = async () => {
      const { data: { session } } = await client.auth.getSession()
      if (!session) {
        if (!cancelled) setReady(false)
        return
      }
      const snapshot = await loadSupabaseAppData()
      if (cancelled) return
      const activeContestId = sessionStorage.getItem(ACTIVE_CONTEST_KEY) ?? snapshot.activeContestId
      const currentUserId = sessionStorage.getItem(CURRENT_USER_KEY) ?? snapshot.currentUserId
      setData({
        ...snapshot,
        activeContestId: snapshot.contests.some(contest => contest.id === activeContestId)
          ? activeContestId
          : snapshot.contests[0]?.id ?? '',
        currentUserId: snapshot.users.some(user => user.id === currentUserId)
          ? currentUserId
          : snapshot.users[0]?.id ?? '',
      })
      setReady(true)
    }

    void hydrate()

    const { data: subscription } = client.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      if (!session) {
        setReady(false)
        return
      }
      const snapshot = await loadSupabaseAppData()
      if (cancelled) return
      const activeContestId = sessionStorage.getItem(ACTIVE_CONTEST_KEY) ?? snapshot.activeContestId
      const currentUserId = sessionStorage.getItem(CURRENT_USER_KEY) ?? snapshot.currentUserId
      setData({
        ...snapshot,
        activeContestId: snapshot.contests.some(contest => contest.id === activeContestId)
          ? activeContestId
          : snapshot.contests[0]?.id ?? '',
        currentUserId: snapshot.users.some(user => user.id === currentUserId)
          ? currentUserId
          : snapshot.users[0]?.id ?? '',
      })
      setReady(true)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const syncFromStorage = () => {
      setData(loadData())
    }
    const handleStorage = (event: StorageEvent) => {
      if (dataBackend !== 'supabase' && event.key === STORAGE_KEY) syncFromStorage()
    }
    if (dataBackend === 'supabase') return
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', syncFromStorage)
    document.addEventListener('visibilitychange', syncFromStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', syncFromStorage)
      document.removeEventListener('visibilitychange', syncFromStorage)
    }
  }, [])

  useEffect(() => {
    if (dataBackend !== 'supabase') return
    sessionStorage.setItem(ACTIVE_CONTEST_KEY, data.activeContestId)
    sessionStorage.setItem(CURRENT_USER_KEY, data.currentUserId)
  }, [data.activeContestId, data.currentUserId])

  const actions = useMemo(() => ({
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'comments'>) =>
      setData(current => {
        if (getContestUsers(current).find(user => user.id === current.currentUserId)?.role !== 'admin') return current
        const id = crypto.randomUUID()
        const title = task.title
        const adminRecipients = getContestUsers(current).filter(user => user.role === 'admin' && user.id !== current.currentUserId)
        return {
          ...current,
          tasks: [...current.tasks, {
            ...task,
            id,
            comments: [],
            createdAt: new Date().toISOString(),
          }],
          notifications: [...current.notifications, ...task.assigneeIds
            .filter(userId => userId !== current.currentUserId)
            .map(userId => notify(userId, { type: 'assignment', title: 'Nouvelle tâche', text: title, taskId: id })),
            ...adminRecipients
              .filter(admin => !task.assigneeIds.includes(admin.id))
              .map(admin => notify(admin.id, { type: 'status', title: 'Tâche créée', text: title, taskId: id }))],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'create', entityType: 'task', entityId: id, description: `a créé la tâche « ${title} »`,
          })],
        }
      }),
    updateTask: (id: string, updates: Partial<Task>) =>
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        const existing = current.tasks.find(task => task.id === id)
        if (!existing || !actor) return current
        const isAdmin = actor.role === 'admin'
        const isManager = actor.role === 'manager' && (actor.managedCategoryIds ?? []).includes(existing.categoryId)
        const isAssignedUser = existing.assigneeIds.includes(actor.id)
        if (!isAdmin && !isManager && (!isAssignedUser || !updates.status)) return current
        const allowedUpdates = isAdmin
          ? updates
          : isManager
            ? { ...updates, categoryId: existing.categoryId, contestId: existing.contestId, id: existing.id }
            : { status: updates.status }
        const nextTask = { ...existing, ...allowedUpdates }
        const newlyAssigned = nextTask.assigneeIds.filter(userId => !existing.assigneeIds.includes(userId) && userId !== actor.id)
        const statusChanged = updates.status && updates.status !== existing.status
        const assignmentChanged = JSON.stringify([...existing.assigneeIds].sort()) !== JSON.stringify([...nextTask.assigneeIds].sort())
        const statusRecipients = statusChanged
          ? [...new Set([
              ...existing.assigneeIds,
              ...(updates.status === 'blocked'
                ? current.users.filter(user =>
                    user.contestId === current.activeContestId &&
                    (user.role === 'admin' ||
                      (user.role === 'manager' && (user.managedCategoryIds ?? []).includes(existing.categoryId)))
                  )
                  .map(user => user.id)
                : []),
            ])].filter(userId => userId !== actor.id)
          : []
        const adminRecipients = getContestUsers(current)
          .filter(user => user.role === 'admin' && user.id !== actor.id && !statusRecipients.includes(user.id))
          .map(user => user.id)
        const events: AuditEvent[] = []
        if (statusChanged) events.push(audit(current.activeContestId, actor.id, {
          action: 'status', entityType: 'task', entityId: id, description: `a changé le statut de « ${existing.title} »`,
        }))
        if (assignmentChanged) events.push(audit(current.activeContestId, actor.id, {
          action: 'assign', entityType: 'task', entityId: id, description: `a modifié l’assignation de « ${existing.title} »`,
        }))
        if (!statusChanged && !assignmentChanged) events.push(audit(current.activeContestId, actor.id, {
          action: 'update', entityType: 'task', entityId: id, description: `a modifié la tâche « ${existing.title} »`,
        }))
        return {
          ...current,
          tasks: current.tasks.map(task => task.id === id ? nextTask : task),
          notifications: [
            ...current.notifications,
            ...newlyAssigned.map(userId => notify(userId, { type: 'assignment', title: 'Tâche assignée', text: existing.title, taskId: id })),
            ...statusRecipients.map(userId => notify(userId, {
              type: 'status',
              title: updates.status === 'blocked' ? 'Blocage signalé' : 'Statut mis à jour',
              text: existing.title,
              taskId: id,
            })),
            ...adminRecipients.map(userId => notify(userId, {
              type: 'status',
              title: assignmentChanged ? 'Assignation modifiée' : statusChanged ? 'Statut de tâche modifié' : 'Tâche modifiée',
              text: existing.title,
              taskId: id,
            })),
          ],
          auditLog: [...current.auditLog, ...events],
        }
      }),
    deleteTask: (id: string) =>
      setData(current => {
        if (getContestUsers(current).find(user => user.id === current.currentUserId)?.role !== 'admin') return current
        const task = current.tasks.find(item => item.id === id)
        if (!task) return current
        return {
          ...current,
          tasks: current.tasks.filter(item => item.id !== id),
          notifications: [
            ...current.notifications,
            ...getContestUsers(current)
              .filter(user => user.role === 'admin' && user.id !== current.currentUserId)
              .map(user => notify(user.id, { type: 'status', title: 'Tâche supprimée', text: task.title })),
          ],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'delete', entityType: 'task', entityId: id, description: `a supprimé la tâche « ${task.title} »`,
          })],
        }
      }),
    addComment: (taskId: string, text: string) =>
      setData(current => {
        const comment: Comment = {
          id: crypto.randomUUID(),
          authorId: current.currentUserId,
          text,
          createdAt: new Date().toISOString(),
        }
        const task = current.tasks.find(item => item.id === taskId)
        const taskRecipients = task?.assigneeIds ?? []
        const recipients = [...new Set([
          ...taskRecipients,
          ...getContestUsers(current).filter(user => user.role === 'admin').map(user => user.id),
        ])].filter(userId => userId !== current.currentUserId)
        return {
          ...current,
          tasks: current.tasks.map(task =>
            task.id === taskId ? { ...task, comments: [...task.comments, comment] } : task),
          notifications: [
            ...current.notifications,
            ...recipients.map(userId => notify(userId, {
                type: 'comment',
                title: 'Nouveau commentaire',
                text: task?.title ?? 'Tâche',
                taskId,
              })),
          ],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'comment', entityType: 'task', entityId: taskId, description: 'a ajouté un commentaire à une tâche',
          })],
        }
      }),
    addCategory: (category: Omit<Category, 'id'>) =>
      setData(current => {
        if (getContestUsers(current).find(user => user.id === current.currentUserId)?.role !== 'admin') return current
        const id = crypto.randomUUID()
        return {
          ...current,
          categories: [...current.categories, { ...category, id }],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'create', entityType: 'category', entityId: id, description: `a créé la catégorie « ${category.name} »`,
          })],
        }
      }),
    updateCategory: (id: string, updates: Partial<Category>) =>
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        const category = current.categories.find(item => item.id === id)
        if (actor?.role !== 'admin' || !category) return current
        return {
          ...current,
          categories: current.categories.map(item => item.id === id ? { ...item, ...updates, id: item.id } : item),
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'update', entityType: 'category', entityId: id, description: `a modifié la catégorie « ${category.name} »`,
          })],
        }
      }),
    deleteCategory: (id: string) =>
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        const category = current.categories.find(item => item.id === id)
        if (actor?.role !== 'admin' || !category) return current
        const remaining = current.categories.filter(item => item.id !== id)
        if (!remaining.length) return current
        const fallbackCategoryId = remaining[0].id
        return {
          ...current,
          categories: remaining,
          tasks: current.tasks.map(task => task.categoryId === id ? { ...task, categoryId: fallbackCategoryId } : task),
          users: current.users.map(user => ({
            ...user,
            managedCategoryIds: (user.managedCategoryIds ?? []).filter(categoryId => categoryId !== id),
          })),
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'delete', entityType: 'category', entityId: id, description: `a supprimé la catégorie « ${category.name} »`,
          })],
        }
      }),
    addUser: async (user: Omit<User, 'id' | 'contestId'>) => {
      const id = crypto.randomUUID()
      if (dataBackend === 'supabase') {
        await createMember({
          contestId: data.activeContestId,
          name: user.name,
          contact: user.contact,
          role: user.role,
          color: user.color,
          managedCategoryIds: user.managedCategoryIds ?? [],
          password: crypto.randomUUID(),
        })
        await loadSupabaseAppData().then(snapshot => {
          setData(current => ({
            ...snapshot,
            activeContestId: current.activeContestId,
            currentUserId: current.currentUserId,
          }))
        })
        return id
      }
      setData(current => {
        if (getContestUsers(current).find(item => item.id === current.currentUserId)?.role !== 'admin') return current
        return {
          ...current,
          users: [...current.users, { ...user, id, contestId: current.activeContestId }],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'create', entityType: 'user', entityId: id, description: `a créé le profil ${user.role === 'admin' ? 'administrateur ' : ''}« ${user.name} »`,
          })],
        }
      })
      return id
    },
    addUsers: (users: Array<Omit<User, 'id' | 'contestId'>>) => {
      if (dataBackend === 'supabase') {
        void Promise.all(users.map(user => createMember({
          contestId: data.activeContestId,
          name: user.name,
          contact: user.contact,
          role: user.role,
          color: user.color,
          managedCategoryIds: user.managedCategoryIds ?? [],
          password: crypto.randomUUID(),
        }))).then(() => loadSupabaseAppData().then(snapshot => {
          setData(current => ({
            ...snapshot,
            activeContestId: current.activeContestId,
            currentUserId: current.currentUserId,
          }))
        }))
        return
      }
      setData(current => {
        if (getContestUsers(current).find(user => user.id === current.currentUserId)?.role !== 'admin') return current
        const additions = users.map(user => ({ ...user, id: crypto.randomUUID(), contestId: current.activeContestId }))
        return {
          ...current,
          users: [...current.users, ...additions],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'import', entityType: 'user', entityId: additions[0]?.id ?? '', description: `a importé ${additions.length} profils`,
          })],
        }
      })
    },
    updateUser: (id: string, updates: Partial<User>) => {
      if (dataBackend === 'supabase') {
        void (async () => {
          const actor = getContestUsers(data).find(user => user.id === data.currentUserId)
          const target = data.users.find(item => item.id === id)
          if (actor?.role !== 'admin' || !target || target.contestId !== data.activeContestId || !supabase) return
          const updatePayload: Record<string, unknown> = {}
          if (updates.name !== undefined) updatePayload.display_name = updates.name
          if (updates.contact !== undefined) updatePayload.contact = updates.contact
          if (updates.initials !== undefined) updatePayload.initials = updates.initials
          if (updates.color !== undefined) updatePayload.color = updates.color
          if (Object.keys(updatePayload).length) {
            await supabase.from('profiles').update(updatePayload).eq('id', id)
          }
          if (updates.role !== undefined) {
            await supabase.from('contest_members').update({ role: updates.role }).eq('contest_id', data.activeContestId).eq('user_id', id)
          }
          if (updates.managedCategoryIds) {
            await supabase.from('manager_categories').delete().eq('contest_id', data.activeContestId).eq('user_id', id)
            if (updates.role === 'manager' && updates.managedCategoryIds.length) {
              await supabase.from('manager_categories').insert(updates.managedCategoryIds.map(categoryId => ({
                contest_id: data.activeContestId,
                category_id: categoryId,
                user_id: id,
              })))
            }
          }
          await loadSupabaseAppData().then(snapshot => {
            setData(current => ({
              ...snapshot,
              activeContestId: current.activeContestId,
              currentUserId: current.currentUserId,
            }))
          })
        })()
        return
      }
      setData(current => {
        if (getContestUsers(current).find(user => user.id === current.currentUserId)?.role !== 'admin') return current
        const user = current.users.find(item => item.id === id)
        if (!user || user.contestId !== current.activeContestId) return current
        return {
          ...current,
          users: current.users.map(item => item.id === id ? { ...item, ...updates, id: item.id } : item),
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'update', entityType: 'user', entityId: id, description: `a modifié le profil « ${user.name} »`,
          })],
        }
      })
    },
    deleteUser: (id: string) =>
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        const user = current.users.find(item => item.id === id)
        if (actor?.role !== 'admin' || !user || user.id === current.currentUserId || user.contestId !== current.activeContestId) return current
        const remainingAdmins = current.users.filter(item => item.contestId === current.activeContestId && item.role === 'admin' && item.id !== id)
        if (user.role === 'admin' && !remainingAdmins.length) return current
        return {
          ...current,
          users: current.users.filter(item => item.id !== id),
          tasks: current.tasks.map(task => ({
            ...task,
            assigneeIds: task.assigneeIds.filter(userId => userId !== id),
          })),
          messages: current.messages.map(message => ({
            ...message,
            readByIds: message.readByIds.filter(userId => userId !== id),
          })),
          notifications: current.notifications.filter(notification => notification.userId !== id),
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'delete', entityType: 'user', entityId: id, description: `a supprimé le profil « ${user.name} »`,
          })],
        }
      }),
    sendMessage: ({ recipientId, text }: Pick<Message, 'recipientId' | 'text'>) =>
      setData(current => {
        const id = crypto.randomUUID()
        const recipients = recipientId
          ? [recipientId]
          : getContestUsers(current).filter(user => user.id !== current.currentUserId).map(user => user.id)
        return {
          ...current,
          messages: [...current.messages, {
          id,
          contestId: current.activeContestId,
          senderId: current.currentUserId,
          recipientId,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          readByIds: [current.currentUserId],
          }],
          notifications: [...current.notifications, ...recipients.map(userId => notify(userId, {
            type: 'message', title: recipientId ? 'Nouveau message privé' : 'Nouveau message dans le canal général', text: text.trim().slice(0, 90), messageId: id,
          }))],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'message', entityType: 'message', entityId: id, description: recipientId ? 'a envoyé un message privé' : 'a écrit dans le canal général',
          })],
        }
      }),
    markConversationRead: (participantId?: string) =>
      setData(current => ({
        ...current,
        messages: current.messages.map(message => {
          const belongs = participantId
            ? (message.senderId === participantId && message.recipientId === current.currentUserId) ||
              (message.senderId === current.currentUserId && message.recipientId === participantId)
            : !message.recipientId
          return belongs && !message.readByIds.includes(current.currentUserId)
            ? { ...message, readByIds: [...message.readByIds, current.currentUserId] }
            : message
        }),
      })),
    markNotificationRead: (id: string) =>
      setData(current => ({
        ...current,
        notifications: current.notifications.map(notification =>
          notification.id === id && notification.userId === current.currentUserId ? { ...notification, read: true } : notification),
      })),
    markAllNotificationsRead: () =>
      setData(current => ({
        ...current,
        notifications: current.notifications.map(notification =>
          notification.userId === current.currentUserId ? { ...notification, read: true } : notification),
      })),
    initializePassword: async (userId: string, password: string) => {
      if (password.length < 8) return
      if (dataBackend === 'supabase') return
      const credential = await createPasswordCredential(password)
      setData(current => {
        const target = current.users.find(user => user.id === userId)
        const hasConfiguredAdmin = getContestUsers(current, target?.contestId)
          .some(user => user.role === 'admin' && Boolean(user.passwordHash && user.passwordSalt))
        if (target?.role !== 'admin' || hasConfiguredAdmin || (target.passwordHash && target.passwordSalt)) return current
        const next = {
          ...current,
          users: current.users.map(user => user.id === userId ? { ...user, ...credential } : user),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    setUserPassword: async (userId: string, password: string) => {
      if (password.length < 8) return
      if (dataBackend === 'supabase') {
        await resetMemberPassword(data.activeContestId, userId, password)
        return
      }
      const credential = await createPasswordCredential(password)
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        const target = getContestUsers(current).find(user => user.id === userId)
        if (actor?.role !== 'admin' || !target) return current
        const next = {
          ...current,
          users: current.users.map(user => user.id === userId ? { ...user, ...credential } : user),
          auditLog: [...current.auditLog, audit(current.activeContestId, actor.id, {
            action: 'update', entityType: 'user', entityId: userId, description: `a défini un nouveau mot de passe pour « ${target.name} »`,
          })],
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    changeOwnPassword: async (userId: string, password: string) => {
      if (password.length < 8) return
      if (dataBackend === 'supabase') {
        await changeOwnSupabasePassword(password)
        return
      }
      const credential = await createPasswordCredential(password)
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        if (!actor || actor.id !== userId) return current
        const next = {
          ...current,
          users: current.users.map(user => user.id === userId ? { ...user, ...credential } : user),
          auditLog: [...current.auditLog, audit(current.activeContestId, actor.id, {
            action: 'update', entityType: 'user', entityId: userId, description: 'a modifié son mot de passe',
          })],
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    addContest: (contest: Omit<Contest, 'id'>) => {
      const id = crypto.randomUUID()
      setData(current => {
        const currentUser = getContestUsers(current).find(user => user.id === current.currentUserId)
        if (currentUser?.role !== 'admin') return current
        return {
          ...current,
          contests: [...current.contests, { ...contest, id }],
          activeContestId: id,
        }
      })
      return id
    },
    deleteContest: (id: string) => {
      setData(current => {
        const currentUser = getContestUsers(current).find(user => user.id === current.currentUserId)
        if (currentUser?.role !== 'admin') return current
        if (current.contests.length <= 1 || !current.contests.some(contest => contest.id === id)) return current
        const contests = current.contests.filter(contest => contest.id !== id)
        const deletedUserIds = current.users.filter(user => user.contestId === id).map(user => user.id)
        const nextContestId = current.activeContestId === id ? contests[0].id : current.activeContestId
        const nextUsers = current.users.filter(user => user.contestId === nextContestId)
        return {
          ...current,
          contests,
          tasks: current.tasks.filter(task => task.contestId !== id),
          messages: current.messages.filter(message => message.contestId !== id),
          notifications: current.notifications.filter(notification => !deletedUserIds.includes(notification.userId)),
          users: current.users.filter(user => user.contestId !== id),
          activeContestId: nextContestId,
          currentUserId: nextUsers[0]?.id ?? current.currentUserId,
        }
      })
    },
    setActiveContestId: (id: string) =>
      setData(current => {
        if (!current.contests.some(contest => contest.id === id)) return current
        const nextUsers = current.users.filter(user => user.contestId === id)
        return nextUsers.length
          ? { ...current, activeContestId: id, currentUserId: nextUsers[0].id }
          : { ...current, activeContestId: id }
      }),
    setCurrentUserId: (id: string) => setData(current => ({ ...current, currentUserId: id })),
    resetDemo: () =>
      setData(current => getContestUsers(current).find(user => user.id === current.currentUserId)?.role === 'admin'
        ? demoData
        : current),
  }), [data])

  return <AppContext.Provider value={{ ready, ...data, ...actions }}>{children}</AppContext.Provider>
}

// Le hook partage volontairement le module du provider pour garder l'API du store groupée.
// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}
