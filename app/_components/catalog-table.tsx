'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Text } from '@tremor/react'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import {
  ALL_VALUE,
  type CatalogView,
  categoryDisplay,
  displayValues,
  isApprovedItem,
  itemTypeValue,
  normalizeSearch,
  searchableText,
  searchTokens,
  unique,
} from './catalog-utils'
import { CatalogFilters } from './catalog-filters'
import { CatalogCardsView } from './catalog-cards-view'
import { CatalogListView } from './catalog-list-view'
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
  roomItemCount,
  writeRoomPlannerState,
} from './room-planner-storage'
import { RoomPlannerSidebar } from './room-planner-sidebar'
import { FurnitureDetailModal } from './furniture-detail-modal'
import { ConfirmationModal } from './confirmation-modal'
import { useRoomPlanner } from './use-room-planner'

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
  const [itemType, setItemType] = useState(ALL_VALUE)
  const [ageRange, setAgeRange] = useState(ALL_VALUE)
  const [suitableSpace, setSuitableSpace] = useState(ALL_VALUE)
  const [addQuantities, setAddQuantities] = useState<Record<string, string>>({})
  const [view, setView] = useState<CatalogView>('list')
  const [boqs, setBoqs] = useState<Boq[]>([])
  const [activeBoqId, setActiveBoqId] = useState('')
  const [lastAddedSku, setLastAddedSku] = useState<string | null>(null)
  const { roomPlanner, setRoomPlanner, hasLoaded: hasLoadedRoomPlanner } = useRoomPlanner()
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragRoomId, setDragRoomId] = useState<string | null>(null)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<FurnitureItemRow | null>(null)
  const [confirmationState, setConfirmationState] = useState<{ type: 'floor' | 'room'; id: string; name: string } | null>(null)
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
    room: 210,
    boq: 80,
  })
  const [sidebarWidth, setSidebarWidth] = useState(340)
  const draggedItemRef = useRef<string | null>(null)
  const resizeRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const categories = useMemo(
    () => unique(items.map((item) => item.category)),
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
    () => unique(items.flatMap((item) => displayValues(item.suitable_spaces))),
    [items],
  )
  const hasActiveFilters =
    query.trim() ||
    category !== ALL_VALUE ||
    subcategory !== ALL_VALUE ||
    itemType !== ALL_VALUE ||
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
      const matchesItemType =
        itemType === ALL_VALUE || itemTypeValue(item) === itemType
      const matchesAgeRange =
        ageRange === ALL_VALUE || item.age_range === ageRange
      const matchesSuitableSpace =
        suitableSpace === ALL_VALUE ||
        displayValues(item.suitable_spaces).includes(suitableSpace)

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSubcategory &&
        matchesItemType &&
        matchesAgeRange &&
        matchesSuitableSpace
      )
    })
  }, [ageRange, approvalFilteredItems, category, itemType, query, subcategory, suitableSpace])
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
    const result: Record<string, Array<{ id: string; label: string; quantity?: number }>> = {}

    for (const floor of roomPlanner.floors) {
      for (const room of floor.rooms) {
        const roomItems: Array<{ id: string; label: string; quantity?: number }> = []
        for (const itemId of room.itemIds) {
          const item = itemById.get(itemId)
          if (!item) continue
          const quantity = activeBoq?.lines.find((line) => line.itemId === itemId)?.quantity
          roomItems.push({
            id: item.id,
            label:
              item.furniture_item_name ??
              item.sku_id ??
              categoryDisplay(item.category, item.subcategory),
            quantity,
          })
        }
        result[room.id] = roomItems
      }
    }

    return result
  }, [itemById, roomPlanner, activeBoq])
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
    if (!hasLoadedRoomPlanner) return
    writeRoomPlannerState(roomPlanner)
  }, [hasLoadedRoomPlanner, roomPlanner])

  function addQuantityInputForItem(itemId: string): string {
    return addQuantities[itemId] ?? '1'
  }

  function addQuantityForItem(itemId: string): number {
    const quantity = Number(addQuantityInputForItem(itemId))
    return Math.max(1, Math.floor(quantity || 1))
  }

  function setAddQuantityForItem(itemId: string, quantity: string) {
    setAddQuantities((current) => ({
      ...current,
      [itemId]: quantity.replace(/\D/g, ''),
    }))
  }

  function commitAddQuantityForItem(itemId: string) {
    setAddQuantities((current) => ({
      ...current,
      [itemId]: String(Math.max(1, Math.floor(Number(current[itemId]) || 1))),
    }))
  }

  function addToBoq(item: FurnitureItemRow) {
    const quantity = addQuantityForItem(item.id)
    const state = addItemToStoredBoq(item.id, quantity)
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

  function renameFloor(floorId: string, newName: string) {
    setRoomPlanner((current) => ({
      ...current,
      floors: current.floors.map((floor) =>
        floor.id === floorId ? { ...floor, name: newName } : floor,
      ),
    }))
  }

  function moveRoom(roomId: string, targetFloorId: string) {
    setRoomPlanner((current) => moveRoomToFloor(current, roomId, targetFloorId))
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
    setItemType(ALL_VALUE)
    setAgeRange(ALL_VALUE)
    setSuitableSpace(ALL_VALUE)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizeRef.current) {
        const diff = e.clientX - resizeRef.current.startX
        const newWidth = Math.max(50, resizeRef.current.startWidth + diff)
        setColumnWidths((prev) => ({
          ...prev,
          [resizeRef.current!.column]: newWidth,
        }))
      }
      if (sidebarResizeRef.current) {
        const diff = e.clientX - sidebarResizeRef.current.startX
        const newWidth = Math.max(250, Math.min(600, sidebarResizeRef.current.startWidth + diff))
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      resizeRef.current = null
      sidebarResizeRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const addButtonLabel =
    validSelectedRoomIds.length === 0
      ? 'Add to BOQ'
      : validSelectedRoomIds.length === 1
        ? 'Add to Selected space'
        : 'Add to Selected spaces'

  return (
    <section
      className={
        showRoomPlanner
          ? 'flex h-[calc(100vh-7.75rem)] min-h-0 flex-col gap-6 overflow-hidden'
          : 'space-y-6'
      }
    >
      <CatalogFilters
        query={query}
        category={category}
        subcategory={subcategory}
        itemType={itemType}
        ageRange={ageRange}
        suitableSpace={suitableSpace}
        view={view}
        categories={categories}
        subcategories={subcategories}
        ageRanges={ageRanges}
        suitableSpaces={suitableSpaces}
        hasActiveFilters={!!hasActiveFilters}
        onQueryChange={setQuery}
        onCategoryChange={(val) => { setCategory(val); setSubcategory(ALL_VALUE) }}
        onSubcategoryChange={setSubcategory}
        onItemTypeChange={setItemType}
        onAgeRangeChange={setAgeRange}
        onSuitableSpaceChange={setSuitableSpace}
        onViewChange={setView}
        onClearFilters={clearFilters}
      />

      {lastAddedSku ? (
        <div className="flex justify-end px-1">
          <Text className="text-tremor-content-subtle">
            {lastAddedSku} added to BOQ
          </Text>
        </div>
      ) : null}

      <div
        className={
          showRoomPlanner
            ? 'relative flex min-h-0 flex-1 gap-2 overflow-hidden'
            : 'space-y-6'
        }
      >
        {showRoomPlanner ? (
          <div style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}>
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
              onRenameFloor={renameFloor}
              onMoveRoom={moveRoom}
              onRemoveRoom={removeRoom}
              onRemoveFloor={removeFloor}
              onRemoveItem={removeItemFromRoom}
            />
          </div>
        ) : null}

        {showRoomPlanner ? (
          <div
            onMouseDown={(e) => {
              sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth }
            }}
            className="absolute top-1/2 -translate-y-1/2 z-10 cursor-col-resize"
            style={{ left: `calc(${sidebarWidth}px + 0.25rem)`, transform: 'translateX(-50%) translateY(-50%)' }}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-[rgba(228,60,47,0.4)] hover:border-[rgba(228,60,47,0.7)] hover:bg-[rgba(228,60,47,0.1)] transition-all bg-white">
              <span className="text-xs text-[rgba(228,60,47,0.6)] font-semibold leading-none">⟨⟩</span>
            </div>
          </div>
        ) : null}

        <div className={showRoomPlanner ? 'min-h-0 flex-1 rounded-[22px] overflow-hidden' : 'space-y-6'}>
          <div className={showRoomPlanner ? 'h-full space-y-6 overflow-y-auto' : 'space-y-6'}>
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
            <CatalogCardsView
              items={filteredItems}
              approvalScope={approvalScope}
              showBoqActions={showBoqActions}
              showCreatorNames={showCreatorNames}
              showRoomPlanner={showRoomPlanner}
              dragItemId={dragItemId}
              failedImageUrls={failedImageUrls}
              addButtonLabel={addButtonLabel}
              itemLocationById={itemLocationById}
              addQuantityInputForItem={addQuantityInputForItem}
              setAddQuantityForItem={setAddQuantityForItem}
              commitAddQuantityForItem={commitAddQuantityForItem}
              onBeginDrag={beginRoomItemDrag}
              onEndDrag={endRoomItemDrag}
              onAddToBoq={addToBoqAndSelectedRooms}
              onImageError={(url) => setFailedImageUrls((prev) => new Set(prev).add(url))}
              onSelectItem={setSelectedItemForDetail}
            />
          ) : (
            <CatalogListView
              items={filteredItems}
              approvalScope={approvalScope}
              showBoqActions={showBoqActions}
              showCreatorNames={showCreatorNames}
              showRoomPlanner={showRoomPlanner}
              dragItemId={dragItemId}
              failedImageUrls={failedImageUrls}
              addButtonLabel={addButtonLabel}
              itemLocationById={itemLocationById}
              columnWidths={columnWidths}
              addQuantityInputForItem={addQuantityInputForItem}
              setAddQuantityForItem={setAddQuantityForItem}
              commitAddQuantityForItem={commitAddQuantityForItem}
              onResizeStart={(col, x) => { resizeRef.current = { column: col, startX: x, startWidth: columnWidths[col] } }}
              onBeginDrag={beginRoomItemDrag}
              onEndDrag={endRoomItemDrag}
              onAddToBoq={addToBoqAndSelectedRooms}
              onImageError={(url) => setFailedImageUrls((prev) => new Set(prev).add(url))}
              onSelectItem={setSelectedItemForDetail}
            />
          )}
          </div>
        </div>
      </div>

      <FurnitureDetailModal
        item={selectedItemForDetail}
        isOpen={!!selectedItemForDetail}
        onClose={() => setSelectedItemForDetail(null)}
        onAddToBoq={(item) => addToBoqAndSelectedRooms(item)}
      />

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
    </section>
  )
}
