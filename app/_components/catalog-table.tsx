'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
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
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { formatNumber } from '@/lib/format'
import {
  ALL_VALUE,
  type CatalogView,
  approvalValue,
  categoryDisplay,
  isApprovedItem,
  normalizeSearch,
  searchableText,
  searchTokens,
  truncate,
  unique,
} from './catalog-utils'
import { cleanDescription } from '@/lib/zoho/parse'
import {
  addItemToStoredBoq,
  readBoqState,
  writeBoqState,
  type Boq,
} from './boq-storage'
import {
  addFloorToState,
  addRoomToState,
  assignItemToRoomState,
  assignItemToRoomsState,
  cloneRoomToState,
  renameRoomInState,
  moveRoomToFloor,
  removeRoomFromState,
  removeFloorFromState,
  removeItemFromRoomByRoomState,
  readRoomPlannerState,
  roomItemCount,
  writeRoomPlannerState,
  DEFAULT_ROOM_PLANNER_STATE,
  type RoomPlannerState,
} from './room-planner-storage'
import { RoomPlannerSidebar } from './room-planner-sidebar'
import { FurnitureDetailModal } from './furniture-detail-modal'

const LONG_TEXT_TRUNCATE = 120
const TABLE_HEADER_CLASS = '!whitespace-normal break-words align-top'
const TABLE_CELL_CLASS = '!whitespace-normal break-words align-top text-tremor-content'
const ROW_BASE_CLASS = 'group transition-colors duration-200'
const ROW_CELL_BASE_CLASS = 'border-y border-transparent px-4 py-4 align-top'
const DRAGGED_ROOM_ITEM_STORAGE_KEY = 'kidzink-dragged-room-item'

const CATEGORY_SUBCATEGORY_MAP: Record<string, string[]> = {
  Accessories: ['Easels & Boards', 'Drying Racks', 'Cushions', 'Partition Panels', 'Modesty Panels', 'Trolley', 'Planter Boxes'],
  'Display Units': ['Mobile Display Units', 'Shelved Book Display', 'Guitar Stand'],
  Play: ['Role Play', 'Soft Play', 'Sensory Penzone'],
  Pods: ['Meeting House Pods', 'Enclosed Seating', 'Play House Pods'],
  Seating: ['Gym Bench', 'Pouffe', 'Bean Bag', 'Floor Seating', 'Sofa', 'Bench & Tiered Seating'],
  Storage: ['Cabinet', 'Teaching Wall', 'Locker', 'Equipment Unit', 'Cabinet Topper', 'Vanity', 'Vanity Overhead', 'Shelving Unit', 'Drawer'],
  Tables: ['Coffee Table', 'DT Table', 'Table Top', 'Standing Table', 'Meeting Table', 'Classroom Table', 'Office Table'],
}

function rawString(item: FurnitureItemRow, key: string): string | null {
  const value = item.raw[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function rawImagePaths(item: FurnitureItemRow): string[] {
  const paths: string[] = []
  const singleImage = rawString(item, 'Image')
  if (singleImage) paths.push(singleImage)

  const multiImage = item.raw.Image1
  if (Array.isArray(multiImage)) {
    paths.push(
      ...multiImage.filter(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      ),
    )
  }

  return [...new Set(paths)]
}

function imageUrls(item: FurnitureItemRow): string[] {
  if (item.old_code) {
    return [`/product-images/${encodeURIComponent(item.old_code)}.png`]
  }

  if (item.image_urls?.length) return item.image_urls
  if (item.image_url) return [item.image_url]

  return rawImagePaths(item).map(
    (path) => `/api/zoho-image?path=${encodeURIComponent(path)}`,
  )
}

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
      className={`${TABLE_HEADER_CLASS} relative select-none`}
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
      <div className="flex items-center justify-between w-full h-full">
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
          className="hover:bg-blue-400"
        />
      </div>
    </TableHeaderCell>
  )
}

