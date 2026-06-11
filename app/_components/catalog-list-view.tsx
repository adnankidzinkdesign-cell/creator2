'use client'

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@tremor/react'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { approvalValue, categoryDisplay, itemTypeLabel, truncate } from './catalog-utils'
import { cleanDescription } from '@/lib/zoho/parse'
import { ResizableHeaderCell } from './resizable-header-cell'
import { QuantityStepper } from './quantity-stepper'

const TABLE_CELL_CLASS = '!whitespace-normal break-words align-top text-tremor-content'
const ROW_BASE_CLASS = 'group transition-colors duration-200'
const ROW_CELL_BASE_CLASS = 'border-y border-transparent px-4 py-4 align-top'
const LONG_TEXT_TRUNCATE = 120

export function CatalogListView({
  items,
  approvalScope,
  showBoqActions,
  showCreatorNames,
  showRoomPlanner,
  dragItemId,
  failedImageUrls,
  addButtonLabel,
  itemLocationById,
  columnWidths,
  addQuantityInputForItem,
  setAddQuantityForItem,
  commitAddQuantityForItem,
  onResizeStart,
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
  columnWidths: Record<string, number>
  addQuantityInputForItem: (id: string) => string
  setAddQuantityForItem: (id: string, qty: string) => void
  commitAddQuantityForItem: (id: string) => void
  onResizeStart: (column: string, x: number) => void
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
    <div className="dashboard-table-shell catalog-flat-panel overflow-hidden rounded-[22px]" style={{ position: 'relative' }}>
      <div className="overflow-x-auto">
        <Table className="w-full border-separate text-sm" style={{ minWidth: 'min-content', borderSpacing: '0' }}>
          <TableHead>
            <TableRow style={{ backgroundColor: '#e8ddd3' }}>
              <ResizableHeaderCell columnKey="image" width={columnWidths.image} onResizeStart={onResizeStart}>
                Image
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="name" width={columnWidths.name} onResizeStart={onResizeStart}>
                Furniture Item Name
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="sku" width={columnWidths.sku} onResizeStart={onResizeStart}>
                SKU ID
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="description" width={columnWidths.description} onResizeStart={onResizeStart}>
                Description
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="type" width={columnWidths.type} onResizeStart={onResizeStart}>
                Item Type
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="finishes" width={columnWidths.finishes} onResizeStart={onResizeStart}>
                Finishes Summary
              </ResizableHeaderCell>
              <ResizableHeaderCell columnKey="age" width={columnWidths.age} onResizeStart={onResizeStart}>
                Age Range
              </ResizableHeaderCell>
              {approvalScope === 'non-approved' ? (
                <ResizableHeaderCell columnKey="approval" width={columnWidths.approval} onResizeStart={onResizeStart}>
                  Approval
                </ResizableHeaderCell>
              ) : null}
              {showCreatorNames ? (
                <ResizableHeaderCell columnKey="creator" width={columnWidths.creator} onResizeStart={onResizeStart}>
                  Requestor
                </ResizableHeaderCell>
              ) : null}
              {showRoomPlanner || showBoqActions ? (
                <ResizableHeaderCell columnKey="room" width={columnWidths.room} onResizeStart={onResizeStart}>
                  Action
                </ResizableHeaderCell>
              ) : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => {
              const urls = imageUrls(item)
              const src = urls[0]
              const rowTone = index % 2 === 0 ? 'bg-[rgba(247,241,234,0.96)]' : 'bg-[rgba(239,231,220,0.96)]'
              const location = itemLocationById.get(item.id)
              const addQuantity = addQuantityInputForItem(item.id)
              const itemName = item.furniture_item_name || categoryDisplay(item.category, item.subcategory)

              return (
                <TableRow
                  key={item.id}
                  className={ROW_BASE_CLASS + (dragItemId === item.id ? ' opacity-70' : '')}
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
                >
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} rounded-l-[22px] cursor-pointer hover:opacity-80`}
                    style={{ width: `${columnWidths.image}px`, minWidth: `${columnWidths.image}px` }}
                    onClick={() => onSelectItem(item)}
                  >
                    <div className="h-14 w-full max-w-16 overflow-hidden rounded-[22px] border border-[rgba(109,91,81,0.12)] bg-white/50">
                      {(() => {
                        const displayUrl = src && failedImageUrls.has(src) ? '/product-images/nope-not-here.png' : src
                        const imageSrc = displayUrl || '/product-images/nope-not-here.png'
                        return (
                          <img
                            key={imageSrc}
                            src={imageSrc}
                            alt={itemName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => { if (src && !failedImageUrls.has(src)) onImageError(src) }}
                          />
                        )
                      })()}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} cursor-pointer hover:opacity-80`}
                    style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}
                    onClick={() => onSelectItem(item)}
                  >
                    <div className="space-y-1">
                      <div>{itemName}</div>
                      {location ? (
                        <div className="text-xs text-tremor-content-subtle">
                          {location.floorName} / {location.roomName}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} font-mono text-xs`}
                    style={{ width: `${columnWidths.sku}px`, minWidth: `${columnWidths.sku}px` }}
                  >
                    {item.sku_id ?? '—'}
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                    style={{ width: `${columnWidths.description}px`, minWidth: `${columnWidths.description}px` }}
                  >
                    {truncate(cleanDescription(item.description), LONG_TEXT_TRUNCATE)}
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                    style={{ width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }}
                  >
                    {itemTypeLabel(item)}
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                    style={{ width: `${columnWidths.finishes}px`, minWidth: `${columnWidths.finishes}px` }}
                  >
                    {truncate(item.finishes_summary, LONG_TEXT_TRUNCATE)}
                  </TableCell>
                  <TableCell
                    className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                    style={{ width: `${columnWidths.age}px`, minWidth: `${columnWidths.age}px` }}
                  >
                    {item.age_range ?? '—'}
                  </TableCell>
                  {approvalScope === 'non-approved' ? (
                    <TableCell
                      className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                      style={{ width: `${columnWidths.approval}px`, minWidth: `${columnWidths.approval}px` }}
                    >
                      {approvalValue(item) ? (
                        <Badge
                          color={
                            approvalValue(item)?.toLowerCase() === 'rejected'
                              ? 'red'
                              : approvalValue(item)?.toLowerCase() === 'pending'
                                ? 'yellow'
                                : 'slate'
                          }
                        >
                          {approvalValue(item)}
                        </Badge>
                      ) : (
                        <span className="text-tremor-content-subtle">—</span>
                      )}
                    </TableCell>
                  ) : null}
                  {showCreatorNames ? (
                    <TableCell
                      className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} ${showBoqActions || showRoomPlanner ? '' : 'rounded-r-[22px]'}`}
                      style={{ width: `${columnWidths.creator}px`, minWidth: `${columnWidths.creator}px` }}
                    >
                      <div className="space-y-0.5">
                        <div>First: {item.first_name ?? '—'}</div>
                        <div>Last: {item.last_name ?? '—'}</div>
                      </div>
                    </TableCell>
                  ) : null}
                  {showRoomPlanner || showBoqActions ? (
                    <TableCell
                      className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} rounded-r-[22px]`}
                      style={{ width: `${columnWidths.room}px`, minWidth: `${columnWidths.room}px` }}
                    >
                      <div className="flex items-center gap-2">
                        <QuantityStepper
                          value={addQuantity}
                          onChange={(qty) => setAddQuantityForItem(item.id, qty)}
                          onCommit={() => commitAddQuantityForItem(item.id)}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAddToBoq(item) }}
                          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors border border-[rgba(228,60,47,0.22)] bg-white/70 text-tremor-content-strong hover:bg-white"
                        >
                          {showRoomPlanner ? addButtonLabel : 'Add to BOQ'}
                        </button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
