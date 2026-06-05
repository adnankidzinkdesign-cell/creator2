'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  TextInput,
} from '@tremor/react'

function ResizableHeaderCell({
  children,
  columnKey,
  width,
  onResizeStart,
}: {
  children: React.ReactNode
  columnKey: string
  width: number
  onResizeStart: (column: string, startX: number) => void
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <TableHeaderCell
      className="relative select-none"
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        position: 'relative',
        borderRight: '1px solid #d4c5b9',
        backgroundColor: '#e8ddd3',
        color: '#5c4033',
        fontWeight: '600',
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between w-full h-full px-4 py-3">
        <span className="flex-1 truncate">{children}</span>

        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              bottom: '-28px',
              right: '0',
              padding: '4px 8px',
              backgroundColor: '#1f2937',
              color: 'white',
              fontSize: '12px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            Drag to resize
          </div>
        )}

        <div
          onMouseDown={(e) => {
            e.preventDefault()
            onResizeStart(columnKey, e.clientX)
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            position: 'absolute',
            right: '-4px',
            top: '0',
            bottom: '0',
            width: '8px',
            cursor: 'col-resize',
            userSelect: 'none',
          }}
          className="bg-[#d4c5b9] hover:bg-[#8b7355] opacity-0 hover:opacity-100 transition-opacity"
        />
      </div>
    </TableHeaderCell>
  )
}
import type { CrmDealOption } from '@/lib/queries/crm-deals'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { formatDimensions, formatNumber, formatPrice } from '@/lib/format'
import { categoryDisplay, truncate } from './catalog-utils'
import { cleanDescription } from '@/lib/zoho/parse'
import {
  readBoqState,
  writeBoqState,
  type Boq,
  type BoqCurrency,
  type BoqLine,
} from './boq-storage'
import {
  readRoomPlannerState,
  writeRoomPlannerState,
  assignItemToRoomState,
  removeItemFromRoomState,
  DEFAULT_ROOM_PLANNER_STATE,
  type RoomPlannerState,
} from './room-planner-storage'

function rawString(item: FurnitureItemRow, key: string): string {
  const value = item.raw[key]
  return typeof value === 'string' ? value : ''
}

