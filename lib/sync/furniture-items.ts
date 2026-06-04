import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReport } from '@/lib/zoho/client'
import { mapFurnitureItem, type FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'

const REPORT_NAME = 'Furniture_Items_List_Report'
const UPSERT_BATCH_SIZE = 500

export type SyncFurnitureItemsResult = {
  synced: number
  duration_ms: number
  sync_log_id: string
}

/**
 * Fetches all rows of the Furniture_Items_List_Report from Zoho Creator,
 * maps them through `mapFurnitureItem`, and upserts them into
 * `mirror_furniture_items`. Maintains a `sync_log` row across the run so
 * failures are visible in the dashboard regardless of how the function was
 * invoked (cron route or server action).
 *
 * Throws on any failure; before re-throwing, best-effort updates the
 * sync_log row to `status='error'` with the message attached.
 */
export async function syncFurnitureItems(): Promise<SyncFurnitureItemsResult> {
  const supabase = createAdminClient()
  const startedAtMs = Date.now()

  const insertLog = await supabase
    .from('sync_log')
    .insert({
      report_name: REPORT_NAME,
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
    const records = await fetchReport(REPORT_NAME, {
      field_config: 'all',
      max_records: 200,
    })

    const rows: FurnitureItemRow[] = records.map(mapFurnitureItem)

    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
      const upsert = await supabase
        .from('mirror_furniture_items')
        .upsert(batch, { onConflict: 'id' })
      if (upsert.error) {
        throw new Error(
          `Upsert failed at batch starting index ${i}: ${upsert.error.message}`,
        )
      }
    }

    const currentIds = rows.map((row) => row.id)
    const removeStale =
      currentIds.length === 0
        ? await supabase.from('mirror_furniture_items').delete().neq('id', '')
        : await supabase
            .from('mirror_furniture_items')
            .delete()
            .not('id', 'in', `(${currentIds.join(',')})`)
    if (removeStale.error) {
      throw new Error(`Failed to remove stale furniture rows: ${removeStale.error.message}`)
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
      throw new Error(
        `Sync succeeded but failed to update sync_log: ${updateLog.error.message}`,
      )
    }

    return { synced: rows.length, duration_ms, sync_log_id: logId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Best-effort: any failure updating the log shouldn't shadow the original
    // error, so we ignore the result of this update.
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
