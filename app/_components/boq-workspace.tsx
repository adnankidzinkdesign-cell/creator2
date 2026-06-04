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
import type { CrmDealOption } from '@/lib/queries/crm-deals'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { formatDimensions, formatNumber, formatPrice } from '@/lib/format'
import { categoryDisplay, truncate } from './catalog-utils'
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
  const autoCreatedBoqRef = useRef(false)

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

  function assignItemToRoom(itemId: string, roomId: string) {
    setRoomPlanner((current) => assignItemToRoomState(current, itemId, roomId))
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

  function renderItemRow(line: BoqLine, index: number) {
    const item = itemById.get(line.itemId)
    if (!item) return null
    const price = itemPrice(item, activeCurrency)
    const location = itemLocationById.get(line.itemId)
    const rowTone =
      index % 2 === 0
        ? 'bg-[rgba(247,241,234,0.96)]'
        : 'bg-[rgba(239,231,220,0.96)]'
    return (
      <TableRow key={line.itemId} className="group">
        <TableCell className={`rounded-l-[22px] font-mono text-xs ${rowTone}`}>
          <div>{item.sku_id ?? '—'}</div>
          {item.old_code ? (
            <div className="mt-0.5 text-tremor-content-subtle">Old {item.old_code}</div>
          ) : null}
        </TableCell>
        <TableCell className={rowTone}>
          <div className="space-y-0.5">
            <div className="font-medium leading-snug text-tremor-content-strong">
              {item.furniture_item_name ||
                categoryDisplay(item.category, item.subcategory)}
            </div>
            {item.description ? (
              <div className="text-xs leading-snug text-tremor-content">
                {truncate(item.description, 90)}
              </div>
            ) : null}
          </div>
        </TableCell>
        <TableCell className={rowTone}>
          {renderRoomSelector(line.itemId, location)}
        </TableCell>
        <TableCell className={rowTone}>
          <div className="text-sm">{categoryDisplay(item.category, item.subcategory)}</div>
          {item.furniture_type ? (
            <div className="text-xs text-tremor-content">{item.furniture_type}</div>
          ) : null}
        </TableCell>
        <TableCell className={`text-xs ${rowTone}`}>
          {truncate(item.finishes_summary, 80) || '—'}
        </TableCell>
        <TableCell className={`tabular-nums text-xs ${rowTone}`}>
          {formatDimensions(item.length_mm, item.height_mm, item.depth_mm)}
        </TableCell>
        <TableCell className={`text-right tabular-nums ${rowTone}`}>
          {formatPrice(price, activeCurrency)}
        </TableCell>
        <TableCell className={`text-right ${rowTone}`}>
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
        <TableCell className={`text-right tabular-nums ${rowTone}`}>
          {formatPrice((price ?? 0) * line.quantity, activeCurrency)}
        </TableCell>
        <TableCell className={`rounded-r-[22px] text-right ${rowTone}`}>
          <button
            type="button"
            onClick={() => removeLine(line.itemId)}
            className="text-sm font-medium text-[#e43c2f] hover:text-[#b92d22]"
          >
            Remove
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
      'KI CODE',
      'CATEGORY',
      'SUBCATEGORY',
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
          firstRawString(item, ['KI_Code', 'KICode', 'KI Code']) ||
            item.old_code ||
            item.sku_id ||
            '',
          item.category ?? '',
          item.subcategory ?? '',
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
    titleRow[columnCount - 1] = boqTotal
    const dealRow = [...blankRow]
    dealRow[0] = `Deal: ${activeBoq.dealName ?? activeDeal?.deal_name ?? ''}`
    dealRow[1] = activeBoq.dealAccountName ?? activeDeal?.account_name ?? ''
    dealRow[2] = activeBoq.dealStage ?? activeDeal?.stage ?? ''
    const currencyRow = [...blankRow]
    currencyRow[0] = `Currency: ${activeCurrency}`
    currencyRow[columnCount - 1] = `Overall Total: ${boqTotal}`
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
                <span className="text-tremor-content">{dealLabel(activeDeal)}</span>
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
              <Table className="w-full table-fixed border-separate border-spacing-y-2 text-sm">
                <colgroup>
                  <col className="w-[7%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[7%]" />
                  <col className="w-[9%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>SKU ID</TableHeaderCell>
                    <TableHeaderCell>Item Name</TableHeaderCell>
                    <TableHeaderCell>Room</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell>Finishes</TableHeaderCell>
                    <TableHeaderCell>Dimensions</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Unit Price {activeCurrency}
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">Qty</TableHeaderCell>
                    <TableHeaderCell className="text-right">
                      Total {activeCurrency}
                    </TableHeaderCell>
                    <TableHeaderCell className="text-right">Action</TableHeaderCell>
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
                                      className="rounded-[18px] bg-[rgba(228,60,47,0.07)] px-5 py-2 text-sm font-medium text-tremor-content-strong"
                                    >
                                      <span className="ml-3">{room.roomName}</span>
                                      <span className="ml-3 text-xs font-normal text-tremor-content">
                                        {room.lines.length} item{room.lines.length !== 1 ? 's' : ''}{' '}
                                        &middot; {formatPrice(roomTotal, activeCurrency)}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                  {room.lines.map((line, index) =>
                                    renderItemRow(line, index),
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
                      renderItemRow(line, index),
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
