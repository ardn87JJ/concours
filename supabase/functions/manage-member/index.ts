import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getSupabaseKey, internalEmail, jsonResponse } from '../_shared/http.ts'

type MemberRole = 'admin' | 'manager' | 'volunteer'

interface CreateMemberPayload {
  action: 'create'
  contestId: string
  name: string
  contact?: string
  role: MemberRole
  color?: string
  managedCategoryIds?: string[]
  password: string
}

interface ResetPasswordPayload {
  action: 'reset_password'
  contestId: string
  userId: string
  password: string
}

interface DeleteMemberPayload {
  action: 'delete'
  contestId: string
  userId: string
}

type ManageMemberPayload = CreateMemberPayload | ResetPasswordPayload | DeleteMemberPayload

const initials = (name: string) =>
  name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('fr')

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse({ error: 'Session requise.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL est absente.')
    const admin = createClient(url, getSupabaseKey('secret'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return jsonResponse({ error: 'Session invalide.' }, 401)

    const payload = await request.json() as ManageMemberPayload
    if (!payload.contestId) {
      return jsonResponse({ error: 'Concours requis.' }, 400)
    }

    const { data: membership, error: membershipError } = await admin
      .from('contest_members')
      .select('role')
      .eq('contest_id', payload.contestId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (membership?.role !== 'admin') return jsonResponse({ error: 'Droits administrateur requis.' }, 403)

    if (payload.action === 'delete') {
      const { data: target, error: targetError } = await admin
        .from('contest_members')
        .select('user_id')
        .eq('contest_id', payload.contestId)
        .eq('user_id', payload.userId)
        .maybeSingle()
      if (targetError) throw targetError
      if (!target) return jsonResponse({ error: 'Membre introuvable dans ce concours.' }, 404)
      if (payload.userId === user.id) return jsonResponse({ error: 'Il est interdit de supprimer son propre profil.' }, 400)

      const { error: deleteError } = await admin
        .from('contest_members')
        .delete()
        .eq('contest_id', payload.contestId)
        .eq('user_id', payload.userId)
      if (deleteError) throw deleteError

      const { count, error: remainingError } = await admin
        .from('contest_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', payload.userId)
      if (remainingError) throw remainingError

      if ((count ?? 0) === 0) {
        const { error: authError } = await admin.auth.admin.deleteUser(payload.userId)
        if (authError) throw authError
      }

      return jsonResponse({ userId: payload.userId })
    }

    if (!payload.password || payload.password.length < 8) {
      return jsonResponse({ error: 'Mot de passe de 8 caractères minimum requis.' }, 400)
    }

    if (payload.action === 'reset_password') {
      const { data: target, error: targetError } = await admin
        .from('contest_members')
        .select('user_id')
        .eq('contest_id', payload.contestId)
        .eq('user_id', payload.userId)
        .maybeSingle()
      if (targetError) throw targetError
      if (!target) return jsonResponse({ error: 'Membre introuvable dans ce concours.' }, 404)

      const { error } = await admin.auth.admin.updateUserById(payload.userId, {
        password: payload.password,
      })
      if (error) throw error
      const { error: profileError } = await admin
        .from('profiles')
        .update({ password_initialized: true })
        .eq('id', payload.userId)
      if (profileError) throw profileError
      return jsonResponse({ userId: payload.userId })
    }

    if (!payload.name?.trim() || !['admin', 'manager', 'volunteer'].includes(payload.role)) {
      return jsonResponse({ error: 'Nom et rôle valides requis.' }, 400)
    }

    const userId = crypto.randomUUID()
    const { error: authError } = await admin.auth.admin.createUser({
      id: userId,
      email: internalEmail(userId),
      password: payload.password,
      email_confirm: true,
      user_metadata: { display_name: payload.name.trim() },
    })
    if (authError) throw authError

    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      display_name: payload.name.trim(),
      contact: payload.contact?.trim() ?? '',
      initials: initials(payload.name),
      color: payload.color || '#476a9d',
      password_initialized: false,
    })
    const { error: memberError } = profileError
      ? { error: profileError }
      : await admin.from('contest_members').insert({
          contest_id: payload.contestId,
          user_id: userId,
          role: payload.role,
        })
    const managedCategories = payload.role === 'manager'
      ? [...new Set(payload.managedCategoryIds ?? [])].map(categoryId => ({
          contest_id: payload.contestId,
          category_id: categoryId,
          user_id: userId,
        }))
      : []
    const { error: categoriesError } = !memberError && managedCategories.length
      ? await admin.from('manager_categories').insert(managedCategories)
      : { error: null }

    const operationError = profileError || memberError || categoriesError
    if (operationError) {
      await admin.auth.admin.deleteUser(userId)
      throw operationError
    }

    return jsonResponse({ userId }, 201)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Gestion du membre impossible.' }, 500)
  }
})
