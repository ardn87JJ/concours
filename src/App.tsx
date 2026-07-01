import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  AlertOctagon, BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDot, Clock3, Columns3, Download, FileSpreadsheet, Flag, GanttChart,
  ArrowLeft, Bell, Hash, History, LayoutDashboard, ListTodo, LockKeyhole,
  LogOut, Menu, MessageCircle, Pencil, Plus, RotateCcw, Search, Send, Settings, ShieldCheck,
  Tag, Trash2, Trophy, Upload, UserRound, Users, X,
} from 'lucide-react'
import { useApp } from './store/AppContext'
import type { Contest, Task, TaskStatus, User, UserRole } from './types'
import { compareTaskDeadlines, daysUntil, formatDate, formatDeadline, isOverdue, roleLabels, statusLabels } from './lib/format'
import { membersCsvTemplate, parseMembersCsv, type CsvMember } from './lib/csv'
import { verifyPassword } from './lib/password'
import { Avatar, AvatarGroup } from './components/Avatar'
import { PriorityBadge, StatusBadge } from './components/Badge'
import { ProgressBar } from './components/ProgressBar'
import { TaskCard } from './components/TaskCard'
import { TaskModal } from './components/TaskModal'
import { dataBackend, initializeMemberPassword, listLoginContests, listLoginProfiles, signInProfile, signOutProfile, type LoginContest, type LoginProfile } from './lib/supabaseApi'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type View = 'dashboard' | 'tasks' | 'kanban' | 'timeline' | 'categories' | 'users' | 'history' | 'manager-tasks' | 'my-tasks' | 'progress' | 'messages' | 'settings' | 'account'

const navAdmin = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'tasks', label: 'Toutes les tâches', icon: ListTodo },
  { id: 'kanban', label: 'Tableau Kanban', icon: Columns3 },
  { id: 'timeline', label: 'Planning', icon: CalendarDays },
  { id: 'categories', label: 'Catégories', icon: Tag },
  { id: 'users', label: 'Équipe', icon: Users },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'settings', label: 'Concours & paramètres', icon: Settings },
] as const

const navPersonal = [
  { id: 'my-tasks', label: 'Mes tâches', icon: CheckCircle2 },
  { id: 'progress', label: 'Avancement', icon: BarChart3 },
  { id: 'messages', label: 'Messagerie', icon: MessageCircle },
] as const

