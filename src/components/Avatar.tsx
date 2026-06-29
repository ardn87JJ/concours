import type { User } from '../types'

export function Avatar({ user, size = 'md' }: { user?: User; size?: 'sm' | 'md' | 'lg' }) {
  if (!user) return <span className={`avatar avatar-${size}`}>?</span>
  return (
    <span className={`avatar avatar-${size}`} style={{ backgroundColor: user.color }} title={user.name}>
      {user.initials}
    </span>
  )
}

export function AvatarGroup({ users }: { users: User[] }) {
  return <div className="avatar-group">{users.slice(0, 3).map(user => <Avatar key={user.id} user={user} size="sm" />)}</div>
}
