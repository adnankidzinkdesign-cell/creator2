import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { multiLookupDisplays } from '@/lib/zoho/parse'

export type FurnitureItemStats = {
  total_count: number
  total_value_aed: number
  average_price_aed: number | null
  items_with_pricing: number
  by_category: Array<{ category: string; count: number }>
  by_furniture_type: Array<{ furniture_type: string; count: number }>
}

export type SyncStatus = 'success' | 'error' | 'running'

export type LatestSyncInfo = {
  last_success_at: Date | null
  last_status: SyncStatus | null
  last_records: number | null
}

const REPORT_NAME = 'Furniture_Items_List_Report'

function normalizeFurnitureItemRow(row: FurnitureItemRow): FurnitureItemRow {
  const suitableSpaces = multiLookupDisplays(row.suitable_spaces)
  return {
    ...row,
    suitable_spaces:
      suitableSpaces.length > 0
        ? suitableSpaces
        : multiLookupDisplays(row.raw?.Suitable_Spaces),
    finishes: multiLookupDisplays(row.finishes),
  }
}

export async function getFurnitureItems(): Promise<FurnitureItemRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mirror_furniture_items')
    .select('*')
    .order('sku_id', { ascending: true })
  if (error) {
    throw new Error(`Failed to load furniture items: ${error.message}`)
  }
  return ((data ?? []) as unknown as FurnitureItemRow[]).map(normalizeFurnitureItemRow)
}

/**
 * Pulls the columns needed for stats in a single query and aggregates
 * client-side. Up to a few thousand rows this is a few KB over the wire —
 * for a much bigger catalog we'd swap this for an `rpc()` call to a SQL
 * function with native GROUP BY.
 */
export async function getFurnitureItemStats(): Promise<FurnitureItemStats> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mirror_furniture_items')
    .select('retail_price_aed, category, furniture_type')

  if (error) {
    throw new Error(`Failed to load furniture stats: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    retail_price_aed: number | null
    category: string | null
    furniture_type: string | null
  }>

  const total_count = rows.length

  let total_value_aed = 0
  let items_with_pricing = 0
  for (const r of rows) {
    if (r.retail_price_aed !== null && Number.isFinite(r.retail_price_aed)) {
      total_value_aed += r.retail_price_aed
      items_with_pricing += 1
    }
  }
  const average_price_aed =
    items_with_pricing > 0 ? total_value_aed / items_with_pricing : null

  const categoryMap = new Map<string, number>()
  for (const r of rows) {
    const key = r.category ?? 'Uncategorized'
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1)
  }
  const by_category = [...categoryMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  const typeMap = new Map<string, number>()
  for (const r of rows) {
    const key = r.furniture_type ?? 'Unspecified'
    typeMap.set(key, (typeMap.get(key) ?? 0) + 1)
  }
  const by_furniture_type = [...typeMap.entries()]
    .map(([furniture_type, count]) => ({ furniture_type, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total_count,
    total_value_aed,
    average_price_aed,
    items_with_pricing,
    by_category,
    by_furniture_type,
  }
}

export async function getLatestSyncInfo(): Promise<LatestSyncInfo> {
  const supabase = createAdminClient()

  const [latest, latestSuccess] = await Promise.all([
    supabase
      .from('sync_log')
      .select('status, records_synced')
      .eq('report_name', REPORT_NAME)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sync_log')
      .select('finished_at')
      .eq('report_name', REPORT_NAME)
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (latest.error) {
    throw new Error(`Failed to read sync_log: ${latest.error.message}`)
  }
  if (latestSuccess.error) {
    throw new Error(`Failed to read sync_log: ${latestSuccess.error.message}`)
  }

  const lastStatus = (latest.data?.status as SyncStatus | undefined) ?? null
  const lastRecords = (latest.data?.records_synced as number | null | undefined) ?? null
  const lastSuccessAtRaw = latestSuccess.data?.finished_at as string | null | undefined
  const lastSuccessAt = lastSuccessAtRaw ? new Date(lastSuccessAtRaw) : null

  return {
    last_success_at: lastSuccessAt,
    last_status: lastStatus,
    last_records: lastRecords,
  }
}