export default function App() {
  const app = useApp()
  const isRemote = dataBackend === 'supabase' && isSupabaseConfigured && Boolean(supabase)
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [messageConversation, setMessageConversation] = useState<string>('general')
  const [messageNavigationKey, setMessageNavigationKey] = useState(0)

  useEffect(() => {
    if (!isRemote || !supabase) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSessionUserId(session?.user.id ?? null)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSessionUserId(session?.user.id ?? null)
    })
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [isRemote])

  const authenticatedUserIdEffective = isRemote ? sessionUserId : authenticatedUserId

  useEffect(() => {
    if (!isRemote) {
      const managerAllowed = app.users.find(user => user.id === app.currentUserId)?.role === 'manager' && view === 'manager-tasks'
      const currentUser = app.users.find(user => user.id === app.currentUserId) ?? app.users[0]
      if (!currentUser) return
      if (currentUser.role !== 'admin' && !managerAllowed && view !== 'my-tasks' && view !== 'progress' && view !== 'messages' && view !== 'account') setView('my-tasks')
    }
  }, [app.currentUserId, app.users, isRemote, view])

  const contest = app.contests.find(item => item.id === app.activeContestId)!
  const contestUsers = app.users.filter(user => user.contestId === contest.id)
  const currentUser = contestUsers.find(user => user.id === app.currentUserId) ?? contestUsers[0] ?? app.users.find(user => user.id === app.currentUserId)!
  const authenticatedUser = app.users.find(user => user.id === authenticatedUserIdEffective)
  const contestTasks = app.tasks.filter(task => task.contestId === contest.id)
  const completed = contestTasks.filter(task => task.status === 'done').length
  const progress = contestTasks.length ? Math.round((completed / contestTasks.length) * 100) : 0
  const isAdmin = currentUser.role === 'admin'
  const isImpersonating = authenticatedUser?.role === 'admin' && authenticatedUser.id !== currentUser.id
  const personalTasks = contestTasks.filter(task => task.assigneeIds.includes(currentUser.id))
  const personalCompleted = personalTasks.filter(task => task.status === 'done').length
  const personalProgress = personalTasks.length ? Math.round(personalCompleted / personalTasks.length * 100) : 0
  const unreadMessages = app.messages.filter(message =>
    message.contestId === contest.id &&
    !message.readByIds.includes(currentUser.id) &&
    (!message.recipientId || message.recipientId === currentUser.id)).length

  useEffect(() => {
    const managerAllowed = currentUser.role === 'manager' && view === 'manager-tasks'
    if (!isAdmin && !managerAllowed && view !== 'my-tasks' && view !== 'progress' && view !== 'messages' && view !== 'account') setView('my-tasks')
  }, [currentUser.role, isAdmin, view])

  useEffect(() => {
    if (!contestUsers.some(user => user.id === app.currentUserId) && contestUsers[0]) {
      app.setCurrentUserId(contestUsers[0].id)
    }
  }, [app, contestUsers, contest.id])

  if (isRemote && !authenticatedUserIdEffective) {
    return <RemoteLoginScreen
      onLogin={async (userId, contestId) => {
        setSessionUserId(userId)
        app.setActiveContestId(contestId)
        app.setCurrentUserId(userId)
      }}
    />
  }

  if (isRemote && !app.ready) {
    return <main className="login-screen"><section className="login-card"><header className="login-header"><div className="login-logo">A</div><span>ATTELAGE PILOT</span><h1>Chargement</h1><p>Connexion à Supabase en cours…</p></header></section></main>
  }

  const login = (userId: string) => {
    app.setCurrentUserId(userId)
    setAuthenticatedUserId(userId)
    setView(app.users.find(user => user.id === userId)?.role === 'admin' ? 'dashboard' : 'my-tasks')
  }

  const logout = async () => {
    setAuthenticatedUserId(null)
    if (isRemote && supabase) {
      await signOutProfile()
      setSessionUserId(null)
      return
    }
    setView('dashboard')
  }

  const returnToAdmin = () => {
    if (!authenticatedUser || authenticatedUser.role !== 'admin') return
    app.setCurrentUserId(authenticatedUser.id)
    setView('dashboard')
  }

  const navigate = (next: View) => {
    const managerAllowed = currentUser.role === 'manager' && next === 'manager-tasks'
    if (!isAdmin && !managerAllowed && next !== 'my-tasks' && next !== 'progress' && next !== 'messages' && next !== 'account') {
      setView('my-tasks')
      setSidebarOpen(false)
      return
    }
    setView(next)
    setSidebarOpen(false)
  }

  const titles: Record<View, [string, string]> = {
    dashboard: ['Vue d’ensemble', 'Suivez l’avancement de votre concours en un coup d’œil.'],
    tasks: ['Toutes les tâches', 'Planifiez, assignez et suivez chaque action.'],
    kanban: ['Tableau Kanban', 'Faites avancer les tâches d’un statut à l’autre.'],
    timeline: ['Planning', 'Visualisez les échéances dans le temps.'],
    categories: ['Catégories', 'Organisez les tâches par domaine de responsabilité.'],
    users: ['Équipe', 'Gérez les organisateurs et les bénévoles.'],
    history: ['Historique des actions', 'Consultez les modifications effectuées par l’équipe.'],
    'manager-tasks': ['Mes catégories', 'Gérez et répartissez les tâches de vos catégories.'],
    'my-tasks': ['Mes tâches', `${currentUser.name}, voici vos actions à suivre.`],
    progress: ['Avancement', 'Suivez la préparation globale du concours.'],
    messages: ['Messagerie', 'Échangez avec l’équipe organisatrice.'],
    settings: ['Paramètres du concours', 'Informations et données locales.'],
    account: ['Mon profil', 'Gérez la sécurité de votre compte.'],
  }

  if (!authenticatedUserIdEffective || !authenticatedUser) {
    return <LoginScreen
      contests={app.contests}
      users={app.users}
      onContestChange={app.setActiveContestId}
      onLogin={login}
      onInitializePassword={app.initializePassword}
    />
  }

  return (
    <div className={`app-shell ${!isAdmin ? 'user-mode' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark">A</div><div><strong>Attelage</strong><span>{isAdmin ? 'PILOT' : 'MON ESPACE'}</span></div><button className="close-sidebar" onClick={() => setSidebarOpen(false)}><X /></button></div>
        <div className="contest-switcher">
          <div className="contest-icon">🏆</div>
          <label>
            <span>CONCOURS ACTIF</span>
            <select value={contest.id} onChange={event => app.setActiveContestId(event.target.value)}>
              {app.contests.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <small>{formatDate(contest.startDate, { day: 'numeric', month: 'long' })} — {contest.location}</small>
          </label>
          <ChevronDown size={16} />
        </div>
        <nav>
          {isAdmin && <>
            <span className="nav-label">ORGANISATION</span>
            {navAdmin.map(item => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} />)}
          </>}
          <span className="nav-label">MON ESPACE</span>
          {currentUser.role === 'manager' && <NavButton item={{ id: 'manager-tasks', label: 'Mes catégories', icon: Tag }} active={view === 'manager-tasks'} onClick={() => navigate('manager-tasks')} />}
          {navPersonal.map(item => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => navigate(item.id)} count={item.id === 'my-tasks' ? app.tasks.filter(task => task.assigneeIds.includes(currentUser.id) && task.status !== 'done').length : item.id === 'messages' && unreadMessages ? unreadMessages : undefined} />)}
        </nav>
        <div className="sidebar-progress">
          <div><span>{isAdmin ? 'Progression globale' : 'Ma progression'}</span><strong>{isAdmin ? progress : personalProgress}%</strong></div><ProgressBar value={isAdmin ? progress : personalProgress} compact /><small>{isAdmin ? completed : personalCompleted} tâches sur {isAdmin ? contestTasks.length : personalTasks.length}</small>
        </div>
        <button className="user-menu" onClick={() => navigate('account')}>
          <Avatar user={currentUser} /><div><strong>{currentUser.name}</strong><span>{roleLabels[currentUser.role]}</span></div><Settings size={17} />
        </button>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu /></button>
          {isAdmin
            ? <div className="topbar-search"><Search size={18} /><span>Rechercher une tâche…</span><kbd>⌘ K</kbd></div>
            : <button className="simple-user-brand" onClick={() => navigate('account')}><span className="brand-mark">A</span><span><strong>Mon espace</strong><small>{contest.name}</small></span></button>}
          {isImpersonating
            ? <button className="return-admin" onClick={returnToAdmin}><ArrowLeft size={16} /> Retour administrateur</button>
            : isAdmin && <div className="user-switch">
              <span>Voir comme</span>
              <select value={app.currentUserId} onChange={event => {
              app.setCurrentUserId(event.target.value)
              const user = app.users.find(item => item.id === event.target.value)
              if (user?.role !== 'admin') navigate('my-tasks')
            }}>
              {contestUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>}
          <button className="notification-button" onClick={() => setNotificationsOpen(current => !current)}><Bell size={18} />{app.notifications.some(notification => notification.userId === currentUser.id && !notification.read) && <i />}</button>
          <button className="logout-btn" onClick={logout} title="Se déconnecter"><LogOut size={18} /><span>Déconnexion</span></button>
          {notificationsOpen && <NotificationCenter onClose={() => setNotificationsOpen(false)} onOpenTask={task => { setSelectedTask(task); setNotificationsOpen(false) }} onOpenMessage={messageId => {
            const message = app.messages.find(item => item.id === messageId)
            const target = message?.recipientId
              ? message.senderId === authenticatedUser.id ? message.recipientId : message.senderId
              : 'general'
            setMessageConversation(target ?? 'general')
            setMessageNavigationKey(current => current + 1)
            setView('messages')
            setNotificationsOpen(false)
          }} />}
          {isAdmin && <button className="primary-btn top-add" onClick={() => setCreatingTask(true)}><Plus size={18} /> Nouvelle tâche</button>}
        </header>
        <div className="content">
          <header className="page-heading">
            <div><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div>
            {isAdmin && view !== 'dashboard' && view !== 'settings' && view !== 'messages' && view !== 'progress' && <button className="primary-btn mobile-add" onClick={() => setCreatingTask(true)}><Plus size={18} /> Ajouter</button>}
          </header>
          {view === 'dashboard' && <Dashboard tasks={contestTasks} onOpen={setSelectedTask} onNavigate={navigate} />}
          {view === 'tasks' && <TasksView tasks={contestTasks} onOpen={setSelectedTask} />}
          {view === 'kanban' && <KanbanView tasks={contestTasks} onOpen={setSelectedTask} />}
          {view === 'timeline' && <TimelineView tasks={contestTasks} onOpen={setSelectedTask} />}
          {view === 'categories' && <CategoriesView tasks={contestTasks} />}
          {view === 'users' && <UsersView tasks={contestTasks} />}
          {view === 'history' && isAdmin && <HistoryView />}
          {view === 'manager-tasks' && currentUser.role === 'manager' && <ManagerTasksView tasks={contestTasks} onOpen={setSelectedTask} />}
          {view === 'my-tasks' && <MyTasks tasks={contestTasks.filter(task => task.assigneeIds.includes(currentUser.id))} onOpen={setSelectedTask} />}
          {view === 'progress' && <UserProgressView tasks={contestTasks} />}
          {view === 'messages' && <MessagingView key={messageNavigationKey} initialConversation={messageConversation} viewerUserId={authenticatedUser.id} />}
          {isAdmin && view === 'settings' && <SettingsView />}
          {view === 'account' && <AccountView />}
        </div>
      </main>
      {!isAdmin && <nav className="user-bottom-nav">
        {currentUser.role === 'manager' && <button className={view === 'manager-tasks' ? 'active' : ''} onClick={() => navigate('manager-tasks')}><Tag size={21} /><span>Mes catégories</span></button>}
        <button className={view === 'my-tasks' ? 'active' : ''} onClick={() => navigate('my-tasks')}><CheckCircle2 size={21} /><span>Mes tâches</span></button>
        <button className={view === 'progress' ? 'active' : ''} onClick={() => navigate('progress')}><BarChart3 size={21} /><span>Avancement</span></button>
        <button className={view === 'messages' ? 'active' : ''} onClick={() => navigate('messages')}><MessageCircle size={21} /><span>Messagerie</span></button>
      </nav>}
      {(selectedTask || creatingTask) && <TaskModal task={selectedTask ?? undefined} onClose={() => { setSelectedTask(null); setCreatingTask(false) }} />}
    </div>
  )
}

function LoginScreen({
  contests,
  users,
  onContestChange,
  onLogin,
  onInitializePassword,
}: {
  contests: Contest[]
  users: User[]
  onContestChange: (contestId: string) => void
  onLogin: (userId: string) => void
  onInitializePassword: (userId: string, password: string) => Promise<void>
}) {
  const [selectedContestId, setSelectedContestId] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const contestUsers = users.filter(user => user.contestId === selectedContestId)
  const filtered = contestUsers.filter(user => user.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))
  const hasPassword = Boolean(selectedUser?.passwordHash && selectedUser.passwordSalt)
  const canInitializePassword = selectedUser?.role === 'admin' && !contestUsers.some(user =>
    user.role === 'admin' && Boolean(user.passwordHash && user.passwordSalt))

  const chooseContest = (contestId: string) => {
    setSelectedContestId(contestId)
    setSearch('')
    setSelectedUser(null)
    if (contestId) onContestChange(contestId)
  }

  const chooseProfile = (user: User) => {
    setPassword('')
    setConfirmation('')
    setError('')
    setSelectedUser(user)
  }

  const authenticate = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedUser) return
    setBusy(true)
    try {
      if (!selectedUser.passwordHash || !selectedUser.passwordSalt) {
        if (!canInitializePassword) {
          setError('Aucun mot de passe n’est configuré. Demandez à un administrateur de l’initialiser.')
          return
        }
        if (password !== confirmation) {
          setError('Les deux mots de passe ne correspondent pas.')
          return
        }
        await onInitializePassword(selectedUser.id, password)
        onLogin(selectedUser.id)
      } else {
        const valid = await verifyPassword(password, selectedUser.passwordHash, selectedUser.passwordSalt)
        if (!valid) {
          setError('Mot de passe incorrect.')
          return
        }
        onLogin(selectedUser.id)
      }
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-screen">
    <section className="login-card">
      <header className="login-header">
        <div className="login-logo">A</div>
        <span>ATTELAGE PILOT</span>
        <h1>Bienvenue</h1>
        <p>Sélectionnez votre concours, puis votre profil.</p>
      </header>
      <label className="login-contest">
        <span>Concours</span>
        <select value={selectedContestId} onChange={event => chooseContest(event.target.value)}>
          <option value="">Sélectionner un concours…</option>
          {contests.map(contest => <option key={contest.id} value={contest.id}>{contest.name}</option>)}
        </select>
      </label>
      {selectedContestId
        ? <>
          <label className="login-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher mon nom…" /></label>
          <div className="profile-list">
            {filtered.map(user => <button key={user.id} onClick={() => chooseProfile(user)}>
              <span><strong>{user.name}</strong><small>{roleLabels[user.role]}</small></span>
              {user.role === 'admin' && <em><ShieldCheck size={13} /> Admin</em>}
              <ChevronRight size={20} />
            </button>)}
          </div>
          {!filtered.length && <p className="login-empty">Aucun profil trouvé pour ce concours.</p>}
        </>
        : <p className="login-empty">Choisissez d’abord le concours auquel vous participez.</p>}
      <footer><UserRound size={16} /><span>Chaque profil est protégé par un mot de passe personnel.</span></footer>
    </section>
    {selectedUser && <div className="login-password-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelectedUser(null)}>
      <form className="login-password-dialog" onSubmit={event => void authenticate(event)}>
        <button type="button" className="icon-btn password-close" onClick={() => setSelectedUser(null)}><X size={19} /></button>
        <span className="password-icon"><LockKeyhole size={24} /></span>
        <h2>{hasPassword ? 'Connexion' : canInitializePassword ? 'Créer le mot de passe administrateur' : 'Mot de passe non configuré'}</h2>
        <p>{hasPassword ? `Saisissez le mot de passe de ${selectedUser.name}.` : canInitializePassword ? 'Première connexion du concours : définissez votre mot de passe.' : 'Un administrateur doit définir votre premier mot de passe.'}</p>
        {(hasPassword || canInitializePassword) && <label className="field"><span>Mot de passe</span><input autoFocus required minLength={6} type="password" autoComplete={hasPassword ? 'current-password' : 'new-password'} value={password} onChange={event => { setPassword(event.target.value); setError('') }} /></label>}
        {!hasPassword && canInitializePassword && <label className="field"><span>Confirmer le mot de passe</span><input required minLength={6} type="password" autoComplete="new-password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setError('') }} /></label>}
        {error && <div className="password-error">{error}</div>}
        {(hasPassword || canInitializePassword) && <button className="primary-btn password-submit" disabled={busy}>{busy ? 'Vérification…' : hasPassword ? 'Se connecter' : 'Créer et se connecter'}</button>}
      </form>
    </div>}
  </main>
}

function RemoteLoginScreen({ onLogin }: { onLogin: (userId: string, contestId: string) => Promise<void> | void }) {
  const [contests, setContests] = useState<LoginContest[]>([])
  const [profiles, setProfiles] = useState<LoginProfile[]>([])
  const [selectedContestId, setSelectedContestId] = useState('')
  const [search, setSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<LoginProfile | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingContests, setLoadingContests] = useState(true)
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingContests(true)
    listLoginContests()
      .then(items => {
        if (cancelled) return
        setContests(items)
        setSelectedContestId(current => current || (items[0]?.id ?? ''))
      })
      .catch(error => {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Impossible de charger les concours.')
      })
      .finally(() => {
        if (!cancelled) setLoadingContests(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedContestId) {
      setProfiles([])
      return
    }
    let cancelled = false
    setLoadingProfiles(true)
    setSelectedProfile(null)
    setPassword('')
    setPasswordConfirmation('')
    setError('')
    listLoginProfiles(selectedContestId)
      .then(items => {
        if (!cancelled) setProfiles(items)
      })
      .catch(error => {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Impossible de charger les profils.')
      })
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedContestId])

  const filteredProfiles = profiles.filter(profile => profile.displayName.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))

  const authenticate = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedProfile || !selectedContestId) return
    setBusy(true)
    setError('')
    try {
      if (!selectedProfile.passwordInitialized) {
        if (password !== passwordConfirmation) {
          setError('Les deux mots de passe ne correspondent pas.')
          return
        }
        await initializeMemberPassword(
          selectedContestId,
          selectedProfile.id,
          password,
        )
        setSelectedProfile(current => current ? { ...current, passwordInitialized: true } : current)
      }
      await signInProfile(selectedProfile.id, password)
      await onLogin(selectedProfile.id, selectedContestId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-screen">
    <section className="login-card">
      <header className="login-header">
        <div className="login-logo">A</div>
        <span>ATTELAGE PILOT</span>
        <h1>Bienvenue</h1>
        <p>Sélectionnez votre concours, puis votre profil.</p>
      </header>
      <label className="login-contest">
        <span>Concours</span>
        <select value={selectedContestId} onChange={event => setSelectedContestId(event.target.value)} disabled={loadingContests}>
          <option value="">{loadingContests ? 'Chargement…' : 'Sélectionner un concours…'}</option>
          {contests.map(contest => <option key={contest.id} value={contest.id}>{contest.name}</option>)}
        </select>
      </label>
      {selectedContestId
        ? <>
          <label className="login-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher mon nom…" /></label>
          <div className="profile-list">
            {filteredProfiles.map(profile => <button key={profile.id} onClick={() => {
              setSelectedProfile(profile)
              setPassword('')
              setPasswordConfirmation('')
              setError('')
            }}>
              <span><strong>{profile.displayName}</strong><small>{roleLabels[profile.role]}</small></span>
              {profile.role === 'admin' && <em><ShieldCheck size={13} /> Admin</em>}
              {!profile.passwordInitialized && <em>À initialiser</em>}
              <ChevronRight size={20} />
            </button>)}
          </div>
          {!loadingProfiles && !filteredProfiles.length && <p className="login-empty">Aucun profil trouvé pour ce concours.</p>}
        </>
        : <p className="login-empty">Choisissez d’abord le concours auquel vous participez.</p>}
      <footer><UserRound size={16} /><span>Chaque profil est protégé par un mot de passe personnel.</span></footer>
    </section>
    {selectedProfile && <div className="login-password-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelectedProfile(null)}>
      <form className="login-password-dialog" onSubmit={event => void authenticate(event)}>
        <button type="button" className="icon-btn password-close" onClick={() => setSelectedProfile(null)}><X size={19} /></button>
        <span className="password-icon"><LockKeyhole size={24} /></span>
        <h2>{selectedProfile.passwordInitialized ? 'Connexion' : 'Créer votre mot de passe'}</h2>
        <p>{selectedProfile.passwordInitialized
          ? `Saisissez le mot de passe de ${selectedProfile.displayName}.`
          : `Choisissez le mot de passe de ${selectedProfile.displayName}.`}</p>
        <label className="field"><span>Mot de passe</span><input autoFocus required minLength={6} type="password" autoComplete={selectedProfile.passwordInitialized ? 'current-password' : 'new-password'} value={password} onChange={event => { setPassword(event.target.value); setError('') }} /></label>
        {!selectedProfile.passwordInitialized && <label className="field"><span>Confirmer le mot de passe</span><input required minLength={6} type="password" autoComplete="new-password" value={passwordConfirmation} onChange={event => { setPasswordConfirmation(event.target.value); setError('') }} /></label>}
        {error && <div className="password-error">{error}</div>}
        <button className="primary-btn password-submit" disabled={busy}>{busy ? 'Vérification…' : selectedProfile.passwordInitialized ? 'Se connecter' : 'Créer et se connecter'}</button>
      </form>
    </div>}
  </main>
}

function NavButton({ item, active, onClick, count }: { item: { id: string; label: string; icon: typeof LayoutDashboard }; active: boolean; onClick: () => void; count?: number }) {
  const Icon = item.icon
  return <button className={active ? 'active' : ''} onClick={onClick}><Icon size={19} /><span>{item.label}</span>{count !== undefined && <em>{count}</em>}</button>
}

function Dashboard({ tasks, onOpen, onNavigate }: { tasks: Task[]; onOpen: (task: Task) => void; onNavigate: (view: View) => void }) {
  const { categories, users, contests, activeContestId } = useApp()
  const contest = contests.find(item => item.id === activeContestId)!
  const done = tasks.filter(task => task.status === 'done').length
  const overdue = tasks.filter(isOverdue).length
  const blocked = tasks.filter(task => task.status === 'blocked').length
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const upcoming = [...tasks].filter(task => task.status !== 'done').sort(compareTaskDeadlines).slice(0, 5)
  const days = daysUntil(contest.startDate)

  return <>
    <section className="hero-banner">
      <div><span className="hero-kicker"><Flag size={15} /> PROCHAIN CONCOURS</span><h2>{contest.name}</h2><p><CalendarDays size={17} /> {formatDate(contest.startDate, { day: 'numeric', month: 'long', year: 'numeric' })} · {contest.location}</p></div>
      <div className="countdown"><strong>{Math.max(0, days)}</strong><span>JOURS AVANT<br />LE CONCOURS</span></div>
    </section>
    <section className="stats-grid">
      <StatCard icon={ListTodo} color="green" value={tasks.length} label="Tâches au total" note={`${tasks.filter(t => t.status === 'in_progress').length} en cours`} />
      <StatCard icon={CheckCircle2} color="mint" value={done} label="Tâches terminées" note={`${progress}% de progression`} />
      <StatCard icon={Clock3} color="orange" value={overdue} label="Tâches en retard" note={overdue ? 'À traiter en priorité' : 'Tout est à jour'} alert={overdue > 0} />
      <StatCard icon={AlertOctagon} color="red" value={blocked} label="Tâches bloquées" note={blocked ? 'Action nécessaire' : 'Aucun blocage'} alert={blocked > 0} />
    </section>
    <section className="dashboard-grid">
      <div className="panel progress-panel">
        <PanelHeader title="Progression par catégorie" action="Voir les catégories" onAction={() => onNavigate('categories')} />
        <div className="category-progress-list">{categories.map(category => {
          const categoryTasks = tasks.filter(task => task.categoryId === category.id)
          const value = categoryTasks.length ? Math.round(categoryTasks.filter(task => task.status === 'done').length / categoryTasks.length * 100) : 0
          return <div className="category-progress" key={category.id}><span className="category-icon" style={{ background: `${category.color}18` }}>{category.icon}</span><div><div><strong>{category.name}</strong><span>{categoryTasks.filter(t => t.status === 'done').length}/{categoryTasks.length}</span></div><div className="progress-track"><span style={{ width: `${value}%`, background: category.color }} /></div></div><em>{value}%</em></div>
        })}</div>
      </div>
      <div className="panel upcoming-panel">
        <PanelHeader title="Prochaines échéances" action="Voir toutes" onAction={() => onNavigate('tasks')} />
        <div className="upcoming-list">{upcoming.map(task => {
          const category = categories.find(item => item.id === task.categoryId)
          return <button key={task.id} onClick={() => onOpen(task)}><div className="date-box"><strong>{new Date(`${task.dueDate}T12:00`).getDate()}</strong><span>{formatDate(task.dueDate, { month: 'short' })}{task.dueTime ? ` · ${task.dueTime}` : ''}</span></div><div className="upcoming-info"><strong>{task.title}</strong><span style={{ color: category?.color }}>{category?.name}</span></div><AvatarGroup users={users.filter(user => task.assigneeIds.includes(user.id))} /></button>
        })}</div>
      </div>
    </section>
  </>
}

function StatCard({ icon: Icon, color, value, label, note, alert }: { icon: typeof ListTodo; color: string; value: number; label: string; note: string; alert?: boolean }) {
  return <div className="stat-card"><span className={`stat-icon ${color}`}><Icon size={22} /></span><div><strong>{value}</strong><span>{label}</span><small className={alert ? 'alert-note' : ''}>{note}</small></div></div>
}

function PanelHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <header className="panel-header"><h2>{title}</h2><button onClick={onAction}>{action} →</button></header>
}

function TasksView({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const { categories, users } = useApp()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [assignee, setAssignee] = useState('')
  const filtered = tasks.filter(task =>
    task.title.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')) &&
    (!status || task.status === status) && (!priority || task.priority === priority) &&
    (!category || task.categoryId === category) && (!assignee || task.assigneeIds.includes(assignee)))

  return <div className="panel table-panel">
    <div className="filters">
      <label className="search-field"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" /></label>
      <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
      <select value={priority} onChange={e => setPriority(e.target.value)}><option value="">Toutes priorités</option><option value="urgent">Urgente</option><option value="high">Haute</option><option value="normal">Normale</option><option value="low">Basse</option></select>
      <select value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes catégories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Toute l’équipe</option>{users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </div>
    <div className="result-count">{filtered.length} tâche{filtered.length > 1 ? 's' : ''}</div>
    <div className="task-table">
      <div className="table-head"><span>Tâche</span><span>Statut</span><span>Priorité</span><span>Échéance</span><span>Assignée à</span></div>
      {filtered.map(task => {
        const categoryItem = categories.find(item => item.id === task.categoryId)
        return <button className="table-row" key={task.id} onClick={() => onOpen(task)}>
          <span className="table-task"><i style={{ background: categoryItem?.color }} /><span><strong>{task.title}</strong><small>{categoryItem?.name}</small></span></span>
          <span><StatusBadge status={task.status} /></span><span><PriorityBadge priority={task.priority} /></span>
          <span className={isOverdue(task) ? 'overdue-text' : ''}>{formatDeadline(task, { day: 'numeric', month: 'short' })}</span>
          <span><AvatarGroup users={users.filter(user => task.assigneeIds.includes(user.id))} /></span>
        </button>
      })}
      {!filtered.length && <EmptyState text="Aucune tâche ne correspond à ces filtres." />}
    </div>
  </div>
}

function KanbanView({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done']
  return <div className="kanban">{statuses.map(status => <section className={`kanban-column column-${status}`} key={status}><header><span><i />{statusLabels[status]}</span><em>{tasks.filter(t => t.status === status).length}</em></header><div>{tasks.filter(task => task.status === status).map(task => <TaskCard key={task.id} task={task} onClick={() => onOpen(task)} showStatus={false} />)}</div></section>)}</div>
}

function TimelineView({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const { categories } = useApp()
  const [group, setGroup] = useState<'category' | 'date'>('date')
  const [display, setDisplay] = useState<'timeline' | 'gantt'>('timeline')
  const sorted = [...tasks].sort(compareTaskDeadlines)
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    sorted.forEach(task => {
      const key = group === 'category' ? task.categoryId : task.dueDate.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), task])
    })
    return [...map.entries()]
  }, [sorted, group])

  return <div className="timeline-layout">
    <div className="planning-view-switch"><button className={display === 'timeline' ? 'active' : ''} onClick={() => setDisplay('timeline')}><ListTodo size={16} /> Timeline</button><button className={display === 'gantt' ? 'active' : ''} onClick={() => setDisplay('gantt')}><GanttChart size={16} /> Gantt</button></div>
    {display === 'timeline' && <><div className="timeline-toolbar"><span>Regrouper par</span><button className={group === 'date' ? 'active' : ''} onClick={() => setGroup('date')}>Mois</button><button className={group === 'category' ? 'active' : ''} onClick={() => setGroup('category')}>Catégorie</button></div>
    {groups.map(([key, groupedTasks]) => {
      const category = categories.find(item => item.id === key)
      const label = group === 'category' ? `${category?.icon} ${category?.name}` : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${key}-01T12:00`))
      return <section className="timeline-group" key={key}><header><h2>{label}</h2><span>{groupedTasks.length} tâches</span></header><div className="timeline-line">{groupedTasks.map(task => <button className={isOverdue(task) ? 'overdue' : ''} key={task.id} onClick={() => onOpen(task)}><div className="timeline-date"><strong>{new Date(`${task.dueDate}T12:00`).getDate()}</strong><span>{formatDate(task.dueDate, { month: 'short' })}{task.dueTime ? ` · ${task.dueTime}` : ''}</span></div><i style={{ background: categories.find(c => c.id === task.categoryId)?.color }} /><div><strong>{task.title}</strong><span>{categories.find(c => c.id === task.categoryId)?.name}</span></div><StatusBadge status={task.status} /></button>)}</div></section>
    })}</>}
    {display === 'gantt' && <GanttView tasks={sorted} onOpen={onOpen} />}
  </div>
}

