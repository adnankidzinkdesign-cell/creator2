// TODO: this page is currently unauthenticated. Auth gating will be added
// in Step 8 — the (admin) route group will get a layout that redirects
// unauthenticated requests.

import { formatDistanceToNow } from 'date-fns'
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
} from '@tremor/react'
import { createAdminClient } from '@/lib/supabase/admin'
import { SyncButton } from './sync-button'
import { UploadDataButton } from './upload-data-button'
import { UploadSingleFileButton } from './upload-single-file-button'

export const dynamic = 'force-dynamic'

type SyncStatus = 'running' | 'success' | 'error'

type SyncLogRow = {
  id: string
  report_name: string
  status: SyncStatus
  records_synced: number | null
  error: string | null
  started_at: string
  finished_at: string | null
}

function statusColor(status: SyncStatus): 'emerald' | 'red' | 'amber' {
  if (status === 'success') return 'emerald'
  if (status === 'error') return 'red'
  return 'amber'
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—'
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

async function loadData() {
  const supabase = createAdminClient()

  const [logs, furnitureCount, crmDealsCount, lastSuccess, crmDealsLastSuccess] =
    await Promise.all([
    supabase
      .from('sync_log')
      .select('id, report_name, status, records_synced, error, started_at, finished_at')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('mirror_furniture_items')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('mirror_crm_deals')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('sync_log')
      .select('finished_at')
      .eq('report_name', 'Furniture_Items_List_Report')
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sync_log')
      .select('finished_at')
      .eq('report_name', 'CRM_Deals')
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ])

  return {
    logs: (logs.data ?? []) as SyncLogRow[],
    logsError: logs.error?.message ?? null,
    furnitureCount: furnitureCount.count ?? 0,
    furnitureCountError: furnitureCount.error?.message ?? null,
    dealsCount: crmDealsCount.count ?? 0,
    dealsCountError: crmDealsCount.error?.message ?? null,
    lastSuccessAt: (lastSuccess.data?.finished_at as string | null | undefined) ?? null,
    dealsLastSuccessAt: (crmDealsLastSuccess.data?.finished_at as string | null | undefined) ?? null,
  }
}

export default async function SettingsPage() {
  const {
    logs,
    logsError,
    furnitureCount,
    furnitureCountError,
    dealsCount,
    dealsCountError,
    lastSuccessAt,
    dealsLastSuccessAt,
  } = await loadData()

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="dashboard-panel px-6 py-5">
        <Title>Settings</Title>
        <Text>Manage data sources and review sync activity.</Text>
      </div>

      <Card className="dashboard-panel border-0 bg-transparent shadow-none">
        <Title>Data Sources</Title>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Furniture Items
            </div>
            <Text>
              Records mirrored:{' '}
              {furnitureCountError ? (
                <span className="text-red-600">error: {furnitureCountError}</span>
              ) : (
                <strong>{furnitureCount.toLocaleString()}</strong>
              )}
            </Text>
            <Text>
              Last synced:{' '}
              {lastSuccessAt
                ? `${formatDistanceToNow(new Date(lastSuccessAt))} ago`
                : 'never'}
            </Text>
          </div>
          <SyncButton source="furniture" />
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-[rgba(109,91,81,0.18)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
              CRM Deals
            </div>
            <Text>
              Records mirrored:{' '}
              {dealsCountError ? (
                <span className="text-red-600">error: {dealsCountError}</span>
              ) : (
                <strong>{dealsCount.toLocaleString()}</strong>
              )}
            </Text>
            <Text>
              Last synced:{' '}
              {dealsLastSuccessAt
                ? `${formatDistanceToNow(new Date(dealsLastSuccessAt))} ago`
                : 'never'}
            </Text>
          </div>
          <SyncButton source="crm-deals" />
        </div>
      </Card>

      <Card className="dashboard-panel border-0 bg-transparent shadow-none">
        <Title>Upload Furniture Data</Title>
        <Text className="mt-1">
          Upload one Excel file for main item records and one Excel file for
          Finishes rows. Both files must include an item_key column.
        </Text>
        <div className="mt-4">
          <UploadDataButton />
        </div>
      </Card>

      <Card className="dashboard-panel border-0 bg-transparent shadow-none">
        <Title>Upload Single File</Title>
        <Text className="mt-1">
          Upload a single Excel file with both Items and Finishes sheets. Both sheets must include
          an item_key column to match records.
        </Text>
        <div className="mt-4">
          <UploadSingleFileButton />
        </div>
      </Card>

      <Card className="dashboard-panel border-0 bg-transparent shadow-none">
        <Title>Recent Sync Activity</Title>
        {logsError && (
          <Text className="mt-2 text-red-600">Failed to load sync log: {logsError}</Text>
        )}
        {!logsError && logs.length === 0 && (
          <Text className="mt-2">No sync runs yet.</Text>
        )}
        {!logsError && logs.length > 0 && (
          <Table className="mt-4 w-full table-fixed border-separate border-spacing-y-3">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Report</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Records</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell className="text-right">Duration</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log, index) => {
                const rowTone =
                  index % 2 === 0
                    ? 'bg-[rgba(247,241,234,0.96)]'
                    : 'bg-[rgba(239,231,220,0.96)]'

                return (
                <TableRow key={log.id} className="group">
                  <TableCell className={`rounded-l-[22px] ${rowTone}`}>{log.report_name}</TableCell>
                  <TableCell className={rowTone}>
                    <Badge color={statusColor(log.status)}>{log.status}</Badge>
                    {log.status === 'error' && log.error && (
                      <div className="mt-1 text-xs text-red-600">{log.error}</div>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${rowTone}`}>
                    {log.records_synced ?? '—'}
                  </TableCell>
                  <TableCell className={rowTone}>
                    {formatDistanceToNow(new Date(log.started_at))} ago
                  </TableCell>
                  <TableCell className={`rounded-r-[22px] text-right tabular-nums ${rowTone}`}>
                    {formatDuration(log.started_at, log.finished_at)}
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
