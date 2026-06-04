import { CatalogTable } from './_components/catalog-table'
import { getFurnitureItems } from '@/lib/queries/furniture-items'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const items = await getFurnitureItems()

  return (
    <div>
      <CatalogTable items={items} approvalScope="approved" showRoomPlanner />
    </div>
  )
}