function GanttView({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const { categories, users } = useApp()
  if (!tasks.length) return <EmptyState text="Ajoutez des tâches pour construire le diagramme de Gantt." />

  const toDate = (value: string) => new Date(`${value}T12:00:00`)
  const dayMs = 86_400_000
  const starts = tasks.map(task => toDate(task.startDate ?? task.dueDate).getTime())
  const ends = tasks.map(task => toDate(task.dueDate).getTime())
  const rangeStart = new Date(Math.min(...starts))
  rangeStart.setDate(rangeStart.getDate() - 2)
  const rangeEnd = new Date(Math.max(...ends))
  rangeEnd.setDate(rangeEnd.getDate() + 2)
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / dayMs) + 1)
  const chartWidth = Math.max(760, totalDays * 24)
  const weeks = Array.from({ length: Math.ceil(totalDays / 7) }, (_, index) => {
    const date = new Date(rangeStart)
    date.setDate(date.getDate() + index * 7)
    return date
  })
  const todayPosition = ((Date.now() - rangeStart.getTime()) / dayMs / totalDays) * 100

  return <section className="gantt-panel panel">
    <div className="gantt-legend"><span><i className="gantt-done" /> Terminée</span><span><i className="gantt-active" /> En cours</span><span><i className="gantt-blocked" /> Bloquée</span><small>Les dates de début se modifient dans chaque tâche.</small></div>
    <div className="gantt-scroll">
      <div className="gantt-grid" style={{ width: `${230 + chartWidth}px` }}>
        <div className="gantt-header-label">Tâche</div>
        <div className="gantt-calendar" style={{ width: chartWidth }}>
          {weeks.map((date, index) => <span key={date.toISOString()} style={{ left: `${index * 7 / totalDays * 100}%`, width: `${7 / totalDays * 100}%` }}>{formatDate(date.toISOString().slice(0, 10), { day: 'numeric', month: 'short' })}</span>)}
        </div>
        {tasks.map(task => {
          const start = toDate(task.startDate ?? task.dueDate)
          const end = toDate(task.dueDate)
          const left = Math.max(0, (start.getTime() - rangeStart.getTime()) / dayMs / totalDays * 100)
          const width = Math.max(1.2, ((end.getTime() - start.getTime()) / dayMs + 1) / totalDays * 100)
          const category = categories.find(item => item.id === task.categoryId)
          const assignees = users.filter(user => task.assigneeIds.includes(user.id))
          return <div className="gantt-row" key={task.id}>
            <button className="gantt-task-label" onClick={() => onOpen(task)}><i style={{ background: category?.color }} /><span><strong>{task.title}</strong><small>{formatDate(task.startDate ?? task.dueDate, { day: 'numeric', month: 'short' })} → {formatDeadline(task, { day: 'numeric', month: 'short' })}</small></span><AvatarGroup users={assignees} /></button>
            <div className="gantt-track" style={{ width: chartWidth, backgroundSize: `${7 / totalDays * 100}% 100%` }}>
              {todayPosition >= 0 && todayPosition <= 100 && <i className="today-line" style={{ left: `${todayPosition}%` }} />}
              <button className={`gantt-bar gantt-${task.status}`} style={{ left: `${left}%`, width: `${width}%`, backgroundColor: category?.color }} onClick={() => onOpen(task)} title={`${task.title} — ${formatDeadline(task)}`}>
                <span>{task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0}%</span>
              </button>
            </div>
          </div>
        })}
      </div>
    </div>
  </section>
}

