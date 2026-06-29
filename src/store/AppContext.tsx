import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoData } from '../data/demo'
import { createPasswordCredential } from '../lib/password'
import { PASSWORD_VERSION } from '../lib/password'
import type { AppData, AuditEvent, Category, Comment, Contest, Message, Notification, Task, User } from '../types'

interface AppContextValue extends AppData {
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'comments'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  addComment: (taskId: string, text: string) => void
  addCategory: (category: Omit<Category, 'id'>) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  addUser: (user: Omit<User, 'id' | 'contestId'>) => void
  addUsers: (users: Array<Omit<User, 'id' | 'contestId'>>) => void
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => void
  sendMessage: (message: Pick<Message, 'recipientId' | 'text'>) => void
  markConversationRead: (participantId?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  initializeAdminPassword: (userId: string, password: string) => Promise<void>
  changeAdminPassword: (userId: string, password: string) => Promise<void>
  addContest: (contest: Omit<Contest, 'id'>) => string
  deleteContest: (id: string) => void
  setActiveContestId: (id: string) => void
  setCurrentUserId: (id: string) => void
  resetDemo: () => void
}

const STORAGE_KEY = 'attelage-pilot-data-v1'
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
        if (migratedUser.role !== 'admin' || !migratedUser.passwordHash || migratedUser.passwordVersion === PASSWORD_VERSION) return migratedUser
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
  const [data, setData] = useState<AppData>(loadData)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    const syncFromStorage = () => {
      setData(loadData())
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) syncFromStorage()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', syncFromStorage)
    document.addEventListener('visibilitychange', syncFromStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', syncFromStorage)
      document.removeEventListener('visibilitychange', syncFromStorage)
    }
  }, [])

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
    addUser: (user: Omit<User, 'id' | 'contestId'>) =>
      setData(current => {
        if (getContestUsers(current).find(item => item.id === current.currentUserId)?.role !== 'admin') return current
        const id = crypto.randomUUID()
        return {
          ...current,
          users: [...current.users, { ...user, id, contestId: current.activeContestId }],
          auditLog: [...current.auditLog, audit(current.activeContestId, current.currentUserId, {
            action: 'create', entityType: 'user', entityId: id, description: `a créé le profil ${user.role === 'admin' ? 'administrateur ' : ''}« ${user.name} »`,
          })],
        }
      }),
    addUsers: (users: Array<Omit<User, 'id' | 'contestId'>>) =>
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
      }),
    updateUser: (id: string, updates: Partial<User>) =>
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
      }),
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
    initializeAdminPassword: async (userId: string, password: string) => {
      const credential = await createPasswordCredential(password)
      setData(current => {
        const next = {
          ...current,
          users: current.users.map(user => {
          if (user.id !== userId || user.role !== 'admin' || (user.passwordHash && user.passwordSalt)) return user
          return { ...user, ...credential }
        }),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    changeAdminPassword: async (userId: string, password: string) => {
      const credential = await createPasswordCredential(password)
      setData(current => {
        const actor = getContestUsers(current).find(user => user.id === current.currentUserId)
        if (actor?.role !== 'admin' || actor.id !== userId) return current
        const next = {
          ...current,
          users: current.users.map(user => user.id === userId ? { ...user, ...credential } : user),
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
  }), [])

  return <AppContext.Provider value={{ ...data, ...actions }}>{children}</AppContext.Provider>
}

// Le hook partage volontairement le module du provider pour garder l'API du store groupée.
// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp doit être utilisé dans AppProvider')
  return context
}