function firstRawString(item: FurnitureItemRow, keys: string[]): string {
  for (const key of keys) {
    const value = rawString(item, key).trim()
    if (value) return value
  }
  return ''
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function filenameSafe(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function dealLabel(deal: CrmDealOption): string {
  const name = deal.deal_name ?? 'Untitled Deal'
  return deal.account_name ? `${name} - ${deal.account_name}` : name
}

function storedDealLabel(boq: Pick<Boq, 'dealName' | 'dealAccountName'>): string {
  const name = boq.dealName ?? 'Untitled Deal'
  return boq.dealAccountName ? `${name} - ${boq.dealAccountName}` : name
}

function itemPrice(item: FurnitureItemRow, currency: BoqCurrency): number | null {
  return currency === 'SAR' ? item.retail_price_sar : item.retail_price_aed
}

const COLS = 10

export function BoqWorkspace({
  items,
  deals,
}: {
  items: FurnitureItemRow[]
  deals: CrmDealOption[]
}) {
  const [boqs, setBoqs] = useState<Boq[]>([])
  const [activeBoqId, setActiveBoqId] = useState('')
  const [boqName, setBoqName] = useState('')
  const [selectedDealId, setSelectedDealId] = useState('')
  const [dealQuery, setDealQuery] = useState('')
  const [isDealMenuOpen, setIsDealMenuOpen] = useState(false)
  const [hasLoadedBoqs, setHasLoadedBoqs] = useState(false)
  const [roomPlanner, setRoomPlanner] = useState<RoomPlannerState>(
    DEFAULT_ROOM_PLANNER_STATE,
  )
  const [hasLoadedRoomPlanner, setHasLoadedRoomPlanner] = useState(false)
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const draggedBoqItemRef = useRef<string | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    sku: 90,
    name: 180,
    room: 120,
    category: 110,
    finishes: 130,
    dimensions: 100,
    unitPrice: 110,
    qty: 70,
    total: 110,
    action: 80,
  })
  const autoCreatedBoqRef = useRef(false)
  const resizeRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  )
  const dealById = useMemo(
    () => new Map(deals.map((deal) => [deal.id, deal])),
    [deals],
  )
  const activeBoq = boqs.find((boq) => boq.id === activeBoqId) ?? null
  const activeDeal =
    activeBoq?.dealId ? dealById.get(activeBoq.dealId) ?? null : null
  const activeCurrency = activeBoq?.currency ?? 'AED'

  useEffect(() => {
    if (!activeBoq) return
    setBoqName(activeBoq.name)
    setSelectedDealId(activeBoq.dealId ?? '')
    const selectedDeal = activeBoq.dealId
      ? dealById.get(activeBoq.dealId) ?? null
      : null
    setDealQuery(
      selectedDeal
        ? dealLabel(selectedDeal)
        : activeBoq.dealName
          ? storedDealLabel(activeBoq)
          : '',
    )
  }, [activeBoq])

  const filteredDeals = useMemo(() => {
    const query = dealQuery.trim().toLowerCase()
    const matches = query
      ? deals.filter((deal) =>
          [deal.deal_name, deal.account_name, deal.stage, deal.owner_name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : deals
    const topMatches = matches.slice(0, 75)
    if (activeDeal && !topMatches.some((deal) => deal.id === activeDeal.id)) {
      return [activeDeal, ...topMatches]
    }
    return topMatches
  }, [activeDeal, dealQuery, deals])

  const boqTotal = useMemo(() => {
    if (!activeBoq) return 0
    return activeBoq.lines.reduce((sum, line) => {
      const item = itemById.get(line.itemId)
      return sum + (item ? itemPrice(item, activeCurrency) ?? 0 : 0) * line.quantity
    }, 0)
  }, [activeBoq, activeCurrency, itemById])

  const itemLocationById = useMemo(() => {
    const map = new Map<
      string,
      { floorName: string; roomName: string; roomId: string }
    >()
    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        for (const itemId of room.itemIds) {
          map.set(itemId, {
            floorName: floor.name,
            roomName: room.name,
            roomId: room.id,
          })
        }
      }
    }
    return map
  }, [roomPlanner])

  const allRoomItemIds = useMemo(() => {
    const ids: string[] = []
    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        ids.push(...room.itemIds)
      }
    }
    return ids
  }, [roomPlanner])

  const groupedLines = useMemo(() => {
    if (!activeBoq) return null

    const lineByItemId = new Map(
      activeBoq.lines.map((line) => [line.itemId, line]),
    )
    const assignedItemIds = new Set<string>()

    const floors = roomPlanner.floors
      .map((floor) => {
        const rooms = floor.rooms
          .map((room) => {
            const lines = room.itemIds
              .filter((itemId) => lineByItemId.has(itemId))
              .map((itemId) => {
                assignedItemIds.add(itemId)
                return lineByItemId.get(itemId)!
              })
            return { roomId: room.id, roomName: room.name, lines }
          })
          .filter((room) => room.lines.length > 0)
        return { floorId: floor.id, floorName: floor.name, rooms }
      })
      .filter((floor) => floor.rooms.length > 0)

    const unassigned = activeBoq.lines.filter(
      (line) => !assignedItemIds.has(line.itemId),
    )

    return { floors, unassigned, hasRooms: floors.length > 0 }
  }, [activeBoq, roomPlanner])

  const hasAnyRooms = useMemo(
    () => roomPlanner.floors.some((f) => f.rooms.length > 0),
    [roomPlanner],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const state = readBoqState()
      setBoqs(state.boqs)
      setActiveBoqId(state.activeBoqId)
      setHasLoadedBoqs(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoomPlanner(readRoomPlannerState())
      setHasLoadedRoomPlanner(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!hasLoadedBoqs) return
    writeBoqState({ boqs, activeBoqId })
  }, [activeBoqId, boqs, hasLoadedBoqs])

  useEffect(() => {
    if (!hasLoadedRoomPlanner) return
    writeRoomPlannerState(roomPlanner)
  }, [hasLoadedRoomPlanner, roomPlanner])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const diff = e.clientX - resizeRef.current.startX
      const newWidth = Math.max(50, resizeRef.current.startWidth + diff)
      setColumnWidths((prev) => ({
        ...prev,
        [resizeRef.current!.column]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      resizeRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [columnWidths])

  // Auto-create a Draft BOQ from room items when the page loads with rooms but no BOQ
  useEffect(() => {
    if (!hasLoadedBoqs || !hasLoadedRoomPlanner) return
    if (autoCreatedBoqRef.current) return
    autoCreatedBoqRef.current = true

    if (boqs.length > 0) return
    if (allRoomItemIds.length === 0) return

    const id = crypto.randomUUID()
    const draft: Boq = {
      id,
      name: 'Draft BOQ',
      currency: 'AED',
      lines: [...new Set(allRoomItemIds)].map((itemId) => ({ itemId, quantity: 1 })),
    }
    setBoqs([draft])
    setActiveBoqId(id)
  }, [hasLoadedBoqs, hasLoadedRoomPlanner, boqs, allRoomItemIds])

  function saveBoq() {
    const name = boqName.trim()
    if (!name) return
    const selectedDeal = selectedDealId ? dealById.get(selectedDealId) ?? null : null
    const id = activeBoq?.id ?? crypto.randomUUID()
    const boq: Boq = {
      id,
      name,
      currency: activeBoq?.currency ?? 'AED',
      lines: activeBoq?.lines ?? [],
      dealId: selectedDeal?.id,
      dealName: selectedDeal?.deal_name ?? null,
      dealStage: selectedDeal?.stage ?? null,
      dealAccountName: selectedDeal?.account_name ?? null,
    }
    setBoqs([boq])
    setActiveBoqId(boq.id)
  }

  function handleDealInputChange(value: string) {
    setDealQuery(value)
    setIsDealMenuOpen(true)
    if (selectedDealId) {
      const selectedDeal = dealById.get(selectedDealId) ?? null
      const selectedLabel = selectedDeal
        ? dealLabel(selectedDeal)
        : storedDealLabel({
            dealName: activeBoq?.dealName ?? null,
            dealAccountName: activeBoq?.dealAccountName ?? null,
          })
      if (value !== selectedLabel) setSelectedDealId('')
    }
  }

  function selectDeal(deal: CrmDealOption) {
    setSelectedDealId(deal.id)
    setDealQuery(dealLabel(deal))
    setIsDealMenuOpen(false)
  }

  function updateLineQuantity(itemId: string, quantity: number) {
    if (!activeBoqId) return
    const nextQuantity = Math.max(1, Math.floor(quantity || 1))
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? {
              ...boq,
              lines: boq.lines.map((line) =>
                line.itemId === itemId ? { ...line, quantity: nextQuantity } : line,
              ),
            }
          : boq,
      ),
    )
  }

  function removeLine(itemId: string) {
    if (!activeBoqId) return
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? { ...boq, lines: boq.lines.filter((line) => line.itemId !== itemId) }
          : boq,
      ),
    )
  }

  function duplicateLine(itemId: string) {
    if (!activeBoqId) return
    const existingLine = activeBoq?.lines.find((line) => line.itemId === itemId)
    if (!existingLine) return

    const newItemId = `${itemId}-dup-${Date.now()}`
    const newLine = { itemId: newItemId, quantity: existingLine.quantity }

    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? { ...boq, lines: [...boq.lines, newLine] }
          : boq,
      ),
    )

    // Auto-assign to active room if one exists
    if (roomPlanner.activeRoomId) {
      setRoomPlanner((current) =>
        assignItemToRoomState(current, newItemId, roomPlanner.activeRoomId),
      )
    }
  }

  function assignItemToRoom(itemId: string, roomId: string) {
    setRoomPlanner((current) => assignItemToRoomState(current, itemId, roomId))
  }

  // Drag-and-drop handlers shared by a room's header bar AND every item row in
  // that room, so the whole room block is a drop target — not just the thin
  // header strip. preventDefault on dragOver is what makes an element droppable.
  function roomDropHandlers(roomId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!draggedBoqItemRef.current) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragOverRoomId !== roomId) setDragOverRoomId(roomId)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const itemId =
          draggedBoqItemRef.current ||
          e.dataTransfer.getData('application/x-kidzink-item-id') ||
          e.dataTransfer.getData('text/plain')
        if (itemId) {
          setRoomPlanner((current) =>
            assignItemToRoomState(current, itemId, roomId),
          )
        }
        draggedBoqItemRef.current = null
        setDragOverRoomId(null)
        setDraggingItemId(null)
      },
    }
  }

  function removeItemFromRoom(itemId: string) {
    setRoomPlanner((current) => removeItemFromRoomState(current, itemId))
  }

  function importRoomItems() {
    if (!activeBoqId) return
    const existingIds = new Set(activeBoq?.lines.map((l) => l.itemId) ?? [])
    const toAdd = allRoomItemIds.filter((id) => !existingIds.has(id))
    if (toAdd.length === 0) return
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? {
              ...boq,
              lines: [
                ...boq.lines,
                ...toAdd.map((itemId) => ({ itemId, quantity: 1 })),
              ],
            }
          : boq,
      ),
    )
  }

  function lineTotal(line: BoqLine): number {
    const item = itemById.get(line.itemId)
    return (item ? (itemPrice(item, activeCurrency) ?? 0) : 0) * line.quantity
  }

  function renderRoomSelector(itemId: string, location: ReturnType<typeof itemLocationById.get>) {
    if (!hasAnyRooms) {
      return <span className="text-xs text-tremor-content-subtle">No rooms set up</span>
    }
    return (
      <select
        value={location?.roomId ?? ''}
        onChange={(event) => {
          const roomId = event.target.value
          if (roomId) {
            assignItemToRoom(itemId, roomId)
          } else {
            removeItemFromRoom(itemId)
          }
        }}
        className="w-full rounded-full border border-[rgba(109,91,81,0.18)] bg-white/75 px-2 py-1 text-xs text-tremor-content-strong focus:outline-none"
      >
        <option value="">— unassigned —</option>
        {roomPlanner.floors.map((floor) =>
          floor.rooms.length > 0 ? (
            <optgroup key={floor.id} label={floor.name}>
              {floor.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
    )
  }

  function renderItemRow(line: BoqLine, index: number, dropRoomId?: string) {
    const item = itemById.get(line.itemId)
    if (!item) return null
    const price = itemPrice(item, activeCurrency)
    const location = itemLocationById.get(line.itemId)
    const isDropTargetRoom = dropRoomId != null && dragOverRoomId === dropRoomId
    const rowTone =
      index % 2 === 0
        ? 'bg-[rgba(247,241,234,0.96)]'
        : 'bg-[rgba(239,231,220,0.96)]'
    // Every row in a room is also a drop target for that room, so dropping
    // anywhere inside the room block (not just the header) moves the item.
    const dropProps = dropRoomId != null ? roomDropHandlers(dropRoomId) : {}
    return (
      <TableRow
        key={line.itemId}
        className={`group transition-colors duration-200 cursor-grab ${draggingItemId === line.itemId ? 'opacity-40' : ''} ${isDropTargetRoom ? 'ring-2 ring-[rgba(228,60,47,0.45)]' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', line.itemId)
          e.dataTransfer.setData('application/x-kidzink-item-id', line.itemId)
          draggedBoqItemRef.current = line.itemId
          setDraggingItemId(line.itemId)
        }}
        onDragEnd={() => {
          draggedBoqItemRef.current = null
          setDraggingItemId(null)
          setDragOverRoomId(null)
        }}
        {...dropProps}
      >
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content font-mono text-xs ${rowTone} px-4 py-4 border-r border-[rgba(212,197,185,0.4)]`} style={{ width: `${columnWidths.sku}px`, minWidth: `${columnWidths.sku}px` }}>
          {item.sku_id ?? '—'}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content ${rowTone} px-4 py-4 border-r border-[rgba(212,197,185,0.4)]`} style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}>
          <div className="space-y-0.5">
            <div className="font-medium leading-snug text-tremor-content-strong">
              {item.furniture_item_name ||
                categoryDisplay(item.category, item.subcategory)}
            </div>
            {item.description ? (
              <div className="text-xs leading-snug text-tremor-content">
                {truncate(cleanDescription(item.description), 90)}
              </div>
            ) : null}
          </div>
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.room}px`, minWidth: `${columnWidths.room}px` }}>
          {renderRoomSelector(line.itemId, location)}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.category}px`, minWidth: `${columnWidths.category}px` }}>
          <div className="text-sm">{categoryDisplay(item.category, item.subcategory)}</div>
          {item.furniture_type ? (
            <div className="text-xs text-tremor-content">{item.furniture_type}</div>
          ) : null}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-xs ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.finishes}px`, minWidth: `${columnWidths.finishes}px` }}>
          {truncate(item.finishes_summary, 80) || '—'}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content tabular-nums text-xs ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.dimensions}px`, minWidth: `${columnWidths.dimensions}px` }}>
          {formatDimensions(item.length_mm, item.height_mm, item.depth_mm)}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right tabular-nums ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.unitPrice}px`, minWidth: `${columnWidths.unitPrice}px` }}>
          {formatPrice(price, activeCurrency)}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.qty}px`, minWidth: `${columnWidths.qty}px` }}>
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(event) =>
              updateLineQuantity(line.itemId, Number(event.target.value))
            }
            className="w-16 rounded-full border border-[rgba(109,91,81,0.18)] bg-white/75 px-2 py-1 text-right text-sm text-tremor-content-strong"
            aria-label={`Quantity for ${item.sku_id ?? 'item'}`}
          />
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right tabular-nums ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.total}px`, minWidth: `${columnWidths.total}px` }}>
          {formatPrice((price ?? 0) * line.quantity, activeCurrency)}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.action}px`, minWidth: `${columnWidths.action}px` }}>
          <button
            type="button"
            onClick={() => duplicateLine(line.itemId)}
            className="text-sm font-medium text-tremor-content-strong hover:text-[#e43c2f] transition-colors"
          >
            {roomPlanner.activeRoomId ? 'Duplicate to Room' : 'Duplicate'}
          </button>
        </TableCell>
      </TableRow>
    )
  }

  function exportActiveBoq() {
    if (!activeBoq || activeBoq.lines.length === 0) return

    const headers = [
      'SR. NO',
      'FLOOR',
      'ROOM',
      'ITEM NAME',
      'SKU ID',
      'COLOUR/FINISH',
      'DIMENSIONS',
      'Quantity',
      `Unit Price ${activeCurrency}`,
      `Total ${activeCurrency}`,
      'REQUESTOR',
    ]

    let srNo = 0
    const rows = activeBoq.lines.flatMap((line) => {
      const item = itemById.get(line.itemId)
      if (!item) return []
      srNo++
      const location = itemLocationById.get(line.itemId)
      const floorName =
        location?.floorName ??
        firstRawString(item, ['Floor_Name', 'FloorName', 'Floor'])
      const roomName =
        location?.roomName ??
        firstRawString(item, ['Room_Name', 'RoomName', 'Room Name'])
      const requestor = [item.first_name, item.last_name]
        .filter(Boolean)
        .join(' ') || ''
      return [
        [
          srNo,
          floorName,
          roomName,
          item.furniture_item_name ?? '',
          item.sku_id ?? '',
          firstRawString(item, [
            'Colour_Finish',
            'Color_Finish',
            'ColourFinish',
            'Colour / Finish',
            'Color/Finish',
          ]) || (item.finishes_summary ?? ''),
          [item.length_mm, item.depth_mm, item.height_mm]
            .filter(Boolean)
            .map((v) => `${v}`)
            .join('×') || '',
          line.quantity,
          itemPrice(item, activeCurrency) ?? 0,
          (itemPrice(item, activeCurrency) ?? 0) * line.quantity,
          requestor,
        ],
      ]
    })

    const columnCount = headers.length
    const blankRow: Array<string | number> = Array.from(
      { length: columnCount },
      () => '',
    )
    const titleRow = [...blankRow]
    titleRow[0] = `BOQ: ${activeBoq.name}`
    titleRow[8] = `Overall Total: ${boqTotal}`
    const dealRow = [...blankRow]
    dealRow[0] = `Deal: ${activeBoq.dealName ?? activeDeal?.deal_name ?? ''}`
    dealRow[1] = activeBoq.dealAccountName ?? activeDeal?.account_name ?? ''
    dealRow[2] = activeBoq.dealStage ?? activeDeal?.stage ?? ''
    dealRow[3] = `School Group: ${activeDeal?.school_group ?? ''}`
    dealRow[4] = `School: ${activeDeal?.school_name ?? ''}`
    const currencyRow = [...blankRow]
    currencyRow[0] = `Currency: ${activeCurrency}`
    const worksheetRows: Array<Array<string | number>> = [
      titleRow,
      dealRow,
      currencyRow,
      blankRow,
      headers,
      ...rows,
    ]

    const xmlRows = worksheetRows
      .map((row) => {
        const cells = row
          .map((cell) => {
            if (typeof cell === 'number') {
              return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
            }
            return `<Cell><Data ss:Type="String">${xmlEscape(String(cell))}</Data></Cell>`
          })
          .join('')
        return `<Row>${cells}</Row>`
      })
      .join('')
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="BOQ">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`

    const blob = new Blob([workbook], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filenameSafe(activeBoq.name) || 'boq'}.xls`
    document.body.append(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <section className="dashboard-panel flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-[20rem] flex-[3_1_28rem]">
          <TextInput
            className="w-full"
            value={dealQuery}
            onChange={(event) => handleDealInputChange(event.target.value)}
            onValueChange={handleDealInputChange}
            onFocus={() => setIsDealMenuOpen(true)}
            onBlur={() => window.setTimeout(() => setIsDealMenuOpen(false), 150)}
            placeholder="Select deal..."
            aria-label="Select CRM deal"
          />
          {isDealMenuOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[18px] border border-[rgba(109,91,81,0.18)] bg-white/95 shadow-[0_18px_36px_rgba(46,45,44,0.12)]">
              <div className="max-h-72 overflow-auto py-1">
                {filteredDeals.length > 0 ? (
                  filteredDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectDeal(deal)}
                      className="block w-full px-4 py-3 text-left text-sm text-tremor-content-strong transition-colors hover:bg-[rgba(228,60,47,0.08)]"
                    >
                      <div className="font-medium">{dealLabel(deal)}</div>
                      <div className="mt-0.5 text-xs text-tremor-content">
                        {deal.stage ?? 'No stage'}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-tremor-content">
                    No deals match.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-w-[18rem] flex-[2_1_22rem]">
          <TextInput
            className="w-full"
            value={boqName}
            onChange={(event) => setBoqName(event.target.value)}
            onValueChange={setBoqName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveBoq()
            }}
            placeholder="Type BOQ name..."
            aria-label="BOQ name"
          />
        </div>
        <button
          type="button"
          onClick={saveBoq}
          disabled={!boqName.trim() || !selectedDealId}
          className="rounded-full bg-[#e43c2f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c93226] disabled:cursor-not-allowed disabled:bg-[#f0e6dd] disabled:text-tremor-content-subtle"
        >
          Save BOQ
        </button>
      </section>

      {activeBoq ? (
        <section>
          <div className="dashboard-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-tremor-content-strong">
                {activeBoq.name}
              </span>
              <span className="text-tremor-content">
                {formatNumber(activeBoq.lines.length)} items
              </span>
              <span className="font-medium text-tremor-content-strong">
                Overall total: {formatPrice(boqTotal, activeCurrency)}
              </span>
              {activeDeal && (
                <>
                  <span className="text-tremor-content">{dealLabel(activeDeal)}</span>
                  <span className="text-tremor-content">
                    {activeDeal.school_group || activeDeal.school_name ? (
                      <>
                        {activeDeal.school_group && <span>{activeDeal.school_group}</span>}
                        {activeDeal.school_name && <span className="ml-2">({activeDeal.school_name})</span>}
                      </>
                    ) : (
                      'School info not available'
                    )}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={activeCurrency}
                onValueChange={(value) =>
                  setBoqs((current) =>
                    current.map((boq) =>
                      boq.id === activeBoq.id
                        ? { ...boq, currency: value as BoqCurrency }
                        : boq,
                    ),
                  )
                }
                aria-label="BOQ currency"
              >
                <SelectItem value="AED">AED</SelectItem>
                <SelectItem value="SAR">SAR</SelectItem>
              </Select>
              {allRoomItemIds.some(
                (id) => !activeBoq.lines.some((l) => l.itemId === id),
              ) ? (
                <button
                  type="button"
                  onClick={importRoomItems}
                  className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.22)] bg-white/60 px-3 py-1.5 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
                >
                  Add room items to BOQ
                </button>
              ) : null}
              <button
                type="button"
                onClick={exportActiveBoq}
                disabled={activeBoq.lines.length === 0}
                className="whitespace-nowrap rounded-full border border-[rgba(109,91,81,0.18)] bg-white/60 px-3 py-1.5 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export Excel
              </button>
            </div>
          </div>

          {activeBoq.lines.length === 0 ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-[rgba(109,91,81,0.2)] bg-white/45 py-12 text-center">
              <Text className="text-tremor-content-subtle">
                Drag items into rooms in the Catalog — they will appear here automatically.
              </Text>
            </div>
          ) : (
            <div className="dashboard-table-shell mt-4 overflow-x-auto">
              <Table className="w-full border-separate border-spacing-y-2 text-sm" style={{ minWidth: 'min-content', borderSpacing: '0' }}>
                <TableHead>
                  <TableRow style={{ backgroundColor: '#e8ddd3' }}>
                    <ResizableHeaderCell columnKey="sku" width={columnWidths.sku} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      SKU ID
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="name" width={columnWidths.name} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Item Name
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="room" width={columnWidths.room} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Room
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="category" width={columnWidths.category} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Category
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="finishes" width={columnWidths.finishes} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Finishes
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="dimensions" width={columnWidths.dimensions} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Dimensions
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="unitPrice" width={columnWidths.unitPrice} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Unit Price {activeCurrency}</span>
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="qty" width={columnWidths.qty} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Qty</span>
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="total" width={columnWidths.total} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Total {activeCurrency}</span>
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="action" width={columnWidths.action} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Action</span>
                    </ResizableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedLines?.hasRooms ? (
                    <>
                      {groupedLines.floors.map((floor) => {
                        const floorTotal = floor.rooms.reduce(
                          (sum, room) =>
                            sum + room.lines.reduce((s, l) => s + lineTotal(l), 0),
                          0,
                        )
                        const floorItemCount = floor.rooms.reduce(
                          (n, room) => n + room.lines.length,
                          0,
                        )
                        return (
                          <Fragment key={floor.floorId}>
                            <TableRow>
                              <TableCell
                                colSpan={COLS}
                                className="rounded-[22px] bg-[rgba(46,45,44,0.08)] px-5 py-3 text-sm font-semibold text-tremor-content-strong"
                              >
                                {floor.floorName}
                                <span className="ml-3 text-xs font-normal text-tremor-content">
                                  {floorItemCount} item{floorItemCount !== 1 ? 's' : ''}{' '}
                                  &middot; {formatPrice(floorTotal, activeCurrency)}
                                </span>
                              </TableCell>
                            </TableRow>
                            {floor.rooms.map((room) => {
                              const roomTotal = room.lines.reduce(
                                (s, l) => s + lineTotal(l),
                                0,
                              )
                              return (
                                <Fragment key={room.roomId}>
                                  <TableRow>
                                    <TableCell
                                      colSpan={COLS}
                                      className={`rounded-[18px] px-5 py-2 text-sm font-medium text-tremor-content-strong transition-colors ${
                                        dragOverRoomId === room.roomId
                                          ? 'bg-[rgba(228,60,47,0.25)] ring-2 ring-[rgba(228,60,47,0.5)]'
                                          : draggingItemId
                                            ? 'bg-[rgba(228,60,47,0.07)] ring-2 ring-dashed ring-[rgba(228,60,47,0.3)]'
                                            : 'bg-[rgba(228,60,47,0.07)]'
                                      }`}
                                      {...roomDropHandlers(room.roomId)}
                                    >
                                      <span className="ml-3">{room.roomName}</span>
                                      <span className="ml-3 text-xs font-normal text-tremor-content">
                                        {room.lines.length} item{room.lines.length !== 1 ? 's' : ''}{' '}
                                        &middot; {formatPrice(roomTotal, activeCurrency)}
                                      </span>
                                      {dragOverRoomId === room.roomId && (
                                        <span className="ml-3 text-xs font-normal text-[#e43c2f]">
                                          ↓ Drop here to move
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {room.lines.map((line, index) =>
                                    renderItemRow(line, index, room.roomId),
                                  )}
                                </Fragment>
                              )
                            })}
                          </Fragment>
                        )
                      })}
                      {groupedLines.unassigned.length > 0 ? (
                        <Fragment>
                          <TableRow>
                            <TableCell
                              colSpan={COLS}
                              className="rounded-[22px] bg-[rgba(109,91,81,0.06)] px-5 py-3 text-sm font-semibold text-tremor-content"
                            >
                              Unassigned
                              <span className="ml-3 text-xs font-normal text-tremor-content-subtle">
                                {groupedLines.unassigned.length} item
                                {groupedLines.unassigned.length !== 1 ? 's' : ''} not placed in any room
                              </span>
                            </TableCell>
                          </TableRow>
                          {groupedLines.unassigned.map((line, index) =>
                            renderItemRow(line, index),
                          )}
                        </Fragment>
                      ) : null}
                    </>
                  ) : (
                    activeBoq.lines.map((line, index) =>
                      renderItemRow(line, index, undefined),
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[rgba(109,91,81,0.2)] bg-white/45 py-12 text-center">
          <Text className="text-tremor-content-subtle">
            Go to Catalog, drag items into rooms — they will appear here organised by floor and room.
          </Text>
        </div>
      )}
    </div>
  )
}
