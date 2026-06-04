import 'server-only'

import * as XLSX from 'xlsx'
import { env } from '@/lib/env'
import { getAccessToken } from '@/lib/zoho/auth'

const FORM_LINK_NAME = 'Furniture_Items_List'
const SUBFORM_LINK_NAME = 'Finishes'
const MATCH_KEY = 'item_key'
const ITEMS_SHEET = 'Items'
const FINISHES_SHEET = 'Finishes'
const MAX_RECORDS_PER_REQUEST = 200

type ExcelRow = Record<string, unknown>

export type UploadSingleFileResult = {
  attempted: number
  uploaded: number
  errors: string[]
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

function cleanValue(value: unknown): unknown {
  if (isBlank(value)) return null
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (trimmed.includes(';')) {
    return trimmed
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return trimmed
}

function cleanRow(row: ExcelRow, skipKeys: string[]): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (skipKeys.includes(key)) continue
    const nextValue = cleanValue(value)
    if (nextValue !== null) cleaned[key] = nextValue
  }
  return cleaned
}

async function getSheetRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
): Promise<ExcelRow[]> {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  return XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: '',
    raw: false,
  })
}

function buildRecords(items: ExcelRow[], finishes: ExcelRow[]) {
  const finishesByKey = new Map<string, Record<string, unknown>[]>()

  finishes.forEach((finish, index) => {
    const itemKey = String(finish[MATCH_KEY] ?? '').trim()
    if (!itemKey) {
      throw new Error(`Finishes row ${index + 2} is missing ${MATCH_KEY}.`)
    }

    const finishRows = finishesByKey.get(itemKey) ?? []
    finishRows.push(cleanRow(finish, [MATCH_KEY]))
    finishesByKey.set(itemKey, finishRows)
  })

  return items.map((item, index) => {
    const itemKey = String(item[MATCH_KEY] ?? '').trim()
    if (!itemKey) {
      throw new Error(`Items row ${index + 2} is missing ${MATCH_KEY}.`)
    }

    const record = cleanRow(item, [MATCH_KEY])
    const finishRows = finishesByKey.get(itemKey)
    if (finishRows?.length) record[SUBFORM_LINK_NAME] = finishRows
    return record
  })
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function zohoFormUrl(): string {
  return `${env.ZOHO_API_BASE}/creator/v2.1/data/${env.ZOHO_ACCOUNT_OWNER}/${env.ZOHO_APP_NAME}/form/${FORM_LINK_NAME}`
}

function responseErrors(body: unknown): string[] {
  if (!body || typeof body !== 'object') return ['Zoho returned an empty response.']

  const root = body as {
    code?: number
    message?: string
    description?: string
    result?: unknown
  }
  const errors: string[] = []

  if (root.code !== 3000) {
    errors.push(root.description ?? root.message ?? `Zoho returned code ${root.code}`)
  }

  if (Array.isArray(root.result)) {
    root.result.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return
      const resultEntry = entry as {
        code?: number
        error?: unknown
        message?: string
      }
      if (resultEntry.code === 3000) return

      if (Array.isArray(resultEntry.error)) {
        errors.push(
          ...resultEntry.error.map((error) =>
            typeof error === 'string' ? error : JSON.stringify(error),
          ),
        )
      } else if (resultEntry.error) {
        errors.push(
          typeof resultEntry.error === 'string'
            ? resultEntry.error
            : JSON.stringify(resultEntry.error),
        )
      } else {
        errors.push(resultEntry.message ?? `Zoho rejected result ${index + 1}.`)
      }
    })
  }

  return errors.filter(Boolean)
}

async function postRecords(records: Record<string, unknown>[]) {
  const accessToken = await getAccessToken()
  const response = await fetch(zohoFormUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: records,
      result: {
        fields: ['Furniture_Item_Name', 'Furniture_Type'],
        message: true,
        tasks: true,
      },
    }),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { code: response.status, message: text }
  }

  if (!response.ok) {
    const errors = responseErrors(body)
    throw new Error(errors.join('; ') || `Zoho returned HTTP ${response.status}`)
  }

  return body
}

export async function uploadFurnitureItemsFromSingleFile(
  file: File,
): Promise<UploadSingleFileResult> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, {
    cellDates: true,
    type: 'buffer',
  })

  const items = await getSheetRows(workbook, ITEMS_SHEET)
  const finishes = await getSheetRows(workbook, FINISHES_SHEET)

  if (items.length === 0) throw new Error('Items sheet has no data rows.')

  const records = buildRecords(items, finishes)
  const errors: string[] = []
  let uploaded = 0

  for (const recordChunk of chunk(records, MAX_RECORDS_PER_REQUEST)) {
    const body = await postRecords(recordChunk)
    const nextErrors = responseErrors(body)
    if (nextErrors.length > 0) {
      errors.push(...nextErrors)
      continue
    }
    uploaded += recordChunk.length
  }

  return {
    attempted: records.length,
    uploaded,
    errors,
  }
}