function ImageCarousel({
  alt,
  urls,
  failedUrls,
  onImageError,
}: {
  alt: string
  urls: string[]
  failedUrls: Set<string>
  onImageError: (url: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = Math.min(activeIndex, Math.max(urls.length - 1, 0))
  const activeUrl = urls[safeActiveIndex]
  const fallbackUrl = '/product-images/nope-not-here.png'
  const displayUrl = failedUrls.has(activeUrl || '') ? fallbackUrl : activeUrl

  if (!activeUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-tremor-content-subtle">
        <img
          src={fallbackUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <img
        src={displayUrl}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          if (activeUrl) onImageError(activeUrl)
        }}
      />
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() =>
              setActiveIndex((index) =>
                index === 0 ? urls.length - 1 : index - 1,
              )
            }
            className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-semibold text-tremor-content-strong shadow"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => setActiveIndex((index) => (index + 1) % urls.length)}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-semibold text-tremor-content-strong shadow"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {urls.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Show image ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={
                  'h-1.5 w-1.5 rounded-full ' +
                  (index === safeActiveIndex ? 'bg-white' : 'bg-white/50')
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function CatalogTable({
  items,
  approvalScope = 'approved',
  showBoqActions = true,
  showCreatorNames = false,
  showRoomPlanner = false,
}: {
  items: FurnitureItemRow[]
  approvalScope?: 'approved' | 'non-approved'
  showBoqActions?: boolean
  showCreatorNames?: boolean
  showRoomPlanner?: boolean
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL_VALUE)
  const [subcategory, setSubcategory] = useState(ALL_VALUE)
  const [type, setType] = useState(ALL_VALUE)
  const [ageRange, setAgeRange] = useState(ALL_VALUE)
  const [suitableSpace, setSuitableSpace] = useState(ALL_VALUE)
  const [view, setView] = useState<CatalogView>('list')
  const [boqs, setBoqs] = useState<Boq[]>([])
  const [activeBoqId, setActiveBoqId] = useState('')
  const [lastAddedSku, setLastAddedSku] = useState<string | null>(null)
  const [roomPlanner, setRoomPlanner] = useState<RoomPlannerState>(
    DEFAULT_ROOM_PLANNER_STATE,
  )
  const [hasLoadedRoomPlanner, setHasLoadedRoomPlanner] = useState(false)
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragRoomId, setDragRoomId] = useState<string | null>(null)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<FurnitureItemRow | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    image: 80,
    name: 180,
    sku: 110,
    description: 200,
    type: 120,
    finishes: 160,
    age: 110,
    approval: 130,
    creator: 140,
    room: 100,
    boq: 80,
  })
  const draggedItemRef = useRef<string | null>(null)
  const resizeRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  const categories = useMemo(
    () => unique(items.map((item) => item.category)),
    [items],
  )
  const types = useMemo(
    () => unique(items.map((item) => item.furniture_type)),
    [items],
  )
  const subcategories = useMemo(() => {
    if (category === ALL_VALUE) {
      return unique(items.map((item) => item.subcategory))
    }
    const mappedSubs = CATEGORY_SUBCATEGORY_MAP[category] || []
    const itemSubs = items
      .filter((item) => item.category === category)
      .map((item) => item.subcategory)
    return unique([...mappedSubs, ...itemSubs])
  }, [items, category])
  const ageRanges = useMemo(
    () => unique(items.map((item) => item.age_range)),
    [items],
  )
  const suitableSpaces = useMemo(
    () => unique(items.flatMap((item) => item.suitable_spaces)),
    [items],
  )
  const hasActiveFilters =
    query.trim() ||
    category !== ALL_VALUE ||
    subcategory !== ALL_VALUE ||
    type !== ALL_VALUE ||
    ageRange !== ALL_VALUE ||
    suitableSpace !== ALL_VALUE

  const approvalFilteredItems = useMemo(() => {
    return items.filter((item) =>
      approvalScope === 'approved' ? isApprovedItem(item) : !isApprovedItem(item),
    )
  }, [approvalScope, items])

  const filteredItems = useMemo(() => {
    const tokens = searchTokens(query)

    return approvalFilteredItems.filter((item) => {
      const itemText = normalizeSearch(searchableText(item))
      const matchesSearch =
        tokens.length === 0 || tokens.every((token) => itemText.includes(token))
      const matchesCategory =
        category === ALL_VALUE || item.category === category
      const matchesSubcategory =
        subcategory === ALL_VALUE || item.subcategory === subcategory
      const matchesType = type === ALL_VALUE || item.furniture_type === type
      const matchesAgeRange =
        ageRange === ALL_VALUE || item.age_range === ageRange
      const matchesSuitableSpace =
        suitableSpace === ALL_VALUE ||
        item.suitable_spaces.includes(suitableSpace)

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSubcategory &&
        matchesType &&
        matchesAgeRange &&
        matchesSuitableSpace
      )
    })
  }, [ageRange, approvalFilteredItems, category, query, subcategory, suitableSpace, type])
  const activeBoq = boqs.find((boq) => boq.id === activeBoqId) ?? null
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  )
  const itemLocationById = useMemo(() => {
    const map = new Map<
      string,
      { floorId: string; floorName: string; roomId: string; roomName: string }
    >()

    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        for (const itemId of room.itemIds) {
          map.set(itemId, {
            floorId: floor.id,
            floorName: floor.name,
            roomId: room.id,
            roomName: room.name,
          })
        }
      }
    }

    return map
  }, [roomPlanner])
  const roomItemsById = useMemo(() => {
    const result: Record<string, Array<{ id: string; label: string }>> = {}

    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        result[room.id] = room.itemIds
          .map((itemId) => itemById.get(itemId))
          .filter((item): item is FurnitureItemRow => Boolean(item))
          .map((item) => ({
            id: item.id,
            label:
              item.furniture_item_name ??
              item.sku_id ??
              categoryDisplay(item.category, item.subcategory),
          }))
      }
    }

    return result
  }, [itemById, roomPlanner])
  const roomItemCountById = useMemo(() => {
    const result: Record<string, number> = {}

    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        result[room.id] = roomItemCount(roomPlanner, room.id)
      }
    }

    return result
  }, [roomPlanner])

  const allRoomIds = useMemo(() => {
    const ids = new Set<string>()
    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) ids.add(room.id)
    }
    return ids
  }, [roomPlanner])

  // BOQ items that aren't placed in any room — shown in the sidebar's
  // "Unassigned" bucket so they're visible on the catalog page too (mirrors
  // the BOQ page's Unassigned section).
  const unassignedBoqItems = useMemo(() => {
    if (!activeBoq) return []
    return activeBoq.lines
      .filter((line) => !itemLocationById.has(line.itemId))
      .map((line) => {
        const item = itemById.get(line.itemId)
        return {
          id: line.itemId,
          label: item
            ? item.furniture_item_name ??
              item.sku_id ??
              categoryDisplay(item.category, item.subcategory)
            : line.itemId,
        }
      })
  }, [activeBoq, itemById, itemLocationById])

  // Only count selections that still point at a real room (rooms can be deleted
  // after being selected). This drives both the button label and the assignment.
  const validSelectedRoomIds = useMemo(
    () => [...selectedRoomIds].filter((id) => allRoomIds.has(id)),
    [allRoomIds, selectedRoomIds],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const state = readBoqState()
      setBoqs(state.boqs)
      setActiveBoqId(state.activeBoqId)
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
    if (!hasLoadedRoomPlanner) return
    writeRoomPlannerState(roomPlanner)
  }, [hasLoadedRoomPlanner, roomPlanner])

  function quantityInActiveBoq(itemId: string): number {
    return activeBoq?.lines.find((line) => line.itemId === itemId)?.quantity ?? 0
  }

  function addToBoq(item: FurnitureItemRow) {
    const state = addItemToStoredBoq(item.id)
    setBoqs(state.boqs)
    setActiveBoqId(state.activeBoqId)
    setLastAddedSku(item.sku_id ?? 'Item')
  }

  function addFloor(name: string) {
    setRoomPlanner((current) => addFloorToState(current, name))
  }

  function addRoom(floorId: string, name: string) {
    setRoomPlanner((current) => addRoomToState(current, floorId, name))
  }

  function selectFloor(floorId: string) {
    setRoomPlanner((current) => ({
      ...current,
      activeFloorId: floorId,
      activeRoomId: '',
    }))
  }

  // Toggle a room in/out of the multi-selection. Clicking a selected room
  // deselects it; clicking an unselected one adds it. The "Add" button then
  // targets every selected room at once.
  function toggleRoomSelection(roomId: string) {
    setSelectedRoomIds((current) => {
      const next = new Set(current)
      if (next.has(roomId)) {
        next.delete(roomId)
      } else {
        next.add(roomId)
      }
      return next
    })
    setRoomPlanner((current) => ({
      ...current,
      activeFloorId:
        current.floors.find((floor) =>
          floor.rooms.some((room) => room.id === roomId),
        )?.id ?? current.activeFloorId,
    }))
  }

  // Adds an item to the BOQ and, if any spaces are selected, places it in all
  // of them. With no selection it simply lands in the BOQ (unassigned).
  function addToBoqAndSelectedRooms(item: FurnitureItemRow) {
    addToBoq(item)
    if (validSelectedRoomIds.length > 0) {
      setRoomPlanner((current) =>
        assignItemToRoomsState(current, item.id, validSelectedRoomIds),
      )
    }
  }

  function assignItemToActiveRoom(itemId: string, roomId: string) {
    setRoomPlanner((current) => assignItemToRoomState(current, itemId, roomId))
    // Ensure the item is in the BOQ exactly once. If it's already there (e.g.
    // an unassigned item being dragged into a room), just place it — don't
    // bump the quantity.
    const state = readBoqState()
    const alreadyInBoq = state.boqs.some(
      (boq) =>
        boq.id === state.activeBoqId &&
        boq.lines.some((line) => line.itemId === itemId),
    )
    if (!alreadyInBoq) {
      const boqState = addItemToStoredBoq(itemId)
      setBoqs(boqState.boqs)
      setActiveBoqId(boqState.activeBoqId)
    }
    setLastAddedSku(itemById.get(itemId)?.sku_id ?? 'Item')
  }

  // Removes a line from the active BOQ entirely (used by the Unassigned bucket).
  function removeFromBoq(itemId: string) {
    const state = readBoqState()
    const next = {
      boqs: state.boqs.map((boq) =>
        boq.id === state.activeBoqId
          ? { ...boq, lines: boq.lines.filter((line) => line.itemId !== itemId) }
          : boq,
      ),
      activeBoqId: state.activeBoqId,
    }
    writeBoqState(next)
    setBoqs(next.boqs)
    setActiveBoqId(next.activeBoqId)
  }

  function cloneRoom(roomId: string) {
    setRoomPlanner((current) => cloneRoomToState(current, roomId))
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

  function renameRoom(roomId: string, newName: string) {
    setRoomPlanner((current) => renameRoomInState(current, roomId, newName))
  }

  function moveRoom(roomId: string, targetFloorId: string) {
    setRoomPlanner((current) => moveRoomToFloor(current, roomId, targetFloorId))
  }

  function removeRoom(roomId: string) {
    setRoomPlanner((current) => {
      const next = removeRoomFromState(current, roomId)
      writeRoomPlannerState(next)
      return next
    })
  }

  function removeFloor(floorId: string) {
    setRoomPlanner((current) => {
      const next = removeFloorFromState(current, floorId)
      writeRoomPlannerState(next)
      return next
    })
  }

  function removeItemFromRoom(roomId: string, itemId: string) {
    setRoomPlanner((current) => {
      const next = removeItemFromRoomByRoomState(current, roomId, itemId)
      writeRoomPlannerState(next)
      return next
    })
  }

  function beginRoomItemDrag(itemId: string) {
    draggedItemRef.current = itemId
    window.sessionStorage.setItem(DRAGGED_ROOM_ITEM_STORAGE_KEY, itemId)
    setDragItemId(itemId)
  }

  function endRoomItemDrag() {
    draggedItemRef.current = null
    window.sessionStorage.removeItem(DRAGGED_ROOM_ITEM_STORAGE_KEY)
    setDragItemId(null)
    setDragRoomId(null)
  }

  function clearFilters() {
    setQuery('')
    setCategory(ALL_VALUE)
    setSubcategory(ALL_VALUE)
    setType(ALL_VALUE)
    setAgeRange(ALL_VALUE)
    setSuitableSpace(ALL_VALUE)
  }

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

  const addButtonLabel =
    validSelectedRoomIds.length === 0
      ? 'Add to BOQ'
      : validSelectedRoomIds.length === 1
        ? 'Add to Selected space'
        : 'Add to Selected spaces'

  return (
    <section className="space-y-6">
      <div className="dashboard-panel flex flex-wrap items-stretch gap-3 p-4">
        <div className="min-w-[18rem] flex-[2_1_22rem]">
          <TextInput
            className="w-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onValueChange={setQuery}
            placeholder="Search SKU, name, description, finishes..."
            aria-label="Search catalog"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Select
            className="w-full"
            value={category}
            onValueChange={(newCategory) => {
              setCategory(newCategory)
              setSubcategory(ALL_VALUE)
            }}
            aria-label="Filter by category"
          >
            <SelectItem value={ALL_VALUE}>All categories</SelectItem>
            {categories.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Select
            className="w-full"
            value={subcategory}
            onValueChange={setSubcategory}
            aria-label="Filter by subcategory"
          >
            <SelectItem value={ALL_VALUE}>All subcategories</SelectItem>
            {subcategories.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-[11rem] flex-1">
          <Select
            className="w-full"
            value={type}
            onValueChange={setType}
            aria-label="Filter by furniture type"
          >
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            {types.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-[11rem] flex-1">
          <Select
            className="w-full"
            value={ageRange}
            onValueChange={setAgeRange}
            aria-label="Filter by age range"
          >
            <SelectItem value={ALL_VALUE}>All ages</SelectItem>
            {ageRanges.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-[11rem] flex-1">
          <Select
            className="w-full"
            value={suitableSpace}
            onValueChange={setSuitableSpace}
            aria-label="Filter by suitable space"
          >
            <SelectItem value={ALL_VALUE}>All spaces</SelectItem>
            {suitableSpaces.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="flex min-w-[15rem] items-stretch gap-3">
          <div className="grid flex-1 grid-cols-2 rounded-full border border-[rgba(109,91,81,0.18)] bg-white/55 p-1">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
              (view === 'list'
                ? 'bg-[#2e2d2c] text-[#f7f1ea] shadow-sm'
                : 'text-tremor-content hover:text-tremor-content-strong')
            }
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
            className={
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
              (view === 'cards'
                ? 'bg-[#2e2d2c] text-[#f7f1ea] shadow-sm'
                : 'text-tremor-content hover:text-tremor-content-strong')
            }
          >
            Cards
          </button>
          </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="whitespace-nowrap rounded-full border border-[rgba(109,91,81,0.18)] bg-white/60 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <Text className="text-tremor-content-subtle">
          Showing {formatNumber(filteredItems.length)} of{' '}
          {formatNumber(items.length)}
        </Text>
        {lastAddedSku ? (
          <Text className="text-tremor-content-subtle">
            {lastAddedSku} added to BOQ
          </Text>
        ) : null}
      </div>

      <div
        className={
          showRoomPlanner
            ? 'grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]'
            : 'space-y-6'
        }
      >
        {showRoomPlanner ? (
          <RoomPlannerSidebar
            floors={roomPlanner.floors}
            activeFloorId={roomPlanner.activeFloorId}
            selectedRoomIds={validSelectedRoomIds}
            dragRoomId={dragRoomId}
            dragItemId={dragItemId}
            draggedItemRef={draggedItemRef}
            draggedItemStorageKey={DRAGGED_ROOM_ITEM_STORAGE_KEY}
            roomItemsById={roomItemsById}
            roomItemCountById={roomItemCountById}
            unassignedItems={unassignedBoqItems}
            onBeginItemDrag={beginRoomItemDrag}
            onEndItemDrag={endRoomItemDrag}
            onRemoveFromBoq={removeFromBoq}
            onAddFloor={addFloor}
            onAddRoom={addRoom}
            onSelectFloor={selectFloor}
            onToggleRoom={toggleRoomSelection}
            onDragRoom={setDragRoomId}
            onDropItem={(roomId, itemId) => assignItemToActiveRoom(itemId, roomId)}
            onCloneRoom={cloneRoom}
            onCloneFloor={cloneFloor}
            onRenameRoom={renameRoom}
            onMoveRoom={moveRoom}
            onRemoveRoom={removeRoom}
            onRemoveFloor={removeFloor}
            onRemoveItem={removeItemFromRoom}
          />
        ) : null}

        <div className="space-y-6">
          {items.length === 0 ? (
            <div className="mt-8 rounded-tremor-default border border-dashed border-tremor-border py-12 text-center">
              <Text>
                No furniture items yet.{' '}
                <Link href="/settings" className="underline">
                  Sync from Settings
                </Link>
                .
              </Text>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-8 rounded-tremor-default border border-dashed border-tremor-border py-12 text-center">
              <Text>No items match the current search and filters.</Text>
            </div>
          ) : view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredItems.map((item, index) => {
                const urls = imageUrls(item)
                const imageAlt =
                  item.furniture_item_name ??
                  categoryDisplay(item.category, item.subcategory)
                const location = itemLocationById.get(item.id)

                return (
                  <article
                    key={item.id}
                    draggable={showRoomPlanner}
                    onPointerDown={() => {
                      if (showRoomPlanner) beginRoomItemDrag(item.id)
                    }}
                    onDragStart={(event) => {
                      if (!showRoomPlanner) return
                      beginRoomItemDrag(item.id)
                      event.dataTransfer.setData('text/plain', item.id)
                      event.dataTransfer.setData('application/x-kidzink-item-id', item.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={endRoomItemDrag}
                    className={
                      'dashboard-panel overflow-hidden p-4 cursor-pointer hover:shadow-md transition-shadow ' +
                      (index % 2 === 0
                        ? 'bg-[rgba(247,241,234,0.95)]'
                        : 'bg-[rgba(239,231,220,0.95)]') +
                      (showRoomPlanner ? ' active:cursor-grabbing' : '') +
                      (dragItemId === item.id ? ' opacity-70' : '')
                    }
                    onClick={() => setSelectedItemForDetail(item)}
                  >
                    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-[18px] border border-[rgba(109,91,81,0.12)] bg-white/50 pointer-events-none">
                      <ImageCarousel
                        alt={imageAlt}
                        urls={urls}
                        failedUrls={failedImageUrls}
                        onImageError={(url) =>
                          setFailedImageUrls((prev) => new Set(prev).add(url))
                        }
                      />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-tremor-content">
                          {item.sku_id ?? '—'}
                        </p>
                        <h2 className="mt-1 line-clamp-2 text-base font-semibold text-tremor-content-strong">
                          {item.furniture_item_name ||
                            categoryDisplay(item.category, item.subcategory)}
                        </h2>
                        {location ? (
                          <p className="mt-1 truncate text-xs text-tremor-content-subtle">
                            {location.floorName} / {location.roomName}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {item.furniture_type ? (
                          <Badge color="rose">{item.furniture_type}</Badge>
                        ) : null}
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
                        <dd className="mt-1 truncate text-tremor-content-emphasis">
                          {item.age_range ?? '—'}
                        </dd>
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
                            <dd className="mt-1 truncate text-tremor-content-emphasis">
                              {approvalValue(item) ?? '—'}
                            </dd>
                          </div>
                        </>
                      ) : null}
                    </dl>

                    <div className="mt-4 text-sm">
                      <p className="text-tremor-content-subtle">Finishes Summary</p>
                      <p className="mt-1 line-clamp-3 min-h-14 text-tremor-content">
                        {truncate(item.finishes_summary, 150)}
                      </p>
                    </div>

                    {showBoqActions || showRoomPlanner ? (
                      <button
                        type="button"
                        onClick={() => addToBoqAndSelectedRooms(item)}
                        className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-medium transition-colors border border-[rgba(228,60,47,0.22)] bg-white/70 text-tremor-content-strong hover:bg-white disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {showRoomPlanner ? addButtonLabel : 'Add to BOQ'}
                      </button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="dashboard-table-shell overflow-x-auto" style={{ position: 'relative' }}>
              <Table className="w-full border-separate text-sm" style={{ minWidth: 'min-content', borderSpacing: '0' }}>
                <TableHead>
                  <TableRow style={{ backgroundColor: '#e8ddd3' }}>
                    <ResizableHeaderCell columnKey="image" width={columnWidths.image} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Image
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="name" width={columnWidths.name} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Furniture Item Name
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="sku" width={columnWidths.sku} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      SKU ID
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="description" width={columnWidths.description} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Description
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="type" width={columnWidths.type} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Furniture Type
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="finishes" width={columnWidths.finishes} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Finishes Summary
                    </ResizableHeaderCell>
                    <ResizableHeaderCell columnKey="age" width={columnWidths.age} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                      Age Range
                    </ResizableHeaderCell>
                    {approvalScope === 'non-approved' ? (
                      <ResizableHeaderCell columnKey="approval" width={columnWidths.approval} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                        Approval
                      </ResizableHeaderCell>
                    ) : null}
                    {showCreatorNames ? (
                      <ResizableHeaderCell columnKey="creator" width={columnWidths.creator} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                        Requestor
                      </ResizableHeaderCell>
                    ) : null}
                    {showRoomPlanner || showBoqActions ? (
                      <ResizableHeaderCell columnKey="room" width={columnWidths.room} onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}>
                        Action
                      </ResizableHeaderCell>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item, index) => {
                    const urls = imageUrls(item)
                    const src = urls[0]
                    const rowTone =
                      index % 2 === 0
                        ? 'bg-[rgba(247,241,234,0.96)]'
                        : 'bg-[rgba(239,231,220,0.96)]'
                    const location = itemLocationById.get(item.id)

                    return (
                      <TableRow
                        key={item.id}
                        className={`${ROW_BASE_CLASS} cursor-pointer hover:opacity-80`}
                        draggable={showRoomPlanner}
                        onPointerDown={() => {
                          if (showRoomPlanner) beginRoomItemDrag(item.id)
                        }}
                        onDragStart={(event) => {
                          if (!showRoomPlanner) return
                          beginRoomItemDrag(item.id)
                          event.dataTransfer.setData('text/plain', item.id)
                          event.dataTransfer.setData('application/x-kidzink-item-id', item.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={endRoomItemDrag}
                        onClick={() => setSelectedItemForDetail(item)}
                      >
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} rounded-l-[22px]`}
                          style={{ width: `${columnWidths.image}px`, minWidth: `${columnWidths.image}px` }}
                        >
                          <div className="h-14 w-full max-w-16 overflow-hidden rounded-[16px] border border-[rgba(109,91,81,0.12)] bg-white/50">
                            {(() => {
                              const displayUrl = src && failedImageUrls.has(src) ? '/product-images/nope-not-here.png' : src
                              const imageSrc = displayUrl || '/product-images/nope-not-here.png'
                              return (
                                <img
                                  key={imageSrc}
                                  src={imageSrc}
                                  alt={
                                    item.furniture_item_name ??
                                    categoryDisplay(item.category, item.subcategory)
                                  }
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={() => {
                                    if (src && !failedImageUrls.has(src)) {
                                      setFailedImageUrls((prev) =>
                                        new Set(prev).add(src)
                                      )
                                    }
                                  }}
                                />
                              )
                            })()}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                          style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}
                        >
                          <div className="space-y-1">
                            <div>
                              {item.furniture_item_name ||
                                categoryDisplay(item.category, item.subcategory)}
                            </div>
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
                          {item.furniture_type ?? '—'}
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
                            <button
                              type="button"
                              onClick={() => addToBoqAndSelectedRooms(item)}
                              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors border border-[rgba(228,60,47,0.22)] bg-white/70 text-tremor-content-strong hover:bg-white disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              {showRoomPlanner ? addButtonLabel : 'Add to BOQ'}
                            </button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <FurnitureDetailModal
        item={selectedItemForDetail}
        isOpen={!!selectedItemForDetail}
        onClose={() => setSelectedItemForDetail(null)}
      />
    </section>
  )
}
