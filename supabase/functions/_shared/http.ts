export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

export const getSupabaseKey = (kind: 'publishable' | 'secret') => {
  const pluralName = kind === 'publishable' ? 'SUPABASE_PUBLISHABLE_KEYS' : 'SUPABASE_SECRET_KEYS'
  const legacyName = kind === 'publishable' ? 'SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY'
  const values = Deno.env.get(pluralName)
  if (values) {
    const parsed = JSON.parse(values) as Record<string, string>
    if (parsed.default) return parsed.default
    const first = Object.values(parsed)[0]
    if (first) return first
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Variable Supabase manquante : ${pluralName}`)
  return legacy
}

export const internalEmail = (userId: string) => `${userId}@users.attelage-pilot.invalid`
