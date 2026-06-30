import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, getSupabaseKey, jsonResponse } from '../_shared/http.ts'

interface CreateContestPayload {
  contestName: string
  contestLocation: string
  contestStartDate: string
  contestEndDate: string
  contestDescription?: string
}

const initialCategories = [
  { name: 'Terrain & pistes', color: '#2f7459', icon: '🌿' },
  { name: 'Boxes & chevaux', color: '#a8663b', icon: '🐴' },
  { name: 'Bénévoles', color: '#d38a28', icon: '🤝' },
  { name: 'Sécurité', color: '#c64c4c', icon: '🛡️' },
  { name: 'Jury & officiels', color: '#7555a5', icon: '⚖️' },
  { name: 'Restauration', color: '#d6637d', icon: '☕' },
  { name: 'Communication', color: '#347ca5', icon: '📣' },
  { name: 'Matériel & logistique', color: '#5c6570', icon: '🔧' },
]

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse({ error: 'Session requise.' }, 401)

    const payload = await request.json() as CreateContestPayload
    if (!payload.contestName?.trim() || !payload.contestLocation?.trim() ||
      !payload.contestStartDate || !payload.contestEndDate) {
      return jsonResponse({ error: 'Les informations du concours sont obligatoires.' }, 400)
    }
    if (payload.contestEndDate < payload.contestStartDate) {
      return jsonResponse({ error: 'La date de fin doit suivre la date de début.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('SUPABASE_URL est absente.')
    const admin = createClient(url, getSupabaseKey('secret'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return jsonResponse({ error: 'Session invalide.' }, 401)

    const { data: memberships, error: membershipError } = await admin
      .from('contest_members')
      .select('contest_id, role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
    if (membershipError) throw membershipError
    if (!(memberships?.length ?? 0)) return jsonResponse({ error: 'Droits administrateur requis.' }, 403)

    const { data: contest, error: contestError } = await admin
      .from('contests')
      .insert({
        name: payload.contestName.trim(),
        location: payload.contestLocation.trim(),
        start_date: payload.contestStartDate,
        end_date: payload.contestEndDate,
        description: payload.contestDescription?.trim() ?? '',
      })
      .select('id')
      .single()
    if (contestError) throw contestError

    const { error: memberError } = await admin.from('contest_members').insert({
      contest_id: contest.id,
      user_id: user.id,
      role: 'admin',
    })
    if (memberError) throw memberError

    const { error: categoryError } = await admin.from('categories').insert(
      initialCategories.map(category => ({
        contest_id: contest.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      })),
    )
    if (categoryError) throw categoryError

    return jsonResponse({ contestId: contest.id }, 201)
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Création du concours impossible.' }, 500)
  }
})
