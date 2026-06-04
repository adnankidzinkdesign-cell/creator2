import { CatalogTable } from '../_components/catalog-table'
import { getFurnitureItems } from '@/lib/queries/furniture-items'

export const dynamic = 'force-dynamic'

export default async function PendingItemsPage() {
  const items = await getFurnitureItems()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-tremor-content-strong">
          Pending / Rejected
        </h1>
        <p className="text-sm text-tremor-content">
          Non-approved furniture items live here for review.
        </p>
      </div>
      <CatalogTable
        items={items}
        approvalScope="non-approved"
        showBoqActions={false}
        showCreatorNames
      />
    </div>
  )
}
