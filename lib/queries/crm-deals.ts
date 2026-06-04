import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type CrmDealOption = {
  id: string
  deal_name: string | null
  stage: string | null
  amount: number | null
  closing_date: string | null
  account_name: string | null
  owner_name: string | null
  modified_time: string | null
}

export async function getCrmDealOptions(): Promise<CrmDealOption[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mirror_crm_deals')
    .select('id, deal_name, stage, amount, closing_date, account_name, owner_name, modified_time')
    .order('modified_time', { ascending: false, nullsFirst: false })
    .limit(2000)

  if (error) {
    throw new Error(`Failed to load CRM deals: ${error.message}`)
  }

  return (data ?? []) as CrmDealOption[]
}
