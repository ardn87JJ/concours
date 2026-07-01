import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getSupabaseKey, jsonResponse } from '../_shared/http.ts'

interface InitializePasswordPayload {
  contestId: string
  userId: string
  password: string
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const payload = await request.json() as InitializePasswordPayload
    if (!payload.contestId || !payload.userId) {
      return jsonResponse({ error: 'Profil requis.' }, 400)
    }
    if (!payload.password || payload.password.length < 6) {
      return jsonResponse({ error: 'Mot de passe de 6 caractères minimum requis par Supabase.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL est absente.')
    const admin = createClient(url, getSupabaseKey('secret'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: membership, error: membershipError } = await admin
      .from('contest_members')
      .select('user_id, profiles!inner(password_initialized)')
      .eq('contest_id', payload.contestId)
      .eq('user_id', payload.userId)
      .maybeSingle()
    if (membershipError) throw membershipError
    const profile = membership?.profiles as unknown as {
      password_initialized: boolean
    } | null
    if (!profile) return jsonResponse({ error: 'Profil introuvable dans ce concours.' }, 404)
    if (profile.password_initialized) {
      return jsonResponse({ error: 'Le mot de passe de ce profil est déjà configuré.' }, 409)
    }

    const { data: claimedProfile, error: claimError } = await admin
      .from('profiles')
      .update({ password_initialized: true })
      .eq('id', payload.userId)
      .eq('password_initialized', false)
      .select('id')
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimedProfile) {
      return jsonResponse({ error: 'Le mot de passe de ce profil vient déjà d’être configuré.' }, 409)
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(payload.userId, {
      password: payload.password,
    })
    if (passwordError) {
      await admin
        .from('profiles')
        .update({ password_initialized: false })
        .eq('id', payload.userId)
      throw passwordError
    }

    return jsonResponse({ userId: payload.userId })
  } catch (error) {
    console.error(error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Initialisation du mot de passe impossible.',
    }, 500)
  }
})
