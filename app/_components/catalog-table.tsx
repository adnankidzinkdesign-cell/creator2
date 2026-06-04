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
import {
  addItemToStoredBoq,
  readBoqState,
  type Boq,
} from './boq-storage'
import {
  addFloorToState,
  addRoomToState,
  assignItemToRoomState,
  cloneRoomToState,
  renameRoomInState,
  moveRoomToFloor,
  readRoomPlannerState,
  roomItemCount,
  writeRoomPlannerState,
  DEFAULT_ROOM_PLANNER_STATE,
  type RoomPlannerState,
} from './room-planner-storage'
import { RoomPlannerSidebar } from './room-planner-sidebar'

const LONG_TEXT_TRUNCATE = 120
const TABLE_HEADER_CLASS = '!whitespace-normal break-words align-top'
const TABLE_CELL_CLASS = '!whitespace-normal break-words align-top text-tremor-content'
const ROW_BASE_CLASS = 'group transition-colors duration-200'
const ROW_CELL_BASE_CLASS = 'border-y border-transparent px-4 py-4 align-top'
const DRAGGED_ROOM_ITEM_STORAGE_KEY = 'kidzink-dragged-room-item'

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

function ImageCarousel({
  alt,
  urls,
}: {
  alt: string
  urls: string[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = Math.min(activeIndex, Math.max(urls.length - 1, 0))
  const activeUrl = urls[safeActiveIndex]

  if (!activeUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-tremor-content-subtle">
        No image
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <img
        src={activeUrl}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
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
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragRoomId, setDragRoomId] = useState<string | null>(null)
  const draggedItemRef = useRef<string | null>(null)

  const categories = useMemo(
    () => unique(items.map((item) => item.category)),
    [items],
  )
  const types = useMemo(
    () => unique(items.map((item) => item.furniture_type)),
    [items],
  )
  const subcategories = useMemo(
    () => unique(items.map((item) => item.subcategory)),
    [items],
  )
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

  function selectRoom(roomId: string) {
    setRoomPlanner((current) => ({
      ...current,
      activeRoomId: roomId,
      activeFloorId:
        current.floors.find((floor) =>
          floor.rooms.some((room) => room.id === roomId),
        )?.id ?? current.activeFloorId,
    }))
  }

  function assignItemToActiveRoom(itemId: string, roomId: string) {
    setRoomPlanner((current) => assignItemToRoomState(current, itemId, roomId))
    // Assigning to a room also adds to the active BOQ (one action, not two)
    const boqState = addItemToStoredBoq(itemId)
    setBoqs(boqState.boqs)
    setActiveBoqId(boqState.activeBoqId)
    setLastAddedSku(itemById.get(itemId)?.sku_id ?? 'Item')
  }

  function cloneRoom(roomId: string) {
    setRoomPlanner((current) => cloneRoomToState(current, roomId))
  }

  function renameRoom(roomId: string, newName: string) {
    setRoomPlanner((current) => renameRoomInState(current, roomId, newName))
  }

  function moveRoom(roomId: string, targetFloorId: string) {
    setRoomPlanner((current) => moveRoomToFloor(current, roomId, targetFloorId))
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
            onValueChange={setCategory}
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
            activeRoomId={roomPlanner.activeRoomId}
            dragRoomId={dragRoomId}
            dragItemId={dragItemId}
            draggedItemRef={draggedItemRef}
            draggedItemStorageKey={DRAGGED_ROOM_ITEM_STORAGE_KEY}
            roomItemsById={roomItemsById}
            roomItemCountById={roomItemCountById}
            onAddFloor={addFloor}
            onAddRoom={addRoom}
            onSelectFloor={selectFloor}
            onSelectRoom={selectRoom}
            onDragRoom={setDragRoomId}
            onDropItem={(roomId, itemId) => assignItemToActiveRoom(itemId, roomId)}
            onCloneRoom={cloneRoom}
            onRenameRoom={renameRoom}
            onMoveRoom={moveRoom}
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
                      'dashboard-panel overflow-hidden p-4 ' +
                      (index % 2 === 0
                        ? 'bg-[rgba(247,241,234,0.95)]'
                        : 'bg-[rgba(239,231,220,0.95)]') +
                      (showRoomPlanner ? ' cursor-grab active:cursor-grabbing' : '') +
                      (dragItemId === item.id ? ' opacity-70' : '')
                    }
                  >
                    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-[18px] border border-[rgba(109,91,81,0.12)] bg-white/50">
                      <ImageCarousel alt={imageAlt} urls={urls} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-tremor-content">
                          {item.sku_id ?? '—'}
                        </p>
                        {item.old_code ? (
                          <p className="mt-0.5 truncate font-mono text-xs text-tremor-content-subtle">
                            Old {item.old_code}
                          </p>
                        ) : null}
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
                          {truncate(item.description, 170)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-tremor-content-subtle">Category</dt>
                        <dd className="mt-1 truncate text-tremor-content-emphasis">
                          {item.category ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-tremor-content-subtle">Subcategory</dt>
                        <dd className="mt-1 truncate text-tremor-content-emphasis">
                          {item.subcategory ?? '—'}
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
                            <dt className="text-tremor-content-subtle">Creator</dt>
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

                    {showBoqActions ? (
                      <button
                        type="button"
                        onClick={() => addToBoq(item)}
                        className="mt-4 w-full rounded-full border border-[rgba(228,60,47,0.22)] bg-white/70 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
                      >
                        {quantityInActiveBoq(item.id) > 0
                          ? `Add to BOQ (${quantityInActiveBoq(item.id)})`
                          : 'Add to BOQ'}
                      </button>
                    ) : null}
                    {showRoomPlanner ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (roomPlanner.activeRoomId) {
                            assignItemToActiveRoom(item.id, roomPlanner.activeRoomId)
                          }
                        }}
                        disabled={!roomPlanner.activeRoomId}
                        className="mt-3 w-full rounded-full border border-[rgba(109,91,81,0.18)] bg-white/60 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {location ? 'Move to active room' : 'Add to active room'}
                      </button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="dashboard-table-shell overflow-hidden">
              <Table className="w-full table-fixed border-separate border-spacing-y-3 text-sm">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  {showCreatorNames ? <col className="w-[12%]" /> : null}
                  {showBoqActions ? <col className="w-[6%]" /> : null}
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Image
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Furniture Item Name
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Old Code
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Description
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Furniture Type
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Category
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Subcategory
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Finishes Summary
                    </TableHeaderCell>
                    <TableHeaderCell className={TABLE_HEADER_CLASS}>
                      Age Range
                    </TableHeaderCell>
                    {showCreatorNames ? (
                      <TableHeaderCell className={TABLE_HEADER_CLASS}>
                        Creator
                      </TableHeaderCell>
                    ) : null}
                    {showBoqActions ? (
                      <TableHeaderCell
                        className={`${TABLE_HEADER_CLASS} text-right`}
                      >
                        BOQ
                      </TableHeaderCell>
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
                        className={ROW_BASE_CLASS}
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
                      >
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} rounded-l-[22px]`}
                        >
                          <div className="h-14 w-full max-w-16 overflow-hidden rounded-[16px] border border-[rgba(109,91,81,0.12)] bg-white/50">
                            {src ? (
                              <img
                                src={src}
                                alt={
                                  item.furniture_item_name ??
                                  categoryDisplay(item.category, item.subcategory)
                                }
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-tremor-content-subtle">
                                —
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
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
                        >
                          {item.old_code ?? '—'}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {truncate(item.description, LONG_TEXT_TRUNCATE)}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {item.furniture_type ?? '—'}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {item.category ?? '—'}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {item.subcategory ?? '—'}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {truncate(item.finishes_summary, LONG_TEXT_TRUNCATE)}
                        </TableCell>
                        <TableCell
                          className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone}`}
                        >
                          {item.age_range ?? '—'}
                        </TableCell>
                        {showCreatorNames ? (
                          <TableCell
                            className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} ${showBoqActions ? '' : 'rounded-r-[22px]'}`}
                          >
                            <div className="space-y-0.5">
                              <div>First: {item.first_name ?? '—'}</div>
                              <div>Last: {item.last_name ?? '—'}</div>
                            </div>
                          </TableCell>
                        ) : null}
                        {showBoqActions ? (
                          <TableCell
                            className={`${TABLE_CELL_CLASS} ${ROW_CELL_BASE_CLASS} ${rowTone} rounded-r-[22px] text-right`}
                          >
                            <button
                              type="button"
                              onClick={() => addToBoq(item)}
                              className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.22)] bg-white/70 px-3 py-1.5 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
                            >
                              {quantityInActiveBoq(item.id) > 0
                                ? `Add (${quantityInActiveBoq(item.id)})`
                                : 'Add'}
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
    </section>
  )
}
