import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env.local')
} catch {
  console.error(
    'Could not load .env.local from the project root. ' +
      'Copy .env.local.example to .env.local and fill in real values, then re-run.',
  )
  process.exit(1)
}

function fail(step: string, err: unknown): never {
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ZohoCrmError') {
    const e = err as unknown as { message: string; status: number; body: unknown }
    console.error(`\n[FAIL] ${step}: ${e.message}`)
    console.error(`       status=${e.status}`)
    console.error(`       body=${JSON.stringify(e.body)}`)
    process.exit(1)
  }
  const message = err instanceof Error ? err.message : String(err)
  console.error(`\n[FAIL] ${step}: ${message}`)
  process.exit(1)
}

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin')
  const { syncCrmDeals } = await import('../lib/sync/crm-deals')
  const supabase = createAdminClient()

  const before = await supabase
    .from('mirror_crm_deals')
    .select('*', { count: 'exact', head: true })
  if (before.error) fail('read mirror_crm_deals before sync', before.error)
  console.log(`CRM deals before sync: ${before.count ?? 0}`)

  const result = await syncCrmDeals()
  console.log(`Synced ${result.synced} CRM deal(s) in ${result.duration_ms}ms`)

  const after = await supabase
    .from('mirror_crm_deals')
    .select('*', { count: 'exact', head: true })
  if (after.error) fail('read mirror_crm_deals after sync', after.error)
  console.log(`CRM deals after sync: ${after.count ?? 0}`)
}

main().catch((err) => fail('sync CRM deals', err))