function CategoriesView({ tasks }: { tasks: Task[] }) {
  const { categories, addCategory, updateCategory, deleteCategory } = useApp()
  const [adding, setAdding] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#347ca5')
  const [icon, setIcon] = useState('📌')
  const submit = (e: FormEvent) => { e.preventDefault(); addCategory({ name, color, icon }); setName(''); setColor('#347ca5'); setIcon('📌'); setAdding(false) }
  const startEdit = (category: { id: string; name: string; color: string; icon: string }) => {
    setEditingCategoryId(category.id)
    setName(category.name)
    setColor(category.color)
    setIcon(category.icon)
    setAdding(false)
  }
  const submitEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editingCategoryId) return
    updateCategory(editingCategoryId, { name, color, icon })
    setEditingCategoryId(null)
    setName('')
  }
  return <>
    <div className="section-actions"><span>{categories.length} catégories actives</span><button className="secondary-btn" onClick={() => { setAdding(true); setEditingCategoryId(null) }}><Plus size={17} /> Nouvelle catégorie</button></div>
    {adding && <form className="inline-create" onSubmit={submit}><input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la catégorie" /><input value={color} onChange={e => setColor(e.target.value)} placeholder="#347ca5" /><input value={icon} onChange={e => setIcon(e.target.value)} placeholder="📌" /><button className="primary-btn">Ajouter</button><button type="button" className="icon-btn" onClick={() => setAdding(false)}><X /></button></form>}
    {editingCategoryId && <form className="inline-create" onSubmit={submitEdit}><input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la catégorie" /><input required value={color} onChange={e => setColor(e.target.value)} placeholder="#347ca5" /><input required value={icon} onChange={e => setIcon(e.target.value)} placeholder="📌" /><button className="primary-btn">Enregistrer</button><button type="button" className="icon-btn" onClick={() => setEditingCategoryId(null)}><X /></button></form>}
    <div className="categories-grid">{categories.map(category => {
      const scoped = tasks.filter(task => task.categoryId === category.id)
      const done = scoped.filter(task => task.status === 'done').length
      const value = scoped.length ? Math.round(done / scoped.length * 100) : 0
      return <article className="category-card" key={category.id}>
        <div className="category-card-header">
          <div className="category-card-icon" style={{ background: `${category.color}18` }}>{category.icon}</div>
          <div className="category-card-actions">
            <button type="button" className="icon-btn" onClick={() => startEdit(category)} title="Modifier la catégorie"><Pencil size={15} /></button>
            <button type="button" className="icon-btn danger" onClick={() => {
              if (window.confirm(`Supprimer la catégorie « ${category.name} » ? Les tâches seront réaffectées à la première catégorie restante.`)) deleteCategory(category.id)
            }} title="Supprimer la catégorie"><Trash2 size={15} /></button>
          </div>
        </div>
        <div><h2>{category.name}</h2><p>{scoped.length} tâches · {done} terminées</p></div><strong style={{ color: category.color }}>{value}%</strong><div className="progress-track"><span style={{ width: `${value}%`, background: category.color }} /></div>
      </article>
    })}</div>
  </>
}

function UsersView({ tasks }: { tasks: Task[] }) {
  const { users, categories, activeContestId, addUser, addUsers, updateUser, deleteUser, setUserPassword } = useApp()
  const contestUsers = users.filter(user => user.contestId === activeContestId)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [csvMembers, setCsvMembers] = useState<CsvMember[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [importMessage, setImportMessage] = useState('')
  const [isImportingMembers, setIsImportingMembers] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<UserRole>('volunteer')
  const [managedCategoryIds, setManagedCategoryIds] = useState<string[]>([])
  const [color, setColor] = useState('#476a9d')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberPasswordConfirmation, setMemberPasswordConfirmation] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (memberPassword !== memberPasswordConfirmation) {
      setPasswordError('Les deux mots de passe ne correspondent pas.')
      return
    }
    const userId = await addUser({ name, contact, role, managedCategoryIds: role === 'manager' ? managedCategoryIds : [], initials: name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase(), color })
    await setUserPassword(userId, memberPassword)
    setName(''); setContact(''); setManagedCategoryIds([]); setColor('#476a9d'); setAdding(false)
    setMemberPassword(''); setMemberPasswordConfirmation(''); setPasswordError('')
  }

  const startEdit = (user: User) => {
    setEditingUserId(user.id)
    setAdding(false)
    setName(user.name)
    setContact(user.contact)
    setRole(user.role)
    setColor(user.color)
    setManagedCategoryIds(user.managedCategoryIds ?? [])
    setMemberPassword('')
    setMemberPasswordConfirmation('')
    setPasswordError('')
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingUserId) return
    if (memberPassword && memberPassword !== memberPasswordConfirmation) {
      setPasswordError('Les deux mots de passe ne correspondent pas.')
      return
    }
    updateUser(editingUserId, {
      name,
      contact,
      role,
      color,
      initials: name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase(),
      managedCategoryIds: role === 'manager' ? managedCategoryIds : [],
    })
    if (memberPassword) await setUserPassword(editingUserId, memberPassword)
    setEditingUserId(null)
    setName('')
    setContact('')
    setManagedCategoryIds([])
    setMemberPassword('')
    setMemberPasswordConfirmation('')
    setPasswordError('')
  }

  const readCsv = async (file?: File) => {
    if (!file) return
    setImportMessage('')
    const result = parseMembersCsv(await file.text())
    const seen = new Set(contestUsers.map(user => user.contact.trim().toLocaleLowerCase('fr')))
    const duplicates: string[] = []
    const unique = result.members.filter(member => {
      const key = member.contact.trim().toLocaleLowerCase('fr')
      if (seen.has(key)) {
        duplicates.push(`${member.name} (${member.contact}) existe déjà.`)
        return false
      }
      seen.add(key)
      return true
    })
    setCsvMembers(unique)
    setCsvErrors([...result.errors, ...duplicates])
  }

  const importMembers = async () => {
    if (!csvMembers.length || isImportingMembers) return
    const colors = ['#476a9d', '#667b42', '#b35d71', '#93633d', '#33758a']
    setIsImportingMembers(true)
    setImportMessage('')
    try {
      const result = await addUsers(csvMembers.map((member, index) => ({
        ...member,
        initials: member.name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase(),
        color: colors[index % colors.length],
      })))
      if (result.errors.length) {
        setCsvErrors(current => [...current, ...result.errors])
      }
      if (result.imported > 0) {
        setImportMessage(`${result.imported} membre${result.imported > 1 ? 's' : ''} réellement importé${result.imported > 1 ? 's' : ''}. Définissez ensuite leur mot de passe depuis leur profil.`)
      }
      const failedContacts = new Set(result.failedContacts)
      setCsvMembers(current => current.filter(member => failedContacts.has(member.contact)))
    } catch (error) {
      setCsvErrors(current => [...current, error instanceof Error ? error.message : 'Import impossible.'])
    } finally {
      setIsImportingMembers(false)
    }
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([`\uFEFF${membersCsvTemplate}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'modele-membres-attelage.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <>
    <div className="section-actions"><span>{contestUsers.length} membres dans l’équipe</span><div><button className="secondary-btn" onClick={() => setImporting(current => !current)}><Upload size={17} /> Importer un CSV</button><button className="secondary-btn" onClick={() => { setAdding(true); setEditingUserId(null); setMemberPassword(''); setMemberPasswordConfirmation(''); setPasswordError('') }}><Plus size={17} /> Ajouter un membre</button></div></div>
    {importing && <section className="panel csv-import">
      <header><div><FileSpreadsheet size={22} /><span><strong>Import de membres</strong><small>Fichier CSV encodé en UTF-8, séparé par un point-virgule ou une virgule.</small></span></div><button className="icon-btn" onClick={() => setImporting(false)}><X /></button></header>
      <div className="csv-format">
        <strong>Colonnes attendues</strong>
        <code>nom;role;email;telephone</code>
        <p><b>nom</b> et <b>role</b> sont obligatoires. Renseignez au moins <b>email</b> ou <b>telephone</b>. Rôles acceptés : <b>administrateur</b>, <b>responsable catégorie</b>, <b>bénévole</b>.</p>
        <button className="secondary-btn" onClick={downloadTemplate}><Download size={16} /> Télécharger le modèle</button>
      </div>
      <label className="csv-drop"><Upload size={25} /><strong>Choisir un fichier .csv</strong><span>Les doublons de contact seront ignorés.</span><input type="file" accept=".csv,text/csv" onChange={event => void readCsv(event.target.files?.[0])} /></label>
      {csvErrors.length > 0 && <div className="csv-errors"><strong>{csvErrors.length} problème{csvErrors.length > 1 ? 's' : ''} détecté{csvErrors.length > 1 ? 's' : ''}</strong>{csvErrors.slice(0, 6).map(error => <span key={error}>{error}</span>)}</div>}
      {csvMembers.length > 0 && <div className="csv-preview"><div><strong>{csvMembers.length} membre{csvMembers.length > 1 ? 's' : ''} prêt{csvMembers.length > 1 ? 's' : ''} à importer</strong><button className="primary-btn" disabled={isImportingMembers} onClick={() => { void importMembers() }}>{isImportingMembers ? 'Import en cours…' : 'Confirmer l’import'}</button></div>{csvMembers.slice(0, 5).map(member => <span key={`${member.name}-${member.contact}`}><b>{member.name}</b><em>{roleLabels[member.role]}</em><small>{member.contact}</small></span>)}</div>}
      {importMessage && <div className="import-success"><CheckCircle2 size={17} />{importMessage}</div>}
    </section>}
    {adding && <form className="inline-create user-create" onSubmit={event => void submit(event)}>
      <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Nom complet" />
      <input required value={contact} onChange={e => setContact(e.target.value)} placeholder="Email ou téléphone" />
      <input value={color} onChange={e => setColor(e.target.value)} placeholder="#476a9d" />
      <select value={role} onChange={e => setRole(e.target.value as UserRole)}>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <input required minLength={6} type="password" autoComplete="new-password" value={memberPassword} onChange={e => { setMemberPassword(e.target.value); setPasswordError('') }} placeholder="Mot de passe initial" />
      <input required minLength={6} type="password" autoComplete="new-password" value={memberPasswordConfirmation} onChange={e => { setMemberPasswordConfirmation(e.target.value); setPasswordError('') }} placeholder="Confirmer le mot de passe" />
      {role === 'manager' && <div className="new-manager-categories"><span>Catégories gérées</span>{categories.map(category => <label key={category.id}><input type="checkbox" checked={managedCategoryIds.includes(category.id)} onChange={() => setManagedCategoryIds(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id])} />{category.name}</label>)}</div>}
      {passwordError && <div className="password-error">{passwordError}</div>}
      <button className="primary-btn">Ajouter</button>
      <button type="button" className="icon-btn" onClick={() => setAdding(false)}><X /></button>
    </form>}
    {editingUserId && <form className="inline-create user-create" onSubmit={event => void submitEdit(event)}>
      <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Nom complet" />
      <input required value={contact} onChange={e => setContact(e.target.value)} placeholder="Email ou téléphone" />
      <input value={color} onChange={e => setColor(e.target.value)} placeholder="#476a9d" />
      <select value={role} onChange={e => setRole(e.target.value as UserRole)}>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <input minLength={6} type="password" autoComplete="new-password" value={memberPassword} onChange={e => { setMemberPassword(e.target.value); setPasswordError('') }} placeholder="Nouveau mot de passe (facultatif)" />
      <input required={Boolean(memberPassword)} minLength={6} type="password" autoComplete="new-password" value={memberPasswordConfirmation} onChange={e => { setMemberPasswordConfirmation(e.target.value); setPasswordError('') }} placeholder="Confirmer le mot de passe" />
      {role === 'manager' && <div className="new-manager-categories"><span>Catégories gérées</span>{categories.map(category => <label key={category.id}><input type="checkbox" checked={managedCategoryIds.includes(category.id)} onChange={() => setManagedCategoryIds(current => current.includes(category.id) ? current.filter(id => id !== category.id) : [...current, category.id])} />{category.name}</label>)}</div>}
      {passwordError && <div className="password-error">{passwordError}</div>}
      <button className="primary-btn">Enregistrer</button>
      <button type="button" className="icon-btn" onClick={() => setEditingUserId(null)}><X /></button>
    </form>}
    <div className="users-grid">{contestUsers.map(user => {
      const assigned = tasks.filter(task => task.assigneeIds.includes(user.id))
      const done = assigned.filter(task => task.status === 'done').length
      return <article className="user-card" key={user.id}>
        <div className="user-card-top">
          <Avatar user={user} size="lg" />
          <div className="user-card-actions">
            <button type="button" className="icon-btn" onClick={() => startEdit(user)} title="Modifier le profil"><Pencil size={15} /></button>
            <button type="button" className="icon-btn danger" onClick={() => {
              if (window.confirm(`Supprimer le profil « ${user.name} » ?`)) deleteUser(user.id)
            }} title="Supprimer le profil"><Trash2 size={15} /></button>
          </div>
        </div>
        <div><h2>{user.name}</h2><span>{roleLabels[user.role]}</span><p>{user.contact}</p><small className={dataBackend === 'supabase' ? user.passwordInitialized ? 'password-ready' : 'password-missing' : user.passwordHash && user.passwordSalt ? 'password-ready' : 'password-missing'}>{dataBackend === 'supabase' ? user.passwordInitialized ? 'Mot de passe configuré' : 'Mot de passe à initialiser' : user.passwordHash && user.passwordSalt ? 'Mot de passe configuré' : 'Mot de passe à configurer'}</small></div>
        {user.role === 'manager' && <div className="manager-category-assignment"><strong>Catégories responsables</strong><div>{categories.map(category => <button key={category.id} className={(user.managedCategoryIds ?? []).includes(category.id) ? 'selected' : ''} onClick={() => updateUser(user.id, { managedCategoryIds: (user.managedCategoryIds ?? []).includes(category.id) ? (user.managedCategoryIds ?? []).filter(id => id !== category.id) : [...(user.managedCategoryIds ?? []), category.id] })}>{category.icon} {category.name}</button>)}</div></div>}
        <div className="user-stats"><strong>{assigned.length}<small>tâches</small></strong><strong>{done}<small>terminées</small></strong></div><ProgressBar value={assigned.length ? Math.round(done / assigned.length * 100) : 0} compact />
      </article>
    })}</div>
  </>
}

function ManagerTasksView({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const { users, categories, currentUserId } = useApp()
  const manager = users.find(user => user.id === currentUserId)
  const managedIds = manager?.managedCategoryIds ?? []
  const managedTasks = tasks.filter(task => managedIds.includes(task.categoryId))
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const filtered = managedTasks.filter(task => (!category || task.categoryId === category) && (!status || task.status === status))

  return <div className="manager-space">
    <section className="manager-hero">
      <div><span>ESPACE RESPONSABLE</span><h2>{managedIds.length ? `${managedIds.length} catégorie${managedIds.length > 1 ? 's' : ''} sous votre responsabilité` : 'Aucune catégorie attribuée'}</h2><p>Ouvrez une tâche pour la modifier ou changer les personnes assignées.</p></div>
      <strong>{managedTasks.filter(task => task.status !== 'done').length}<small>à suivre</small></strong>
    </section>
    <div className="manager-filters">
      <select value={category} onChange={event => setCategory(event.target.value)}><option value="">Toutes mes catégories</option>{categories.filter(item => managedIds.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    <div className="manager-task-grid">{filtered.map(task => <TaskCard key={task.id} task={task} onClick={() => onOpen(task)} />)}</div>
    {!filtered.length && <EmptyState text="Aucune tâche dans les catégories qui vous sont attribuées." />}
  </div>
}

function NotificationCenter({ onClose, onOpenTask, onOpenMessage }: { onClose: () => void; onOpenTask: (task: Task) => void; onOpenMessage: (messageId?: string) => void }) {
  const { notifications, tasks, currentUserId, markNotificationRead, markAllNotificationsRead } = useApp()
  const scoped = notifications.filter(notification => notification.userId === currentUserId).slice().reverse()
  const unread = scoped.filter(notification => !notification.read).length
  const icons = { assignment: Users, comment: MessageCircle, message: Send, status: CircleDot, deadline: Clock3 }

  return <div className="notification-popover">
    <header><div><strong>Notifications</strong><span>{unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</span></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></header>
    {unread > 0 && <button className="mark-all" onClick={markAllNotificationsRead}>Tout marquer comme lu</button>}
    <div className="notification-list">{scoped.slice(0, 30).map(notification => {
      const Icon = icons[notification.type]
      return <button key={notification.id} className={!notification.read ? 'unread' : ''} onClick={() => {
        markNotificationRead(notification.id)
        if (notification.type === 'message') {
          onOpenMessage(notification.messageId)
          return
        }
        const task = notification.taskId ? tasks.find(item => item.id === notification.taskId) : undefined
        if (task) onOpenTask(task)
      }}><span className={`notification-icon notification-${notification.type}`}><Icon size={16} /></span><span><strong>{notification.title}</strong><p>{notification.text}</p><time>{new Date(notification.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></span>{!notification.read && <i />}</button>
    })}{!scoped.length && <div className="no-notifications"><Bell size={25} /><span>Aucune notification</span></div>}</div>
  </div>
}

function HistoryView() {
  const { auditLog, users, activeContestId } = useApp()
  const [filter, setFilter] = useState('')
  const events = auditLog.filter(event => event.contestId === activeContestId && (!filter || event.entityType === filter)).slice().reverse()
  return <section className="panel history-panel">
    <header><div><History size={20} /><span><strong>Journal d’activité</strong><small>Visible uniquement par les administrateurs</small></span></div><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Toutes les actions</option><option value="task">Tâches</option><option value="user">Utilisateurs</option><option value="message">Messages</option><option value="category">Catégories</option></select></header>
    <div className="history-list">{events.map(event => {
      const actor = users.find(user => user.id === event.actorId)
      return <article key={event.id}><Avatar user={actor} size="sm" /><div><p><strong>{actor?.name ?? 'Utilisateur supprimé'}</strong> {event.description}</p><time>{new Date(event.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><span>{event.entityType}</span></article>
    })}{!events.length && <EmptyState text="Aucune action enregistrée pour le moment." />}</div>
  </section>
}

function MyTasks({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const { updateTask, addComment, users, categories, currentUserId } = useApp()
  const [blockingTask, setBlockingTask] = useState<Task | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const currentUser = users.find(user => user.id === currentUserId)
  const isSimpleView = currentUser?.role !== 'admin'
  const open = tasks.filter(task => task.status !== 'done')
  const done = tasks.filter(task => task.status === 'done')
  const progress = tasks.length ? Math.round(done.length / tasks.length * 100) : 0

  if (isSimpleView) return <div className="simple-user-tasks">
    <header className="simple-greeting">
      <span>Bonjour {currentUser?.name.split(' ')[0]}</span>
      <h2>{open.length ? `Vous avez ${open.length} tâche${open.length > 1 ? 's' : ''} à faire` : 'Vous êtes à jour'}</h2>
      <div><ProgressBar value={progress} compact /><small>{done.length}/{tasks.length} terminées</small></div>
    </header>
    <section>
      <h3>À faire</h3>
      <div className="simple-user-list">
        {open.sort(compareTaskDeadlines).map(task => {
          const category = categories.find(item => item.id === task.categoryId)
          return <article key={task.id} className={isOverdue(task) ? 'overdue' : ''} style={{ '--task-color': category?.color } as CSSProperties}>
          <button className="simple-task-open" onClick={() => onOpen(task)}>
            <span className={`simple-status status-${task.status}`}><i /></span>
            <span><em style={{ color: category?.color }}>{category?.icon} {category?.name}</em><strong>{task.title}</strong><small className={isOverdue(task) ? 'overdue-text' : ''}><CalendarDays size={15} /> {isOverdue(task) ? 'En retard · ' : ''}{formatDeadline(task)}</small></span>
            <ChevronRight size={20} />
          </button>
          <div className="simple-task-actions">
            <button className="simple-block" onClick={() => { setBlockingTask(task); setBlockReason('') }}><AlertOctagon size={18} /> Je suis bloqué</button>
            <button className="simple-complete" onClick={() => updateTask(task.id, { status: 'done' })}><Check size={19} /> C’est terminé</button>
          </div>
        </article>})}
        {!open.length && <div className="all-done"><CheckCircle2 size={34} /><strong>Tout est terminé</strong><span>Vous n’avez aucune action en attente.</span></div>}
      </div>
    </section>
    {done.length > 0 && <details className="simple-completed"><summary>{done.length} tâche{done.length > 1 ? 's' : ''} terminée{done.length > 1 ? 's' : ''}</summary>{done.map(task => <button key={task.id} onClick={() => onOpen(task)}><Check size={16} />{task.title}</button>)}</details>}
    {blockingTask && <div className="block-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setBlockingTask(null)}>
      <form className="block-dialog" onSubmit={event => {
        event.preventDefault()
        const reason = blockReason.trim()
        if (!reason) return
        updateTask(blockingTask.id, { status: 'blocked' })
        addComment(blockingTask.id, `Blocage signalé : ${reason}`)
        setBlockingTask(null)
        setBlockReason('')
      }}>
        <span><AlertOctagon size={24} /></span><h2>Signaler un blocage</h2><p>Expliquez brièvement ce qui vous empêche d’avancer. L’administrateur et le responsable de la catégorie seront prévenus.</p>
        <label className="field"><span>Motif du blocage</span><textarea autoFocus required rows={4} value={blockReason} onChange={event => setBlockReason(event.target.value)} placeholder="Ex. Matériel non livré, accès impossible…" /></label>
        <div><button type="button" className="secondary-btn" onClick={() => setBlockingTask(null)}>Annuler</button><button className="danger-btn" disabled={!blockReason.trim()}>Signaler le blocage</button></div>
      </form>
    </div>}
  </div>

  return <div className="my-tasks-layout">
    <section className="personal-summary">
      <div><span>👋</span><div><small>Bonjour {currentUser?.name.split(' ')[0]}</small><h2>{open.length ? `${open.length} tâche${open.length > 1 ? 's' : ''} à suivre` : 'Tout est terminé !'}</h2><p>Les actions les plus urgentes apparaissent en premier.</p></div></div>
      <div className="personal-progress"><strong>{progress}%</strong><ProgressBar value={progress} compact /><span>{done.length} sur {tasks.length} terminées</span></div>
    </section>
    <section><div className="my-section-title"><h2>À faire maintenant</h2><span>{open.length}</span></div><div className="simple-task-list">{open.sort(compareTaskDeadlines).map(task => <article key={task.id} className={isOverdue(task) ? 'overdue' : ''}><button className="task-main" onClick={() => onOpen(task)}><StatusBadge status={task.status} /><h3>{task.title}</h3><p>{task.description}</p><span><CalendarDays size={16} /> Avant le {formatDeadline(task)}</span><PriorityBadge priority={task.priority} /></button><div className="quick-actions">{task.status !== 'in_progress' && <button onClick={() => updateTask(task.id, { status: 'in_progress' })}><CircleDot size={18} /> Commencer</button>}<button className="complete-action" onClick={() => updateTask(task.id, { status: 'done' })}><Check size={19} /> Marquer terminée</button><button className="block-action" onClick={() => updateTask(task.id, { status: 'blocked' })}><AlertOctagon size={18} /> Signaler un blocage</button></div></article>)}</div></section>
    {done.length > 0 && <section><div className="my-section-title"><h2>Terminées</h2><span>{done.length}</span></div><div className="completed-list">{done.map(task => <button key={task.id} onClick={() => onOpen(task)}><CheckCircle2 size={21} /><span>{task.title}</span><small>{formatDeadline(task)}</small></button>)}</div></section>}
    {!tasks.length && <EmptyState text="Aucune tâche ne vous est assignée." />}
  </div>
}

function UserProgressView({ tasks }: { tasks: Task[] }) {
  const { categories, users, contests, activeContestId } = useApp()
  const contest = contests.find(item => item.id === activeContestId)!
  const done = tasks.filter(task => task.status === 'done').length
  const inProgress = tasks.filter(task => task.status === 'in_progress').length
  const blocked = tasks.filter(task => task.status === 'blocked').length
  const todo = tasks.filter(task => task.status === 'todo').length
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const activeCategories = categories.map(category => {
    const scoped = tasks.filter(task => task.categoryId === category.id)
    return {
      ...category,
      total: scoped.length,
      done: scoped.filter(task => task.status === 'done').length,
      progress: scoped.length ? Math.round(scoped.filter(task => task.status === 'done').length / scoped.length * 100) : 0,
    }
  }).filter(category => category.total > 0)
  const recentlyDone = tasks.filter(task => task.status === 'done').slice(-4).reverse()

  return <div className="user-progress-view">
    <section className="global-progress-hero">
      <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span><strong>{progress}%</strong><small>terminé</small></span></div>
      <div><small>PRÉPARATION DU CONCOURS</small><h2>{contest.name}</h2><p>L’équipe a terminé {done} tâche{done > 1 ? 's' : ''} sur {tasks.length}.</p></div>
    </section>
    <section className="simple-progress-stats">
      <article className="stat-green"><CheckCircle2 /><strong>{done}</strong><span>Terminées</span></article>
      <article className="stat-blue"><Clock3 /><strong>{inProgress}</strong><span>En cours</span></article>
      <article className="stat-gold"><ListTodo /><strong>{todo}</strong><span>À faire</span></article>
      <article className="stat-red"><AlertOctagon /><strong>{blocked}</strong><span>Bloquées</span></article>
    </section>
    <section className="simple-category-progress">
      <h3>Avancement par catégorie</h3>
      <div>{activeCategories.map(category => <article key={category.id}>
        <span className="progress-category-icon" style={{ background: `${category.color}18` }}>{category.icon}</span>
        <div><header><strong>{category.name}</strong><span>{category.done}/{category.total}</span></header><div className="progress-track"><i style={{ width: `${category.progress}%`, background: category.color }} /></div></div>
        <em style={{ color: category.color }}>{category.progress}%</em>
      </article>)}</div>
    </section>
    {recentlyDone.length > 0 && <section className="recent-success">
      <h3>Dernières tâches terminées</h3>
      <div>{recentlyDone.map(task => <article key={task.id}><Check size={17} /><span><strong>{task.title}</strong><small>{categories.find(category => category.id === task.categoryId)?.name}</small></span><AvatarGroup users={users.filter(user => task.assigneeIds.includes(user.id))} /></article>)}</div>
    </section>}
  </div>
}

function MessagingView({ initialConversation = 'general', viewerUserId }: { initialConversation?: string; viewerUserId: string }) {
  const { users, messages, activeContestId, sendMessage, markConversationRead } = useApp()
  const [conversation, setConversation] = useState<'general' | string>(initialConversation)
  const [mobileChatOpen, setMobileChatOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const currentUser = users.find(user => user.id === viewerUserId)!
  const isAdmin = currentUser.role === 'admin'
  const contacts = users.filter(user =>
    user.id !== viewerUserId && user.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))
  const contestMessages = messages.filter(message => message.contestId === activeContestId)
  const directPairs = [...new Set(contestMessages
    .filter(message => message.recipientId)
    .map(message => [message.senderId, message.recipientId!].sort().join(':')))]
  const selectedPair = conversation.startsWith('pair:') ? conversation.slice(5).split(':') : []
  const visibleMessages = contestMessages.filter(message => {
    if (conversation === 'all' && isAdmin) return true
    if (conversation === 'general') return !message.recipientId
    if (selectedPair.length === 2) {
      return Boolean(message.recipientId) &&
        selectedPair.includes(message.senderId) && selectedPair.includes(message.recipientId!)
    }
    return (message.senderId === viewerUserId && message.recipientId === conversation) ||
      (message.senderId === conversation && message.recipientId === viewerUserId)
  })
  const selectedUser = users.find(user => user.id === conversation)
  const pairUsers = selectedPair.map(id => users.find(user => user.id === id)).filter(Boolean)
  const canSendMessage = conversation === 'general' || Boolean(selectedUser)
  const isSupervision = !canSendMessage
  const generalUnread = contestMessages.filter(message => !message.recipientId && !message.readByIds.includes(viewerUserId)).length

  useEffect(() => {
    setConversation(initialConversation)
    setMobileChatOpen(true)
  }, [initialConversation])

  useEffect(() => {
    if (conversation === 'general') markConversationRead()
    else if (!isSupervision) markConversationRead(conversation)
  }, [conversation, isSupervision, markConversationRead])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || isSupervision || sending) return
    setSending(true)
    setSendError('')
    try {
      await sendMessage({ recipientId: conversation === 'general' ? undefined : conversation, text })
      setText('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Envoi du message impossible.')
    } finally {
      setSending(false)
    }
  }

  const openConversation = (nextConversation: string) => {
    setConversation(nextConversation)
    setMobileChatOpen(true)
  }

  const lastDirectMessage = (userId: string) =>
    [...contestMessages].reverse().find(message =>
      (message.senderId === viewerUserId && message.recipientId === userId) ||
      (message.senderId === userId && message.recipientId === viewerUserId))

  return <section className={`messaging-panel panel ${!isAdmin ? 'simple-messaging' : ''} ${mobileChatOpen ? 'mobile-chat-open' : ''}`}>
    <aside className="conversation-list">
      <header><h2>Conversations</h2><span>{users.length} membres</span></header>
      <label className="message-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un membre…" /></label>
      <div className="conversation-scroll">
        {isAdmin && <button className={`supervision-link ${conversation === 'all' ? 'active' : ''}`} onClick={() => openConversation('all')}>
          <span className="supervision-avatar"><ShieldCheck size={18} /></span>
          <span><strong>Tous les échanges</strong><small>{contestMessages.length} messages à superviser</small></span>
        </button>}
        <button className={conversation === 'general' ? 'active' : ''} onClick={() => openConversation('general')}>
          <span className="general-avatar"><Hash size={18} /></span>
          <span><strong>Canal général</strong><small>Visible par toute l’équipe</small></span>{generalUnread > 0 && <em className="unread-count">{generalUnread}</em>}
        </button>
        <div className="conversation-label">MESSAGES DIRECTS</div>
        {contacts.map(user => {
          const last = lastDirectMessage(user.id)
          const unread = contestMessages.filter(message => message.senderId === user.id && message.recipientId === viewerUserId && !message.readByIds.includes(viewerUserId)).length
          return <button key={user.id} className={conversation === user.id ? 'active' : ''} onClick={() => openConversation(user.id)}>
            <span className="online-avatar"><Avatar user={user} /><i /></span>
            <span><strong>{user.name}</strong><small>{last?.text ?? roleLabels[user.role]}</small></span>
            {unread > 0 ? <em className="unread-count">{unread}</em> : last && <time>{new Date(last.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</time>}
          </button>
        })}
        {isAdmin && directPairs.length > 0 && <>
          <div className="conversation-label">SUPERVISION DES CONVERSATIONS</div>
          {directPairs.map(pair => {
            const members = pair.split(':').map(id => users.find(user => user.id === id)).filter(Boolean)
            const label = members.map(user => user?.name).join(' ↔ ')
            return <button key={pair} className={conversation === `pair:${pair}` ? 'active' : ''} onClick={() => openConversation(`pair:${pair}`)}>
              <span className="pair-avatars">{members.map(user => <Avatar key={user?.id} user={user} size="sm" />)}</span>
              <span><strong>{label}</strong><small>Conversation directe</small></span>
            </button>
          })}
        </>}
      </div>
    </aside>
    <div className="chat">
      <header className="chat-header">
        <button className="mobile-chat-back" onClick={() => setMobileChatOpen(false)} aria-label="Revenir aux conversations"><ArrowLeft size={18} /></button>
        {conversation === 'all'
          ? <><span className="supervision-avatar"><ShieldCheck size={18} /></span><div><strong>Tous les échanges</strong><small>Vue de supervision administrateur</small></div></>
          : selectedPair.length === 2
            ? <><span className="pair-avatars">{pairUsers.map(user => <Avatar key={user?.id} user={user} size="sm" />)}</span><div><strong>{pairUsers.map(user => user?.name).join(' ↔ ')}</strong><small>Conversation directe · lecture administrateur</small></div></>
          : conversation === 'general'
          ? <><span className="general-avatar"><Hash size={18} /></span><div><strong>Canal général</strong><small>Toute l’équipe peut lire et répondre</small></div></>
          : <><Avatar user={selectedUser} /><div><strong>{selectedUser?.name}</strong><small>{selectedUser && roleLabels[selectedUser.role]}</small></div></>}
      </header>
      <div className="message-thread">
        <div className="conversation-intro">
          {isSupervision ? <ShieldCheck size={23} /> : conversation === 'general' ? <Hash size={23} /> : <Avatar user={selectedUser} size="lg" />}
          <strong>{conversation === 'all' ? 'Supervision des échanges' : selectedPair.length === 2 ? pairUsers.map(user => user?.name).join(' ↔ ') : conversation === 'general' ? 'Canal général' : selectedUser?.name}</strong>
          <span>{conversation === 'all' ? 'Tous les messages du concours sont affichés chronologiquement.' : selectedPair.length === 2 ? 'Cette conversation est consultable en lecture seule.' : conversation === 'general' ? 'Utilisez ce canal pour les informations utiles à toute l’équipe.' : `Début de votre conversation avec ${selectedUser?.name}.`}</span>
        </div>
        {visibleMessages.map((message, index) => {
          const sender = users.find(user => user.id === message.senderId)
          const recipient = users.find(user => user.id === message.recipientId)
          const mine = message.senderId === viewerUserId
          const previous = visibleMessages[index - 1]
          const showAuthor = !previous || previous.senderId !== message.senderId ||
            new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 300_000
          return <div className={`message ${mine ? 'mine' : ''} ${!showAuthor ? 'continued' : ''}`} key={message.id}>
            {showAuthor && <Avatar user={sender} size="sm" />}
            <div>
              {showAuthor && <div className="message-meta"><strong>{mine ? 'Vous' : sender?.name}{isSupervision && recipient ? ` → ${recipient.name}` : ''}</strong><time>{new Date(message.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>}
              <p>{message.text}</p>
              {mine && <small className="message-read-state">{message.recipientId
                ? message.readByIds.includes(message.recipientId) ? 'Lu' : 'Envoyé'
                : message.readByIds.length > 1 ? `Lu par ${message.readByIds.length - 1}` : 'Envoyé'}</small>}
            </div>
          </div>
        })}
      </div>
      {canSendMessage
        ? <form className="message-composer" onSubmit={event => { void submit(event) }}>
          {sendError && <span className="message-send-error">{sendError}</span>}
          <Avatar user={currentUser} size="sm" />
          <input value={text} onChange={event => { setText(event.target.value); setSendError('') }} placeholder={conversation === 'general' ? 'Écrire à toute l’équipe…' : `Écrire à ${selectedUser?.name}…`} />
          <button disabled={!text.trim() || sending} aria-label="Envoyer"><Send size={17} /></button>
        </form>
        : <div className="message-readonly"><ShieldCheck size={16} /><span>Vue de supervision en lecture seule. Sélectionnez le canal général ou votre propre conversation pour écrire.</span></div>}
    </div>
  </section>
}

function AccountView() {
  const { users, currentUserId, changeOwnPassword } = useApp()
  const currentUser = users.find(user => user.id === currentUserId)!
  const isRemoteAuth = dataBackend === 'supabase'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('')
    if (newPassword !== confirmation) {
      setStatus('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      if (!isRemoteAuth) {
        if (!currentUser.passwordHash || !currentUser.passwordSalt) {
          setStatus('Demandez à un administrateur de définir votre premier mot de passe.')
          return
        }
        const valid = await verifyPassword(currentPassword, currentUser.passwordHash, currentUser.passwordSalt)
        if (!valid) {
          setStatus('Le mot de passe actuel est incorrect.')
          return
        }
      }
      await changeOwnPassword(currentUser.id, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setStatus('Mot de passe mis à jour.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel account-card">
    <header><Avatar user={currentUser} size="lg" /><div><h2>{currentUser.name}</h2><span>{roleLabels[currentUser.role]}</span><p>{currentUser.contact}</p></div></header>
    <form className="password-settings" onSubmit={event => void submit(event)}>
      <h3>Modifier mon mot de passe</h3>
      {!isRemoteAuth && <label className="field"><span>Mot de passe actuel</span><input required type="password" autoComplete="current-password" value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setStatus('') }} /></label>}
      <label className="field"><span>Nouveau mot de passe</span><input required minLength={6} type="password" autoComplete="new-password" value={newPassword} onChange={event => { setNewPassword(event.target.value); setStatus('') }} /></label>
      <label className="field"><span>Confirmer le nouveau mot de passe</span><input required minLength={6} type="password" autoComplete="new-password" value={confirmation} onChange={event => { setConfirmation(event.target.value); setStatus('') }} /></label>
      {status && <div className={status.includes('mis à jour') ? 'password-success' : 'password-error'}>{status}</div>}
      <button className="primary-btn" disabled={busy}><LockKeyhole size={16} /> {busy ? 'Vérification…' : 'Modifier le mot de passe'}</button>
    </form>
  </section>
}

function SettingsView() {
  const { contests, tasks, users, categories, auditLog, messages, activeContestId, addContest, deleteContest, setActiveContestId, resetDemo } = useApp()
  const contest = contests.find(item => item.id === activeContestId)!
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await addContest({ name, location, startDate, endDate, description })
    setName(''); setLocation(''); setStartDate(''); setEndDate(''); setDescription('')
    setCreating(false)
  }

  const remove = async (id: string, contestName: string) => {
    if (contests.length === 1) return
    const count = tasks.filter(task => task.contestId === id).length
    if (window.confirm(`Supprimer « ${contestName} » et ses ${count} tâche${count > 1 ? 's' : ''} ? Cette action est définitive.`)) {
      await deleteContest(id)
    }
  }

  const downloadFile = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportTasksCsv = () => {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = tasks.filter(task => task.contestId === activeContestId).map(task => [
      task.title,
      task.description,
      categories.find(category => category.id === task.categoryId)?.name ?? '',
      statusLabels[task.status],
      task.priority,
      task.startDate ?? '',
      task.dueDate,
      task.dueTime ?? '',
      task.assigneeIds.map(id => users.find(user => user.id === id)?.name).filter(Boolean).join(', '),
    ].map(escape).join(';'))
    downloadFile(`taches-${contest.name.toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, '-')}.csv`, `\uFEFFtitre;description;categorie;statut;priorite;date_debut;echeance;heure_echeance;assignes\n${rows.join('\n')}`, 'text/csv;charset=utf-8')
  }

  const exportBackup = () => {
    downloadFile(`sauvegarde-attelage-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
      contest,
      categories,
      users: users.map(user => {
        const exportedUser = { ...user }
        delete exportedUser.passwordHash
        delete exportedUser.passwordSalt
        delete exportedUser.passwordVersion
        return exportedUser
      }),
      tasks: tasks.filter(task => task.contestId === activeContestId),
      messages: messages.filter(message => message.contestId === activeContestId),
      auditLog: auditLog.filter(event => event.contestId === activeContestId),
    }, null, 2), 'application/json')
  }

  return <div className="contest-settings">
    <section className="panel settings-card contest-manager">
      <div className="settings-title">
        <div><h2>Gestion des concours</h2><p>Créez un concours ou choisissez celui sur lequel travailler.</p></div>
        <button className="primary-btn" onClick={() => setCreating(true)}><Plus size={17} /> Nouveau concours</button>
      </div>
    {creating && <form className="contest-form" onSubmit={event => void submit(event)}>
        <div className="form-grid">
          <label className="field"><span>Nom du concours</span><input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Concours d’attelage…" /></label>
          <label className="field"><span>Lieu</span><input required value={location} onChange={e => setLocation(e.target.value)} placeholder="Ville ou domaine" /></label>
          <label className="field"><span>Date de début</span><input required type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value) }} /></label>
          <label className="field"><span>Date de fin</span><input required type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        </div>
        <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Informations générales sur le concours…" /></label>
        <div className="contest-form-actions"><button type="button" className="secondary-btn" onClick={() => setCreating(false)}>Annuler</button><button className="primary-btn">Créer et ouvrir</button></div>
      </form>}
      <div className="contest-list">
        {contests.map(item => {
          const taskCount = tasks.filter(task => task.contestId === item.id).length
          const isActive = item.id === activeContestId
          return <article key={item.id} className={isActive ? 'active' : ''}>
            <button className="contest-select" onClick={() => setActiveContestId(item.id)}>
              <span className="contest-list-icon"><Trophy size={20} /></span>
              <span><strong>{item.name}</strong><small>{item.location} · {formatDate(item.startDate)} — {taskCount} tâche{taskCount > 1 ? 's' : ''}</small></span>
              {isActive && <em>Actif</em>}
            </button>
            <button className="contest-delete" disabled={contests.length === 1} title={contests.length === 1 ? 'Le dernier concours ne peut pas être supprimé' : 'Supprimer ce concours'} onClick={() => { void remove(item.id, item.name) }}><Trash2 size={17} /></button>
          </article>
        })}
      </div>
    </section>
    <div className="settings-grid">
      <section className="panel settings-card"><h2>Concours actif</h2><dl><div><dt>Nom</dt><dd>{contest.name}</dd></div><div><dt>Lieu</dt><dd>{contest.location}</dd></div><div><dt>Dates</dt><dd>Du {formatDate(contest.startDate)} au {formatDate(contest.endDate)}</dd></div><div><dt>Description</dt><dd>{contest.description || 'Aucune description'}</dd></div></dl></section>
      <section className="panel settings-card"><h2>Exporter les données</h2><p>Téléchargez les tâches dans un fichier CSV ou une sauvegarde complète du concours. Les mots de passe ne sont jamais inclus.</p><div className="export-actions"><button className="secondary-btn" onClick={exportTasksCsv}><FileSpreadsheet size={17} /> Tâches en CSV</button><button className="secondary-btn" onClick={exportBackup}><Download size={17} /> Sauvegarde JSON</button></div></section>
      <section className="panel settings-card"><h2>Données de démonstration</h2><p>Les modifications sont conservées uniquement dans ce navigateur. Réinitialisez pour retrouver le jeu de données initial.</p><button className="secondary-btn" onClick={() => window.confirm('Réinitialiser toutes les données locales ?') && resetDemo()}><RotateCcw size={17} /> Réinitialiser les données</button><div className="local-notice"><ShieldCheck size={20} /><span><strong>Stockage local</strong> Aucun envoi vers un serveur.</span></div></section>
    </div>
  </div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><BarChart3 size={28} /><p>{text}</p></div>
}
