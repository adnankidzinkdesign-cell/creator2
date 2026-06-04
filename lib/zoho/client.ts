import 'server-only'
import { env } from '@/lib/env'
import { clearPersistedAuthCache, getAccessToken } from '@/lib/zoho/auth'

export type ZohoRecord = Record<string, unknown>

export type FieldConfig = 'all' | 'quick_view' | 'detail_view' | 'custom'

export type FetchReportPageInfo = {
  pageNumber: number
  records: ZohoRecord[]
  cursorIn: string | null
  cursorOut: string | null
}

/**
 * Zoho Creator v2.1 only accepts these specific page sizes — Zoho returns
 * error code 9250 ("Please enter a valid input for 'max_records' key") for
 * any other value.
 */
export type MaxRecords = 200 | 500 | 1000

export type FetchReportOpts = {
  criteria?: string
  field_config?: FieldConfig
  /** Records per page. Must be one of: 200, 500, 1000. Default 200. */
  max_records?: MaxRecords
  /** Optional callback invoked once per page — useful for testing pagination. */
  onPage?: (info: FetchReportPageInfo) => void
}

export class ZohoCreatorError extends Error {
  readonly status: number
  readonly endpoint: string
  readonly body: unknown

  constructor(message: string, status: number, endpoint: string, body: unknown) {
    super(`${message} [endpoint=${endpoint}, status=${status}]`)
    this.name = 'ZohoCreatorError'
    this.status = status
    this.endpoint = endpoint
    this.body = body
  }
}

const MAX_RECORDS_DEFAULT: MaxRecords = 200
const ALLOWED_MAX_RECORDS: ReadonlySet<number> = new Set([200, 500, 1000])

function buildReportUrl(reportName: string): string {
  return `${env.ZOHO_API_BASE}/creator/v2.1/data/${env.ZOHO_ACCOUNT_OWNER}/${env.ZOHO_APP_NAME}/report/${encodeURIComponent(reportName)}`
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

type RawResponse = {
  status: number
  body: unknown // parsed JSON when possible, else raw string, or null on 204
  nextCursor: string | null
  ok: boolean
}

async function rawCall(endpoint: string, recordCursor?: string): Promise<RawResponse> {
  const accessToken = await getAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  }
  if (recordCursor) headers.record_cursor = recordCursor

  const res = await fetch(endpoint, { headers })
  const nextCursor = res.headers.get('record_cursor')

  if (res.status === 204) {
    return { status: 204, body: null, nextCursor, ok: true }
  }

  const text = await res.text()
  return {
    status: res.status,
    body: tryParseJson(text),
    nextCursor,
    ok: res.ok,
  }
}

async function callWith401Retry(endpoint: string, recordCursor?: string): Promise<RawResponse> {
  const first = await rawCall(endpoint, recordCursor)
  if (first.status !== 401) return first

  // Token may have been invalidated upstream (revoked, rotated, or re-scoped).
  // Drop all caches so getAccessToken() refreshes from Zoho.
  await clearPersistedAuthCache()
  const second = await rawCall(endpoint, recordCursor)
  if (second.status === 401) {
    throw new ZohoCreatorError(
      'Zoho returned 401 even after refreshing the access token',
      401,
      endpoint,
      second.body,
    )
  }
  return second
}

function throwIfErrorStatus(endpoint: string, r: RawResponse): void {
  if (r.ok) return
  if (r.status === 429) {
    throw new ZohoCreatorError(
      'Zoho rate limit hit (429) — back off and retry later; not auto-retried',
      429,
      endpoint,
      r.body,
    )
  }
  throw new ZohoCreatorError(
    `Zoho Creator API returned non-2xx`,
    r.status,
    endpoint,
    r.body,
  )
}

function extractRecords(body: unknown, status: number, endpoint: string): ZohoRecord[] {
  if (body === null) return []
  if (!isObject(body)) {
    throw new ZohoCreatorError('Zoho response body is not an object', status, endpoint, body)
  }
  const data = body.data
  if (data === undefined) {
    // Empty result with no `data` key — treat as no records.
    return []
  }
  if (!Array.isArray(data)) {
    throw new ZohoCreatorError('Zoho response `data` is not an array', status, endpoint, body)
  }
  return data as ZohoRecord[]
}

export async function fetchReport<T = ZohoRecord>(
  reportName: string,
  opts: FetchReportOpts = {},
): Promise<T[]> {
  const baseUrl = buildReportUrl(reportName)
  const params = new URLSearchParams()
  if (opts.criteria) params.set('criteria', opts.criteria)
  params.set('field_config', opts.field_config ?? 'all')
  const maxRecords: MaxRecords = opts.max_records ?? MAX_RECORDS_DEFAULT
  if (!ALLOWED_MAX_RECORDS.has(maxRecords)) {
    throw new Error(`max_records must be one of 200, 500, 1000 — got ${maxRecords}`)
  }
  params.set('max_records', String(maxRecords))
  const endpoint = `${baseUrl}?${params.toString()}`

  const all: ZohoRecord[] = []
  let cursorIn: string | null = null
  let pageNumber = 0

  while (true) {
    pageNumber += 1
    const r = await callWith401Retry(endpoint, cursorIn ?? undefined)
    throwIfErrorStatus(endpoint, r)

    const records = extractRecords(r.body, r.status, endpoint)
    all.push(...records)

    if (opts.onPage) {
      opts.onPage({
        pageNumber,
        records,
        cursorIn,
        cursorOut: r.nextCursor,
      })
    }

    if (!r.nextCursor) break
    cursorIn = r.nextCursor
  }

  return all as T[]
}

export async function fetchRecord<T = ZohoRecord>(
  reportName: string,
  recordId: string,
): Promise<T> {
  const endpoint = `${buildReportUrl(reportName)}/${encodeURIComponent(recordId)}`
  const r = await callWith401Retry(endpoint)
  throwIfErrorStatus(endpoint, r)

  if (!isObject(r.body)) {
    throw new ZohoCreatorError(
      'Zoho response body is not an object',
      r.status,
      endpoint,
      r.body,
    )
  }

  const data = r.body.data
  if (data === undefined || data === null) {
    throw new ZohoCreatorError(
      'Zoho response missing `data` field',
      r.status,
      endpoint,
      r.body,
    )
  }

  // Zoho v2.1 returns a single record as an object on the by-id endpoint.
  // Some report shapes return data as a single-element array; handle both.
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new ZohoCreatorError(
        'Zoho response `data` array is empty for single-record fetch',
        r.status,
        endpoint,
        r.body,
      )
    }
    return data[0] as T
  }
  return data as T
}
