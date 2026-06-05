import type { ZohoCrmRecord } from '@/lib/zoho/crm-client'
import { parseDate, parseNumber, parseString } from '@/lib/zoho/parse'

export const CRM_DEAL_FIELDS = [
  'id',
  'Deal_Name',
  'Stage',
  'Amount',
  'Closing_Date',
  'Account_Name',
  'Contact_Name',
  'Owner',
  'Type',
  'Lead_Source',
  'Probability',
  'Expected_Revenue',
  'Campaign_Source',
  'Next_Step',
  'Description',
  'Created_Time',
  'Modified_Time',
  'School',
  'School_Group',
] as const

export type CrmDealRow = {
  id: string
  deal_name: string | null
  stage: string | null
  amount: number | null
  closing_date: string | null
  account_name: string | null
  account_id: string | null
  contact_name: string | null
  contact_id: string | null
  owner_name: string | null
  owner_id: string | null
  owner_email: string | null
  type: string | null
  lead_source: string | null
  probability: number | null
  expected_revenue: number | null
  campaign_source_name: string | null
  campaign_source_id: string | null
  next_step: string | null
  description: string | null
  created_time: string | null
  modified_time: string | null
  school_name: string | null
  school_group: string | null
  raw: ZohoCrmRecord
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function lookupName(v: unknown): string | null {
  if (!isObject(v)) return null
  return parseString(v.name ?? v.zc_display_value)
}

function lookupId(v: unknown): string | null {
  if (!isObject(v)) return null
  return parseString(v.id ?? v.ID)
}

function ownerEmail(v: unknown): string | null {
  if (!isObject(v)) return null
  return parseString(v.email)
}

function dateOnly(v: unknown): string | null {
  const parsed = parseDate(v)
  if (parsed === null) return null
  return parsed.toISOString().slice(0, 10)
}

export function mapCrmDeal(record: ZohoCrmRecord): CrmDealRow {
  const id = parseString(record.id)
  if (id === null) {
    throw new Error('CRM deal record is missing required field "id"')
  }

  return {
    id,
    deal_name: parseString(record.Deal_Name),
    stage: parseString(record.Stage),
    amount: parseNumber(record.Amount),
    closing_date: dateOnly(record.Closing_Date),
    account_name: lookupName(record.Account_Name),
    account_id: lookupId(record.Account_Name),
    contact_name: lookupName(record.Contact_Name),
    contact_id: lookupId(record.Contact_Name),
    owner_name: lookupName(record.Owner),
    owner_id: lookupId(record.Owner),
    owner_email: ownerEmail(record.Owner),
    type: parseString(record.Type),
    lead_source: parseString(record.Lead_Source),
    probability: parseNumber(record.Probability),
    expected_revenue: parseNumber(record.Expected_Revenue),
    campaign_source_name: lookupName(record.Campaign_Source),
    campaign_source_id: lookupId(record.Campaign_Source),
    next_step: parseString(record.Next_Step),
    description: parseString(record.Description),
    created_time: parseDate(record.Created_Time)?.toISOString() ?? null,
    modified_time: parseDate(record.Modified_Time)?.toISOString() ?? null,
    school_name: parseString(record.School),
    school_group: parseString(record.School_Group),
    raw: record,
  }
}
