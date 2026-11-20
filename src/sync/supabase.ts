// Verbindung zu Supabase. Ohne .env-Werte läuft die App rein lokal.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

/** Anmeldecode per E-Mail anfordern (funktioniert auch in der installierten App auf dem iPad). */
export async function sendeCode(email: string) {
  if (!supabase) throw new Error('Supabase ist nicht eingerichtet.')
  const { error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}
export async function pruefeCode(email: string, code: string) {
  if (!supabase) throw new Error('Supabase ist nicht eingerichtet.')
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
  if (error) throw error
}
export const abmelden = () => supabase?.auth.signOut()
