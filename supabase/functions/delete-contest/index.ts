import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getSupabaseKey, jsonResponse } from '../_shared/http.ts'

interface DeleteContestPayload {
  contestId: string
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse({ error: 'Session requise.' }, 401)

    const payload = await request.json() as DeleteContestPayload
    if (!payload.contestId) return jsonResponse({ error: 'Concours requis.' }, 400)

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL est absente.')
    const admin = createClient(url, getSupabaseKey('secret'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return jsonResponse({ error: 'Session invalide.' }, 401)

    const { data: membership, error: membershipError } = await admin
      .from('contest_members')
      .select('role')
      .eq('contest_id', payload.contestId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (membership?.role !== 'admin') return jsonResponse({ error: 'Droits administrateur requis.' }, 403)

    const { count, error: countError } = await admin
      .from('contests')
      .select('id', { count: 'exact', head: true })
    if (countError) throw countError
    if ((count ?? 0) <= 1) return jsonResponse({ error: 'Au moins un concours doit rester disponible.' }, 400)

    const { error: deleteError } = await admin
      .from('contests')
      .delete()
      .eq('id', payload.contestId)
    if (deleteError) throw deleteError

    return jsonResponse({ contestId: payload.contestId })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Suppression du concours impossible.' }, 500)
  }
})
