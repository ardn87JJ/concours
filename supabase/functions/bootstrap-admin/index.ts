import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getSupabaseKey, internalEmail, jsonResponse } from '../_shared/http.ts'

interface BootstrapPayload {
  contestName: string
  contestLocation: string
  contestStartDate: string
  contestEndDate: string
  contestDescription?: string
  adminName: string
  adminContact?: string
  adminPassword: string
}

const initials = (name: string) =>
  name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('fr')

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const payload = await request.json() as BootstrapPayload
    if (!payload.contestName?.trim() || !payload.contestLocation?.trim() ||
      !payload.contestStartDate || !payload.contestEndDate || !payload.adminName?.trim()) {
      return jsonResponse({ error: 'Les informations du concours et de l’administrateur sont obligatoires.' }, 400)
    }
    if (!payload.adminPassword || payload.adminPassword.length < 8) {
      return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400)
    }
    if (payload.contestEndDate < payload.contestStartDate) {
      return jsonResponse({ error: 'La date de fin doit suivre la date de début.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL est absente.')
    const admin = createClient(url, getSupabaseKey('secret'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { count, error: countError } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
    if (countError) throw countError
    if ((count ?? 0) > 0) return jsonResponse({ error: 'Le projet a déjà été initialisé.' }, 409)

    const userId = crypto.randomUUID()
    const { error: authError } = await admin.auth.admin.createUser({
      id: userId,
      email: internalEmail(userId),
      password: payload.adminPassword,
      email_confirm: true,
      user_metadata: { display_name: payload.adminName.trim() },
    })
    if (authError) throw authError

    const { data: contestId, error: bootstrapError } = await admin.rpc('bootstrap_workspace', {
      new_user_id: userId,
      contest_name: payload.contestName,
      contest_location: payload.contestLocation,
      contest_start_date: payload.contestStartDate,
      contest_end_date: payload.contestEndDate,
      contest_description: payload.contestDescription ?? '',
      admin_name: payload.adminName,
      admin_contact: payload.adminContact ?? '',
      admin_initials: initials(payload.adminName),
      admin_color: '#345f50',
    })

    if (bootstrapError) {
      await admin.auth.admin.deleteUser(userId)
      throw bootstrapError
    }

    return jsonResponse({ contestId, userId }, 201)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Initialisation impossible.' }, 500)
  }
})
