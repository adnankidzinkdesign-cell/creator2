import 'server-only'
import { env } from '@/lib/env'
import { clearPersistedAuthCache, getAccessToken } from '@/lib/zoho/auth'

export type ZohoCrmRecord = Record<string, unknown>

export type FetchModulePageInfo = {
  pageNumber: number
  records: ZohoCrmRecord[]
  pageTokenIn: string | null
  pageTokenOut: string | null
}

export type FetchModuleOpts = {
  fields: string[]
  per_page?: number
  sort_by?: 'id' | 'Created_Time' | 'Modified_Time'
  sort_order?: 'asc' | 'desc'
  onPage?: (info: FetchModulePageInfo) => void
}

export class ZohoCrmError extends Error {
  readonly status: number
  readonly endpoint: string
  readonly body: unknown

  constructor(message: string, status: number, endpoint: string, body: unknown) {
    super(`${message} [endpoint=${endpoint}, status=${status}]`)
    this.name = 'ZohoCrmError'
    this.status = status
    this.endpoint = endpoint
    this.body = body
  }
}

type RawResponse = {
  status: number
  body: unknown
  ok: boolean
}

type CrmInfo = {
  more_records?: unknown
  next_page_token?: unknown
}

const MAX_PER_PAGE = 200
const MAX_FIELDS = 50

function buildModuleUrl(moduleApiName: string): string {
  return `${env.ZOHO_API_BASE}/crm/v8/${encodeURIComponent(moduleApiName)}`
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

async function rawCall(endpoint: string): Promise<RawResponse> {
  const accessToken = await getAccessToken()
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  })

  if (res.status === 204) {
    return { status: 204, body: null, ok: true }
  }

  const text = await res.text()
  return {
    status: res.status,
    body: tryParseJson(text),
    ok: res.ok,
  }
}

async function callWith401Retry(endpoint: string): Promise<RawResponse> {
  const first = await rawCall(endpoint)
  if (first.status !== 401) return first

  await clearPersistedAuthCache()
  const second = await rawCall(endpoint)
  if (second.status === 401) {
    throw new ZohoCrmError(
      'Zoho CRM returned 401 even after refreshing the access token',
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
    throw new ZohoCrmError(
      'Zoho CRM rate limit hit (429) - back off and retry later; not auto-retried',
      429,
      endpoint,
      r.body,
    )
  }
  throw new ZohoCrmError('Zoho CRM API returned non-2xx', r.status, endpoint, r.body)
}

function extractRecords(body: unknown, status: number, endpoint: string): ZohoCrmRecord[] {
  if (body === null) return []
  if (!isObject(body)) {
    throw new ZohoCrmError('Zoho CRM response body is not an object', status, endpoint, body)
  }
  const data = body.data
  if (data === undefined) return []
  if (!Array.isArray(data)) {
    throw new ZohoCrmError('Zoho CRM response `data` is not an array', status, endpoint, body)
  }
  return data as ZohoCrmRecord[]
}

function extractInfo(body: unknown): CrmInfo {
  if (!isObject(body) || !isObject(body.info)) return {}
  return body.info
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

export async function fetchCrmModule<T = ZohoCrmRecord>(
  moduleApiName: string,
  opts: FetchModuleOpts,
): Promise<T[]> {
  if (opts.fields.length === 0) {
    throw new Error('Zoho CRM fields must include at least one field')
  }
  if (opts.fields.length > MAX_FIELDS) {
    throw new Error(`Zoho CRM fields accepts at most ${MAX_FIELDS} fields`)
  }

  const perPage = opts.per_page ?? MAX_PER_PAGE
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) {
    throw new Error(`Zoho CRM per_page must be an integer from 1 to ${MAX_PER_PAGE}`)
  }

  const all: ZohoCrmRecord[] = []
  let page = 1
  let pageToken: string | null = null
  let pageNumber = 0

  while (true) {
    pageNumber += 1

    const params = new URLSearchParams()
    params.set('fields', opts.fields.join(','))
    params.set('per_page', String(perPage))
    if (opts.sort_by) params.set('sort_by', opts.sort_by)
    if (opts.sort_order) params.set('sort_order', opts.sort_order)
    if (pageToken) {
      params.set('page_token', pageToken)
    } else {
      params.set('page', String(page))
    }

    const endpoint = `${buildModuleUrl(moduleApiName)}?${params.toString()}`
    const r = await callWith401Retry(endpoint)
    throwIfErrorStatus(endpoint, r)

    const records = extractRecords(r.body, r.status, endpoint)
    const info = extractInfo(r.body)
    const nextPageToken = stringOrNull(info.next_page_token)
    all.push(...records)

    opts.onPage?.({
      pageNumber,
      records,
      pageTokenIn: pageToken,
      pageTokenOut: nextPageToken,
    })

    if (info.more_records !== true) break

    if (nextPageToken) {
      pageToken = nextPageToken
    } else {
      page += 1
      if (page > 10) {
        throw new ZohoCrmError(
          'Zoho CRM indicated more records but did not provide next_page_token after page 10',
          r.status,
          endpoint,
          r.body,
        )
      }
    }
  }

  return all as T[]
}
