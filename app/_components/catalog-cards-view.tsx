'use client'

import { Badge } from '@tremor/react'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { approvalValue, categoryDisplay, itemTypeLabel, truncate } from './catalog-utils'
import { cleanDescription } from '@/lib/zoho/parse'
import { ImageCarousel } from './image-carousel'
import { QuantityStepper } from './quantity-stepper'

export function CatalogCardsView({
  items,
  approvalScope,
  showBoqActions,
  showCreatorNames,
  showRoomPlanner,
  dragItemId,
  failedImageUrls,
  addButtonLabel,
  itemLocationById,
  addQuantityInputForItem,
  setAddQuantityForItem,
  commitAddQuantityForItem,
  onBeginDrag,
  onEndDrag,
  onAddToBoq,
  onImageError,
  onSelectItem,
}: {
  items: FurnitureItemRow[]
  approvalScope: 'approved' | 'non-approved'
  showBoqActions: boolean
  showCreatorNames: boolean
  showRoomPlanner: boolean
  dragItemId: string | null
  failedImageUrls: Set<string>
  addButtonLabel: string
  itemLocationById: Map<string, { floorName: string; roomName: string }>
  addQuantityInputForItem: (id: string) => string
  setAddQuantityForItem: (id: string, qty: string) => void
  commitAddQuantityForItem: (id: string) => void
  onBeginDrag: (id: string) => void
  onEndDrag: () => void
  onAddToBoq: (item: FurnitureItemRow) => void
  onImageError: (url: string) => void
  onSelectItem: (item: FurnitureItemRow) => void
}) {
  function imageUrls(item: FurnitureItemRow): string[] {
    if (item.old_code) return [`/product-images/${encodeURIComponent(item.old_code)}.png`]
    if (item.image_urls?.length) return item.image_urls
    if (item.image_url) return [item.image_url]
    const paths: string[] = []
    const singleImage = typeof item.raw['Image'] === 'string' && item.raw['Image'].trim() ? item.raw['Image'] : null
    if (singleImage) paths.push(singleImage)
    if (Array.isArray(item.raw.Image1)) {
      paths.push(...(item.raw.Image1 as string[]).filter((v) => typeof v === 'string' && v.trim()))
    }
    return [...new Set(paths)].map((p) => `/api/zoho-image?path=${encodeURIComponent(p)}`)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const urls = imageUrls(item)
        const imageAlt = item.furniture_item_name ?? categoryDisplay(item.category, item.subcategory)
        const location = itemLocationById.get(item.id)
        const addQuantity = addQuantityInputForItem(item.id)

        return (
          <article
            key={item.id}
            draggable={showRoomPlanner}
            onPointerDown={() => { if (showRoomPlanner) onBeginDrag(item.id) }}
            onDragStart={(e) => {
              if (!showRoomPlanner) return
              onBeginDrag(item.id)
              e.dataTransfer.setData('text/plain', item.id)
              e.dataTransfer.setData('application/x-kidzink-item-id', item.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={onEndDrag}
            className={
              'dashboard-panel overflow-hidden p-4 hover:shadow-md transition-shadow ' +
              (index % 2 === 0 ? 'bg-[rgba(247,241,234,0.95)]' : 'bg-[rgba(239,231,220,0.95)]') +
              (showRoomPlanner ? ' active:cursor-grabbing' : '') +
              (dragItemId === item.id ? ' opacity-70' : '')
            }
          >
            <div
              className="mb-4 aspect-[4/3] overflow-hidden rounded-[22px] border border-[rgba(109,91,81,0.12)] bg-white/50 cursor-pointer hover:opacity-80"
              onClick={() => onSelectItem(item)}
            >
              <ImageCarousel alt={imageAlt} urls={urls} failedUrls={failedImageUrls} onImageError={onImageError} />
            </div>

            <div className="flex items-start justify-between gap-3 cursor-pointer hover:opacity-80" onClick={() => onSelectItem(item)}>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-tremor-content">{item.sku_id ?? '—'}</p>
                <h2 className="mt-1 line-clamp-2 text-base font-semibold text-tremor-content-strong">
                  {item.furniture_item_name || categoryDisplay(item.category, item.subcategory)}
                </h2>
                {location ? (
                  <p className="mt-1 truncate text-xs text-tremor-content-subtle">
                    {location.floorName} / {location.roomName}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge color="rose">{itemTypeLabel(item)}</Badge>
                {approvalScope === 'non-approved' && approvalValue(item) ? (
                  <Badge color="slate">{approvalValue(item)}</Badge>
                ) : null}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="col-span-2">
                <dt className="text-tremor-content-subtle">Description</dt>
                <dd className="mt-1 line-clamp-3 text-tremor-content-emphasis">
                  {truncate(cleanDescription(item.description), 170)}
                </dd>
              </div>
              <div>
                <dt className="text-tremor-content-subtle">Age Range</dt>
                <dd className="mt-1 truncate text-tremor-content-emphasis">{item.age_range ?? '—'}</dd>
              </div>
              {showCreatorNames ? (
                <>
                  <div className="col-span-2">
                    <dt className="text-tremor-content-subtle">Requestor</dt>
                    <dd className="mt-1 space-y-0.5 text-tremor-content-emphasis">
                      <div>First: {item.first_name ?? '—'}</div>
                      <div>Last: {item.last_name ?? '—'}</div>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-tremor-content-subtle">Approval</dt>
                    <dd className="mt-1 truncate text-tremor-content-emphasis">{approvalValue(item) ?? '—'}</dd>
                  </div>
                </>
              ) : null}
            </dl>

            <div className="mt-4 text-sm">
              <p className="text-tremor-content-subtle">Finishes Summary</p>
              <p className="mt-1 line-clamp-3 min-h-14 text-tremor-content">{truncate(item.finishes_summary, 150)}</p>
            </div>

            {showBoqActions || showRoomPlanner ? (
              <div className="mt-4 flex items-center gap-2">
                <QuantityStepper
                  value={addQuantity}
                  onChange={(qty) => setAddQuantityForItem(item.id, qty)}
                  onCommit={() => commitAddQuantityForItem(item.id)}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAddToBoq(item) }}
                  className="min-w-0 flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors border border-[rgba(228,60,47,0.22)] bg-white/70 text-tremor-content-strong hover:bg-white"
                >
                  {showRoomPlanner ? addButtonLabel : 'Add to BOQ'}
                </button>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
