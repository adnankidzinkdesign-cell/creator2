import 'server-only'
import { z } from 'zod'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export type TokenSource = 'memory-cache' | 'db-cache' | 'cold'

export type GetTokenResult = {
  token: string
  source: TokenSource
  expiresAt: Date
}

export class ZohoAuthError extends Error {
  readonly status: number
  readonly body: string
  constructor(message: string, status: number, body: string) {
    super(`${message} (status=${status}, body=${body})`)
    this.name = 'ZohoAuthError'
    this.status = status
    this.body = body
  }
}

const zohoTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  api_domain: z.string().min(1),
  token_type: z.string().min(1),
})

type ZohoTokenResponse = z.infer<typeof zohoTokenResponseSchema>

type MemoryCache = { token: string; expiresAt: Date } | null
let memoryCache: MemoryCache = null

function isFresh(expiresAt: Date, now: number): boolean {
  return expiresAt.getTime() - now > REFRESH_BUFFER_MS
}

async function refreshFromZoho(): Promise<{ accessToken: string; expiresAt: Date }> {
  const body = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })

  const res = await fetch(`${env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const responseText = await res.text()

  if (!res.ok) {
    throw new ZohoAuthError('Zoho token endpoint returned non-2xx', res.status, responseText)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(responseText)
  } catch {
    throw new ZohoAuthError('Zoho token endpoint returned non-JSON', res.status, responseText)
  }

  // Zoho returns 200 OK with `{"error": "..."}` for some auth failures.
  if (
    parsedJson !== null &&
    typeof parsedJson === 'object' &&
    'error' in parsedJson &&
    typeof (parsedJson as { error: unknown }).error === 'string'
  ) {
    throw new ZohoAuthError('Zoho token endpoint reported an error', res.status, responseText)
  }

  const parseResult = zohoTokenResponseSchema.safeParse(parsedJson)
  if (!parseResult.success) {
    throw new ZohoAuthError(
      `Zoho token response failed schema validation: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
      res.status,
      responseText,
    )
  }

  const data: ZohoTokenResponse = parseResult.data
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

async function fetchTokenWithSource(): Promise<GetTokenResult> {
  const now = Date.now()

  // Layer 1: in-memory cache
  if (memoryCache && isFresh(memoryCache.expiresAt, now)) {
    return {
      token: memoryCache.token,
      source: 'memory-cache',
      expiresAt: memoryCache.expiresAt,
    }
  }

  // Layer 2: Supabase cache
  const supabase = createAdminClient()
  const cacheRow = await supabase
    .from('zoho_token_cache')
    .select('access_token, expires_at')
    .eq('id', 1)
    .maybeSingle()

  if (cacheRow.error) {
    throw new Error(`Failed to read zoho_token_cache: ${cacheRow.error.message}`)
  }

  if (cacheRow.data) {
    const expiresAt = new Date(cacheRow.data.expires_at)
    if (isFresh(expiresAt, now)) {
      memoryCache = { token: cacheRow.data.access_token, expiresAt }
      return { token: cacheRow.data.access_token, source: 'db-cache', expiresAt }
    }
  }

  // Layer 3: Zoho refresh
  const fresh = await refreshFromZoho()

  const upsert = await supabase
    .from('zoho_token_cache')
    .upsert(
      {
        id: 1,
        access_token: fresh.accessToken,
        expires_at: fresh.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (upsert.error) {
    throw new Error(`Failed to upsert zoho_token_cache: ${upsert.error.message}`)
  }

  memoryCache = { token: fresh.accessToken, expiresAt: fresh.expiresAt }
  return { token: fresh.accessToken, source: 'cold', expiresAt: fresh.expiresAt }
}

export async function getAccessToken(): Promise<string> {
  const result = await fetchTokenWithSource()
  return result.token
}

// Resets only the in-memory cache. Used by the API client when Zoho returns
// 401 — drops the cached token so the next getAccessToken() call hits the DB
// (or refreshes if the DB row is also stale).
export function clearAuthCache(): void {
  memoryCache = null
}

export async function clearPersistedAuthCache(): Promise<void> {
  memoryCache = null
  const supabase = createAdminClient()
  const { error } = await supabase.from('zoho_token_cache').delete().eq('id', 1)
  if (error) throw new Error(`Failed to clear zoho_token_cache: ${error.message}`)
}

// Test-only helpers — do not use in production code.
export async function _getAccessTokenWithSourceForTesting(): Promise<GetTokenResult> {
  return fetchTokenWithSource()
}

// Clears both layers: in-memory cache AND the persisted Supabase row.
// Use this in tests that need a guaranteed cold start.
export async function _resetCacheForTesting(): Promise<void> {
  await clearPersistedAuthCache()
}
