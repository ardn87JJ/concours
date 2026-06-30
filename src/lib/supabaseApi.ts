import type { UserRole } from '../types'
import { supabase } from './supabase'

export interface LoginContest {
  id: string
  name: string
  location: string
  startDate: string
  endDate: string
}

export interface LoginProfile {
  id: string
  displayName: string
  role: UserRole
  initials: string
  color: string
}

export interface BootstrapAdminInput {
  contestName: string
  contestLocation: string
  contestStartDate: string
  contestEndDate: string
  contestDescription?: string
  adminName: string
  adminContact?: string
  adminPassword: string
}

export interface CreateMemberInput {
  contestId: string
  name: string
  contact?: string
  role: UserRole
  color?: string
  managedCategoryIds?: string[]
  password: string
}

interface LoginContestRow {
  id: string
  name: string
  location: string
  start_date: string
  end_date: string
}

interface LoginProfileRow {
  id: string
  display_name: string
  role: UserRole
  initials: string
  color: string
}

const requireClient = () => {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

const internalEmail = (userId: string) => `${userId}@users.attelage-pilot.invalid`

export const dataBackend = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'local'

export async function listLoginContests(): Promise<LoginContest[]> {
  const { data, error } = await requireClient().rpc('list_login_contests')
  if (error) throw error
  return ((data ?? []) as LoginContestRow[]).map(item => ({
    id: item.id,
    name: item.name,
    location: item.location,
    startDate: item.start_date,
    endDate: item.end_date,
  }))
}

export async function listLoginProfiles(contestId: string): Promise<LoginProfile[]> {
  const { data, error } = await requireClient().rpc('list_login_profiles', {
    target_contest_id: contestId,
  })
  if (error) throw error
  return ((data ?? []) as LoginProfileRow[]).map(item => ({
    id: item.id,
    displayName: item.display_name,
    role: item.role,
    initials: item.initials,
    color: item.color,
  }))
}

export async function signInProfile(userId: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: internalEmail(userId),
    password,
  })
  if (error) throw error
  return data
}

export async function signOutProfile() {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}

export async function bootstrapAdmin(input: BootstrapAdminInput) {
  const { data, error } = await requireClient().functions.invoke('bootstrap-admin', {
    body: input,
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { contestId: string; userId: string }
}

export async function createMember(input: CreateMemberInput) {
  const { data, error } = await requireClient().functions.invoke('manage-member', {
    body: { action: 'create', ...input },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { userId: string }
}

export async function resetMemberPassword(contestId: string, userId: string, password: string) {
  const { data, error } = await requireClient().functions.invoke('manage-member', {
    body: { action: 'reset_password', contestId, userId, password },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as { userId: string }
}

export async function changeOwnSupabasePassword(password: string) {
  const { error } = await requireClient().auth.updateUser({ password })
  if (error) throw error
}
