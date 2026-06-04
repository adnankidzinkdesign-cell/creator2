import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCrmModule } from '@/lib/zoho/crm-client'
import { CRM_DEAL_FIELDS, mapCrmDeal, type CrmDealRow } from '@/lib/zoho/mappers/crm-deals'

const SYNC_SOURCE_NAME = 'CRM_Deals'
const UPSERT_BATCH_SIZE = 500
const DELETE_BATCH_SIZE = 500

export type SyncCrmDealsResult = {
  synced: number
  duration_ms: number
  sync_log_id: string
}

export async function syncCrmDeals(): Promise<SyncCrmDealsResult> {
  const supabase = createAdminClient()
  const startedAtMs = Date.now()

  const insertLog = await supabase
    .from('sync_log')
    .insert({
      report_name: SYNC_SOURCE_NAME,
      status: 'running',
      started_at: new Date(startedAtMs).toISOString(),
    })
    .select('id')
    .single()

  if (insertLog.error || !insertLog.data) {
    throw new Error(
      `Failed to open sync_log row: ${insertLog.error?.message ?? 'no row returned'}`,
    )
  }

  const logId: string = insertLog.data.id as string

  try {
    const records = await fetchCrmModule('Deals', {
      fields: [...CRM_DEAL_FIELDS],
      per_page: 200,
      sort_by: 'Modified_Time',
      sort_order: 'desc',
    })

    const rows: CrmDealRow[] = records.map(mapCrmDeal)

    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
      const upsert = await supabase
        .from('mirror_crm_deals')
        .upsert(batch, { onConflict: 'id' })
      if (upsert.error) {
        throw new Error(`Upsert failed at batch starting index ${i}: ${upsert.error.message}`)
      }
    }

    const currentIdSet = new Set(rows.map((row) => row.id))
    const existing = await supabase.from('mirror_crm_deals').select('id')
    if (existing.error) {
      throw new Error(`Failed to list existing CRM deal rows: ${existing.error.message}`)
    }

    const staleIds = (existing.data ?? [])
      .map((row) => row.id as string)
      .filter((id) => !currentIdSet.has(id))

    for (let i = 0; i < staleIds.length; i += DELETE_BATCH_SIZE) {
      const batch = staleIds.slice(i, i + DELETE_BATCH_SIZE)
      const removeStale = await supabase.from('mirror_crm_deals').delete().in('id', batch)
      if (removeStale.error) {
        throw new Error(
          `Failed to remove stale CRM deal rows at batch starting index ${i}: ${removeStale.error.message}`,
        )
      }
    }

    const finishedAtMs = Date.now()
    const duration_ms = finishedAtMs - startedAtMs

    const updateLog = await supabase
      .from('sync_log')
      .update({
        status: 'success',
        records_synced: rows.length,
        finished_at: new Date(finishedAtMs).toISOString(),
      })
      .eq('id', logId)
    if (updateLog.error) {
      throw new Error(`Sync succeeded but failed to update sync_log: ${updateLog.error.message}`)
    }

    return { synced: rows.length, duration_ms, sync_log_id: logId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('sync_log')
      .update({
        status: 'error',
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', logId)
    throw err
  }
}
