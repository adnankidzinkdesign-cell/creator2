import { BoqWorkspace } from '../_components/boq-workspace'
import { getCrmDealOptions } from '@/lib/queries/crm-deals'
import { getFurnitureItems } from '@/lib/queries/furniture-items'

export const dynamic = 'force-dynamic'

export default async function BoqPage() {
  const [items, deals] = await Promise.all([
    getFurnitureItems(),
    getCrmDealOptions(),
  ])

  return <BoqWorkspace items={items} deals={deals} />
}
