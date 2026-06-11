'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Text,
  TextInput,
} from '@tremor/react'
import { jsPDF } from 'jspdf'
import { ConfirmationModal } from './confirmation-modal'
import { ResizableHeaderCell } from './resizable-header-cell'
import type { CrmDealOption } from '@/lib/queries/crm-deals'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { formatDimensions, formatNumber, formatPrice } from '@/lib/format'
import {
  ALL_VALUE,
  ITEM_TYPE_OPTIONS,
  categoryDisplay,
  displayValues,
  itemTypeValue,
  normalizeSearch,
  searchTokens,
  searchableText,
  truncate,
  unique,
} from './catalog-utils'
import { cleanDescription } from '@/lib/zoho/parse'
import {
  readBoqState,
  writeBoqState,
  type Boq,
  type BoqCurrency,
  type BoqLine,
} from './boq-storage'
import {
  writeRoomPlannerState,
  assignItemToRoomState,
  removeItemFromRoomState,
  cloneRoomToState,
  removeRoomFromState,
  removeFloorFromState,
  renameRoomInState,
  moveRoomToFloor,
  addFloorToState,
  type RoomPlannerState,
} from './room-planner-storage'
import { useRoomPlanner } from './use-room-planner'

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

const COLS = 12

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
  const { roomPlanner, setRoomPlanner, hasLoaded: hasLoadedRoomPlanner } = useRoomPlanner()
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
    discount: 90,
    total: 120,
    comment: 160,
    action: 80,
  })
  const autoCreatedBoqRef = useRef(false)
  const resizeRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)
  const [confirmationState, setConfirmationState] = useState<{ type: 'floor' | 'room'; id: string; name: string } | null>(null)
  const [boqQuery, setBoqQuery] = useState('')
  const [boqCategory, setBoqCategory] = useState(ALL_VALUE)
  const [boqSubcategory, setBoqSubcategory] = useState(ALL_VALUE)
  const [boqItemType, setBoqItemType] = useState(ALL_VALUE)
  const [boqAgeRange, setBoqAgeRange] = useState(ALL_VALUE)
  const [boqSuitableSpace, setBoqSuitableSpace] = useState(ALL_VALUE)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [bulkDiscountInput, setBulkDiscountInput] = useState('')

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

  const boqItems = useMemo(() => {
    if (!activeBoq) return []
    return activeBoq.lines.flatMap((l) => {
      const item = itemById.get(l.itemId)
      return item ? [item] : []
    })
  }, [activeBoq, itemById])

  const boqCategories = useMemo(() => unique(boqItems.map((i) => i.category)), [boqItems])
  const boqSubcategories = useMemo(
    () => unique(boqItems.filter((i) => boqCategory === ALL_VALUE || i.category === boqCategory).map((i) => i.subcategory)),
    [boqItems, boqCategory],
  )
  const boqAgeRanges = useMemo(() => unique(boqItems.map((i) => i.age_range)), [boqItems])
  const boqSuitableSpaces = useMemo(
    () => unique(boqItems.flatMap((i) => displayValues(i.suitable_spaces))),
    [boqItems],
  )

  const hasActiveBoqFilters =
    boqQuery.trim() ||
    boqCategory !== ALL_VALUE ||
    boqSubcategory !== ALL_VALUE ||
    boqItemType !== ALL_VALUE ||
    boqAgeRange !== ALL_VALUE ||
    boqSuitableSpace !== ALL_VALUE

  const filteredGroupedLines = useMemo(() => {
    if (!groupedLines) return null
    if (!hasActiveBoqFilters) return groupedLines

    const tokens = searchTokens(boqQuery)

    function matches(line: { itemId: string }): boolean {
      const item = itemById.get(line.itemId)
      if (!item) return false
      if (boqCategory !== ALL_VALUE && item.category !== boqCategory) return false
      if (boqSubcategory !== ALL_VALUE && item.subcategory !== boqSubcategory) return false
      if (boqItemType !== ALL_VALUE && itemTypeValue(item) !== boqItemType) return false
      if (boqAgeRange !== ALL_VALUE && item.age_range !== boqAgeRange) return false
      if (boqSuitableSpace !== ALL_VALUE && !displayValues(item.suitable_spaces).includes(boqSuitableSpace)) return false
      if (tokens.length > 0) {
        const text = normalizeSearch(searchableText(item))
        if (!tokens.every((t) => text.includes(t))) return false
      }
      return true
    }

    const floors = groupedLines.floors
      .map((floor) => ({
        ...floor,
        rooms: floor.rooms
          .map((room) => ({ ...room, lines: room.lines.filter(matches) }))
          .filter((room) => room.lines.length > 0),
      }))
      .filter((floor) => floor.rooms.length > 0)

    return {
      floors,
      unassigned: groupedLines.unassigned.filter(matches),
      hasRooms: floors.length > 0,
    }
  }, [groupedLines, hasActiveBoqFilters, boqQuery, boqCategory, boqSubcategory, boqItemType, boqAgeRange, boqSuitableSpace, itemById])

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

  function updateLineDiscount(itemId: string, discount: number) {
    if (!activeBoqId) return
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? {
              ...boq,
              lines: boq.lines.map((line) =>
                line.itemId === itemId ? { ...line, discount } : line,
              ),
            }
          : boq,
      ),
    )
  }

  function applyBulkDiscount() {
    const pct = parseFloat(bulkDiscountInput)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    const ids = new Set([
      ...(filteredGroupedLines?.floors.flatMap((f) => f.rooms.flatMap((r) => r.lines.map((l) => l.itemId))) ?? []),
      ...(filteredGroupedLines?.unassigned.map((l) => l.itemId) ?? []),
    ])
    if (ids.size === 0) return
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? {
              ...boq,
              lines: boq.lines.map((line) =>
                ids.has(line.itemId) ? { ...line, discount: pct } : line,
              ),
            }
          : boq,
      ),
    )
    setIsBulkEditOpen(false)
    setBulkDiscountInput('')
  }

  function updateLineComment(itemId: string, comment: string) {
    if (!activeBoqId) return
    setBoqs((current) =>
      current.map((boq) =>
        boq.id === activeBoqId
          ? {
              ...boq,
              lines: boq.lines.map((line) =>
                line.itemId === itemId ? { ...line, comment } : line,
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

  function cloneRoom(roomId: string) {
    setRoomPlanner((current) => cloneRoomToState(current, roomId))
  }

  function removeRoom(roomId: string) {
    const room = roomPlanner.floors
      .flatMap((f) => f.rooms)
      .find((r) => r.id === roomId)
    if (!room) return
    setConfirmationState({ type: 'room', id: roomId, name: room.name })
  }

  function confirmRemoveRoom() {
    if (!confirmationState || confirmationState.type !== 'room') return
    setRoomPlanner((current) => {
      const next = removeRoomFromState(current, confirmationState.id)
      writeRoomPlannerState(next)
      return next
    })
    setConfirmationState(null)
  }

  function cloneFloor(floorId: string) {
    setRoomPlanner((current) => {
      const sourceFloor = current.floors.find((f) => f.id === floorId)
      if (!sourceFloor) return current

      const newFloorId = crypto.randomUUID()
      const newRooms = sourceFloor.rooms.map((room) => ({
        id: crypto.randomUUID(),
        name: `${room.name} (copy)`,
        itemIds: [...room.itemIds],
      }))

      const newFloor = {
        id: newFloorId,
        name: `${sourceFloor.name} (copy)`,
        rooms: newRooms,
      }

      return {
        ...current,
        floors: [...current.floors, newFloor],
        activeFloorId: newFloorId,
      }
    })
  }

  function removeFloor(floorId: string) {
    const floor = roomPlanner.floors.find((f) => f.id === floorId)
    if (!floor) return
    setConfirmationState({ type: 'floor', id: floorId, name: floor.name })
  }

  function confirmRemoveFloor() {
    if (!confirmationState || confirmationState.type !== 'floor') return
    setRoomPlanner((current) => {
      const next = removeFloorFromState(current, confirmationState.id)
      writeRoomPlannerState(next)
      return next
    })
    setConfirmationState(null)
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
    const base = (item ? (itemPrice(item, activeCurrency) ?? 0) : 0) * line.quantity
    return base * (1 - (line.discount ?? 0) / 100)
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
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.discount}px`, minWidth: `${columnWidths.discount}px` }}>
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={line.discount ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Math.min(100, Math.max(0, Number(e.target.value)))
                updateLineDiscount(line.itemId, v)
              }}
              placeholder="0"
              className="w-14 rounded-full border border-[rgba(109,91,81,0.18)] bg-white/75 px-2 py-1 text-right text-sm text-tremor-content-strong"
              aria-label={`Discount for ${item.sku_id ?? 'item'}`}
            />
            <span className="text-xs text-tremor-content-subtle">%</span>
          </div>
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content text-right tabular-nums ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.total}px`, minWidth: `${columnWidths.total}px` }}>
          {(line.discount ?? 0) > 0 ? (
            <div className="space-y-0.5">
              <div className="text-xs text-tremor-content-subtle line-through">{formatPrice((price ?? 0) * line.quantity, activeCurrency)}</div>
              <div className="font-medium text-[#2a9d5c]">{formatPrice(lineTotal(line), activeCurrency)}</div>
            </div>
          ) : (
            formatPrice(lineTotal(line), activeCurrency)
          )}
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content ${rowTone} px-2 py-2`} style={{ width: `${columnWidths.comment}px`, minWidth: `${columnWidths.comment}px` }}>
          <textarea
            value={line.comment ?? ''}
            onChange={(e) => updateLineComment(line.itemId, e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full resize-none rounded-[14px] border border-[rgba(109,91,81,0.18)] bg-white/75 px-2.5 py-1.5 text-xs text-tremor-content-strong placeholder:text-tremor-content-subtle focus:outline-none focus:ring-1 focus:ring-[rgba(228,60,47,0.35)]"
          />
        </TableCell>
        <TableCell className={`!whitespace-normal break-words align-top text-tremor-content ${rowTone} px-4 py-4`} style={{ width: `${columnWidths.action}px`, minWidth: `${columnWidths.action}px` }}>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => duplicateLine(line.itemId)}
              className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-white/50 hover:text-tremor-content-strong"
              title="Clone item"
              aria-label="Clone item"
            >
              <span className="text-xs font-bold">⊕</span>
            </button>
            <button
              type="button"
              onClick={() => removeLine(line.itemId)}
              className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-red-50 hover:text-red-500"
              title="Remove item"
              aria-label="Remove item"
            >
              <span className="text-xs">✕</span>
            </button>
          </div>
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
    const worksheetRows: Array<Array<string | number>> = [
      titleRow,
      dealRow,
      blankRow,
      headers,
      ...rows,
    ]

    // Generate CSV content
    const csvContent = worksheetRows
      .map((row) => {
        return row
          .map((cell) => {
            const value = String(cell)
            // Escape quotes and wrap in quotes if contains comma, newline, or quotes
            const needsQuotes = value.includes(',') || value.includes('\n') || value.includes('"')
            const escaped = value.replace(/"/g, '""')
            return needsQuotes ? `"${escaped}"` : escaped
          })
          .join(',')
      })
      .join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filenameSafe(activeBoq.name) || 'boq'}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  async function exportBoqPdf() {
    if (!activeBoq || activeBoq.lines.length === 0) return

    // Build row data
    let srNo = 0
    const rowData: Array<{
      srNo: number
      areaName: string
      refCode: string
      colorFinish: string
      description: string
      dimension: string
      imageUrl: string | null
      qty: number
      unitPrice: number
      totalPrice: number
    }> = []

    for (const line of activeBoq.lines) {
      const item = itemById.get(line.itemId)
      if (!item) continue
      srNo++
      const location = itemLocationById.get(line.itemId)
      const areaName = location
        ? `${location.floorName} / ${location.roomName}`
        : firstRawString(item, ['Floor_Name', 'FloorName', 'Floor'])
      const colorFinish =
        firstRawString(item, ['Colour_Finish', 'Color_Finish', 'ColourFinish', 'Colour / Finish', 'Color/Finish']) ||
        (item.finishes_summary ?? '')
      const price = itemPrice(item, activeCurrency) ?? 0

      let imageUrl: string | null = null
      if (item.old_code) {
        imageUrl = `/product-images/${encodeURIComponent(item.old_code)}.png`
      } else if (item.image_urls?.length) {
        imageUrl = item.image_urls[0]
      } else if (item.image_url) {
        imageUrl = item.image_url
      } else {
        const singleImage = typeof item.raw['Image'] === 'string' && item.raw['Image'].trim() ? item.raw['Image'] : null
        if (singleImage) {
          imageUrl = `/api/zoho-image?path=${encodeURIComponent(singleImage)}`
        } else if (Array.isArray(item.raw['Image1']) && (item.raw['Image1'] as unknown[]).length > 0) {
          const first = (item.raw['Image1'] as unknown[])[0]
          if (typeof first === 'string' && first.trim()) {
            imageUrl = `/api/zoho-image?path=${encodeURIComponent(first)}`
          }
        }
      }

      rowData.push({
        srNo,
        areaName,
        refCode: item.sku_id ?? '',
        colorFinish,
        description: item.furniture_item_name || categoryDisplay(item.category, item.subcategory),
        dimension: formatDimensions(item.length_mm, item.height_mm, item.depth_mm),
        imageUrl,
        qty: line.quantity,
        unitPrice: price,
        totalPrice: price * line.quantity,
      })
    }

    // Load images concurrently
    const imageCache = new Map<string, string>()
    await Promise.allSettled(
      [...new Set(rowData.map((r) => r.imageUrl).filter(Boolean))].map(async (url) => {
        try {
          const res = await fetch(url!)
          if (!res.ok) return
          const blob = await res.blob()
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          imageCache.set(url!, b64)
        } catch { /* skip */ }
      }),
    )

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const PW = pdf.internal.pageSize.getWidth()   // 297
    const PH = pdf.internal.pageSize.getHeight()  // 210
    const MX = 10
    const MY = 10
    const TW = PW - MX * 2  // 277

    const HDR_H = 14
    const ROW_H = 35

    // Columns — widths sum to 277
    const COLS = [
      { label: 'SR. NO',                       w: 12, align: 'center' as const },
      { label: 'AREA NAME',                    w: 28, align: 'left'   as const },
      { label: 'REF CODE',                     w: 22, align: 'left'   as const },
      { label: 'COLOR/FINISH',                 w: 28, align: 'left'   as const },
      { label: 'DESCRIPTION',                  w: 57, align: 'left'   as const },
      { label: 'DIMENSION',                    w: 22, align: 'center' as const },
      { label: 'IMAGE\n(FOR REFERENCE)',        w: 35, align: 'center' as const },
      { label: 'QTY',                          w: 12, align: 'center' as const },
      { label: `UNIT PRICE\n(${activeCurrency})`,  w: 30, align: 'right' as const },
      { label: `TOTAL PRICE\n(${activeCurrency})`, w: 31, align: 'right' as const },
    ]

    function colX(i: number) {
      return MX + COLS.slice(0, i).reduce((s, c) => s + c.w, 0)
    }

    let y = MY

    // Branding strip
    pdf.setFillColor(228, 60, 47)
    pdf.rect(0, 0, PW, 18, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(15)
    pdf.setFont('helvetica', 'bold')
    pdf.text('KIDZINK', MX, 12)
    const projectLabel = activeDeal?.deal_name ?? activeBoq.dealName
    if (projectLabel) {
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(projectLabel.toUpperCase(), PW - MX, 12, { align: 'right' })
    }

    y = 24
    pdf.setTextColor(30, 30, 30)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text(activeBoq.name, MX, y)
    y += 5

    if (activeDeal) {
      const meta = [activeDeal.account_name, activeDeal.stage, activeDeal.school_group].filter(Boolean).join('  ·  ')
      if (meta) {
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(90, 90, 90)
        pdf.text(meta, MX, y)
        y += 5
      }
    }
    y += 2

    function drawHeader() {
      pdf.setFillColor(228, 60, 47)
      pdf.rect(MX, y, TW, HDR_H, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')

      for (let i = 0; i < COLS.length; i++) {
        const col = COLS[i]
        const cx = colX(i)
        const lines = col.label.split('\n')
        const lh = 3
        const totalH = lines.length * lh
        let ty = y + (HDR_H - totalH) / 2 + lh
        for (const line of lines) {
          const tx = col.align === 'right' ? cx + col.w - 2 : col.align === 'center' ? cx + col.w / 2 : cx + 2
          pdf.text(line, tx, ty, { align: col.align })
          ty += lh
        }
        // Column dividers
        if (i < COLS.length - 1) {
          pdf.setDrawColor(255, 100, 90)
          pdf.setLineWidth(0.2)
          pdf.line(cx + col.w, y, cx + col.w, y + HDR_H)
        }
      }
    }

    function drawRow(row: typeof rowData[0], idx: number) {
      const even = idx % 2 === 0
      pdf.setFillColor(even ? 255 : 250, even ? 255 : 245, even ? 255 : 239)
      pdf.rect(MX, y, TW, ROW_H, 'F')

      pdf.setDrawColor(215, 203, 190)
      pdf.setLineWidth(0.15)
      // Bottom border
      pdf.line(MX, y + ROW_H, MX + TW, y + ROW_H)
      // Outer left + right
      pdf.line(MX, y, MX, y + ROW_H)
      pdf.line(MX + TW, y, MX + TW, y + ROW_H)
      // Column dividers
      for (let i = 0; i < COLS.length - 1; i++) {
        const vx = colX(i + 1)
        pdf.line(vx, y, vx, y + ROW_H)
      }

      pdf.setTextColor(30, 30, 30)
      const pad = 2
      const midY = y + ROW_H / 2

      // SR. NO
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text(String(row.srNo), colX(0) + COLS[0].w / 2, midY, { align: 'center', baseline: 'middle' })

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)

      // AREA NAME
      const areaLines = pdf.splitTextToSize(row.areaName, COLS[1].w - pad * 2)
      pdf.text((areaLines as string[]).slice(0, 6), colX(1) + pad, y + pad + 3)

      // REF CODE
      const refLines = pdf.splitTextToSize(row.refCode, COLS[2].w - pad * 2)
      pdf.text((refLines as string[]).slice(0, 6), colX(2) + pad, y + pad + 3)

      // COLOR/FINISH
      const colorLines = pdf.splitTextToSize(row.colorFinish, COLS[3].w - pad * 2)
      pdf.text((colorLines as string[]).slice(0, 7), colX(3) + pad, y + pad + 3)

      // DESCRIPTION
      pdf.setFontSize(8)
      const descLines = pdf.splitTextToSize(row.description, COLS[4].w - pad * 2)
      pdf.text((descLines as string[]).slice(0, 6), colX(4) + pad, y + pad + 3)

      // DIMENSION
      pdf.setFontSize(7.5)
      const dimLines = pdf.splitTextToSize(row.dimension, COLS[5].w - pad * 2)
      const dimH = (dimLines as string[]).length * 3.5
      pdf.text(dimLines as string[], colX(5) + COLS[5].w / 2, y + (ROW_H - dimH) / 2 + 3.5, { align: 'center' })

      // IMAGE
      const imgB64 = row.imageUrl ? imageCache.get(row.imageUrl) : null
      if (imgB64) {
        const imgP = 3
        const fmt = imgB64.startsWith('data:image/png') ? 'PNG' : imgB64.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
        try {
          pdf.addImage(imgB64, fmt, colX(6) + imgP, y + imgP, COLS[6].w - imgP * 2, ROW_H - imgP * 2)
        } catch { /* skip bad images */ }
      }

      // QTY
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text(String(row.qty), colX(7) + COLS[7].w / 2, midY, { align: 'center', baseline: 'middle' })

      // UNIT PRICE
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(formatPrice(row.unitPrice, activeCurrency), colX(8) + COLS[8].w - pad, midY, { align: 'right', baseline: 'middle' })

      // TOTAL PRICE
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatPrice(row.totalPrice, activeCurrency), colX(9) + COLS[9].w - pad, midY, { align: 'right', baseline: 'middle' })
    }

    // Render
    drawHeader()
    y += HDR_H

    for (const [idx, row] of rowData.entries()) {
      if (y + ROW_H > PH - MY) {
        pdf.addPage()
        y = MY
        drawHeader()
        y += HDR_H
      }
      drawRow(row, idx)
      y += ROW_H
    }

    // Grand total row
    if (y + 12 > PH - MY) {
      pdf.addPage()
      y = MY
    }
    pdf.setFillColor(245, 238, 228)
    pdf.rect(MX, y, TW, 12, 'DF')
    pdf.setDrawColor(180, 163, 145)
    pdf.setLineWidth(0.3)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(30, 30, 30)
    pdf.text('GRAND TOTAL', MX + 4, y + 7)
    pdf.text(formatPrice(boqTotal, activeCurrency), MX + TW - 2, y + 7, { align: 'right' })

    pdf.save(`${filenameSafe(activeBoq.name) || 'boq'}.pdf`)
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
                Export CSV
              </button>
              <button
                type="button"
                onClick={exportBoqPdf}
                disabled={activeBoq.lines.length === 0}
                className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.22)] bg-white/60 px-3 py-1.5 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export PDF
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
            <>
              <div className="dashboard-panel catalog-flat-panel mb-3 flex flex-wrap items-stretch gap-3 p-3">
                <div className="min-w-[16rem] flex-[2_1_20rem]">
                  <TextInput
                    className="w-full"
                    value={boqQuery}
                    onChange={(e) => setBoqQuery(e.target.value)}
                    onValueChange={setBoqQuery}
                    placeholder="Search SKU, name, description, finishes..."
                    aria-label="Search BOQ"
                  />
                </div>
                <div className="min-w-[11rem] flex-1">
                  <Select className="w-full" value={boqCategory} onValueChange={(v) => { setBoqCategory(v); setBoqSubcategory(ALL_VALUE) }} aria-label="Filter by category">
                    <SelectItem value={ALL_VALUE}>All categories</SelectItem>
                    {boqCategories.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </Select>
                </div>
                <div className="min-w-[11rem] flex-1">
                  <Select className="w-full" value={boqSubcategory} onValueChange={setBoqSubcategory} aria-label="Filter by subcategory">
                    <SelectItem value={ALL_VALUE}>All subcategories</SelectItem>
                    {boqSubcategories.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </Select>
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Select className="w-full" value={boqItemType} onValueChange={setBoqItemType} aria-label="Filter by item type">
                    <SelectItem value={ALL_VALUE}>All item types</SelectItem>
                    {ITEM_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </Select>
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Select className="w-full" value={boqAgeRange} onValueChange={setBoqAgeRange} aria-label="Filter by age range">
                    <SelectItem value={ALL_VALUE}>All ages</SelectItem>
                    {boqAgeRanges.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </Select>
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Select className="w-full" value={boqSuitableSpace} onValueChange={setBoqSuitableSpace} aria-label="Filter by suitable space">
                    <SelectItem value={ALL_VALUE}>All spaces</SelectItem>
                    {boqSuitableSpaces.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </Select>
                </div>
                <button
                  type="button"
                  disabled={!hasActiveBoqFilters}
                  onClick={() => { setBoqQuery(''); setBoqCategory(ALL_VALUE); setBoqSubcategory(ALL_VALUE); setBoqItemType(ALL_VALUE); setBoqAgeRange(ALL_VALUE); setBoqSuitableSpace(ALL_VALUE) }}
                  className="whitespace-nowrap rounded-full border border-[rgba(109,91,81,0.18)] bg-white/60 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => { setIsBulkEditOpen((v) => !v); setBulkDiscountInput('') }}
                  className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.28)] bg-white/60 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
                >
                  Bulk Edit
                </button>
              </div>

              {isBulkEditOpen && (() => {
                const filteredCount =
                  (filteredGroupedLines?.floors.reduce((n, f) => n + f.rooms.reduce((m, r) => m + r.lines.length, 0), 0) ?? 0) +
                  (filteredGroupedLines?.unassigned.length ?? 0)
                return (
                  <div className="dashboard-panel catalog-flat-panel flex flex-wrap items-center gap-3 p-3">
                    <span className="text-sm text-tremor-content-strong font-medium">Bulk Edit Discount</span>
                    <span className="text-sm text-tremor-content">
                      Apply to <strong>{filteredCount}</strong> {hasActiveBoqFilters ? 'filtered' : ''} item{filteredCount !== 1 ? 's' : ''}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={bulkDiscountInput}
                        onChange={(e) => setBulkDiscountInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyBulkDiscount() }}
                        placeholder="0"
                        autoFocus
                        className="w-20 rounded-full border border-[rgba(109,91,81,0.18)] bg-white/75 px-3 py-1.5 text-right text-sm text-tremor-content-strong focus:outline-none focus:ring-1 focus:ring-[rgba(228,60,47,0.35)]"
                      />
                      <span className="text-sm text-tremor-content-subtle">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={applyBulkDiscount}
                      disabled={bulkDiscountInput === '' || filteredCount === 0}
                      className="whitespace-nowrap rounded-full bg-[#e43c2f] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#c93226] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply to {filteredCount} item{filteredCount !== 1 ? 's' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBulkEditOpen(false)}
                      className="text-sm text-tremor-content-subtle hover:text-tremor-content-strong transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )
              })()}

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
                    <ResizableHeaderCell columnKey="discount" width={columnWidths.discount} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Discount %</span>
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="total" width={columnWidths.total} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Total {activeCurrency}</span>
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="comment" width={columnWidths.comment} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Comments
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="action" width={columnWidths.action} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      <span className="text-right block">Action</span>
                    </ResizableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGroupedLines?.hasRooms ? (
                    <>
                      {filteredGroupedLines.floors.map((floor) => {
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
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    {floor.floorName}
                                    <span className="ml-3 text-xs font-normal text-tremor-content">
                                      {floorItemCount} item{floorItemCount !== 1 ? 's' : ''}{' '}
                                      &middot; {formatPrice(floorTotal, activeCurrency)}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); cloneFloor(floor.floorId) }}
                                      className="flex h-6 w-6 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-white/50 hover:text-tremor-content-strong"
                                      title="Clone floor"
                                      aria-label="Clone floor"
                                    >
                                      <span className="text-xs font-bold">⊕</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); removeFloor(floor.floorId) }}
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-red-50 hover:text-red-500"
                                      title="Remove floor"
                                      aria-label="Remove floor"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
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
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1">
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
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); cloneRoom(room.roomId) }}
                                            className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-white/50 hover:text-tremor-content-strong"
                                            title="Clone room"
                                            aria-label="Clone room"
                                          >
                                            <span className="text-xs font-bold">⊕</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeRoom(room.roomId) }}
                                            className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-red-50 hover:text-red-500"
                                            title="Remove room"
                                            aria-label="Remove room"
                                          >
                                            <span className="text-xs">✕</span>
                                          </button>
                                        </div>
                                      </div>
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
                      {filteredGroupedLines.unassigned.length > 0 ? (
                        <Fragment>
                          <TableRow>
                            <TableCell
                              colSpan={COLS}
                              className="rounded-[22px] bg-[rgba(109,91,81,0.06)] px-5 py-3 text-sm font-semibold text-tremor-content"
                            >
                              Unassigned
                              <span className="ml-3 text-xs font-normal text-tremor-content-subtle">
                                {filteredGroupedLines.unassigned.length} item
                                {filteredGroupedLines.unassigned.length !== 1 ? 's' : ''} not placed in any room
                              </span>
                            </TableCell>
                          </TableRow>
                          {filteredGroupedLines.unassigned.map((line, index) =>
                            renderItemRow(line, index),
                          )}
                        </Fragment>
                      ) : null}
                    </>
                  ) : (
                    filteredGroupedLines?.unassigned.length === 0 && hasActiveBoqFilters ? (
                      <TableRow>
                        <TableCell colSpan={COLS} className="py-10 text-center text-sm text-tremor-content-subtle">
                          No items match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (filteredGroupedLines?.unassigned ?? activeBoq.lines).map((line, index) =>
                        renderItemRow(line, index, undefined),
                      )
                    )
                  )}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </section>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[rgba(109,91,81,0.2)] bg-white/45 py-12 text-center">
          <Text className="text-tremor-content-subtle">
            Go to Catalog, drag items into rooms — they will appear here organised by floor and room.
          </Text>
        </div>
      )}

      {confirmationState && (
        <ConfirmationModal
          isOpen={confirmationState.type === 'room'}
          title="Remove Room"
          message={`Are you sure you want to remove the room "${confirmationState.name}"?`}
          confirmLabel="Remove"
          onConfirm={confirmRemoveRoom}
          onCancel={() => setConfirmationState(null)}
          isDangerous
        />
      )}

      {confirmationState && (
        <ConfirmationModal
          isOpen={confirmationState.type === 'floor'}
          title="Remove Floor"
          message={`Are you sure you want to remove the floor "${confirmationState.name}" and all its rooms?`}
          confirmLabel="Remove"
          onConfirm={confirmRemoveFloor}
          onCancel={() => setConfirmationState(null)}
          isDangerous
        />
      )}
    </div>
  )
}
