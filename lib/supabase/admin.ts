import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient must never run in a browser context — it uses the service-role key, which bypasses RLS.',
    )
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
