'use client'

import { useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Text, TextInput } from '@tremor/react'
import type { RoomPlannerFloor } from './room-planner-storage'

type RoomItem = {
  id: string
  label: string
}

export function RoomPlannerSidebar({
  floors,
  activeFloorId,
  activeRoomId,
  dragRoomId,
  dragItemId,
  draggedItemRef,
  draggedItemStorageKey,
  roomItemsById,
  roomItemCountById,
  onAddFloor,
  onAddRoom,
  onSelectFloor,
  onSelectRoom,
  onDragRoom,
  onDropItem,
  onCloneRoom,
  onRenameRoom,
  onMoveRoom,
  onRemoveRoom,
  onRemoveFloor,
  onRemoveItem,
}: {
  floors: RoomPlannerFloor[]
  activeFloorId: string
  activeRoomId: string
  dragRoomId: string | null
  dragItemId: string | null
  draggedItemRef: MutableRefObject<string | null>
  draggedItemStorageKey: string
  roomItemsById: Record<string, RoomItem[]>
  roomItemCountById: Record<string, number>
  onAddFloor: (name: string) => void
  onAddRoom: (floorId: string, name: string) => void
  onSelectFloor: (floorId: string) => void
  onSelectRoom: (roomId: string) => void
  onDragRoom: (roomId: string | null) => void
  onDropItem: (roomId: string, itemId: string) => void
  onCloneRoom?: (roomId: string) => void
  onRenameRoom?: (roomId: string, newName: string) => void
  onMoveRoom?: (roomId: string, targetFloorId: string) => void
  onRemoveRoom?: (roomId: string) => void
  onRemoveFloor?: (floorId: string) => void
  onRemoveItem?: (roomId: string, itemId: string) => void
}) {
  const [floorName, setFloorName] = useState('')
  const [roomDrafts, setRoomDrafts] = useState<Record<string, string>>({})
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set())
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingRoomName, setEditingRoomName] = useState('')
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null)
  const [dragOverFloorId, setDragOverFloorId] = useState<string | null>(null)

  const totalRooms = useMemo(
    () => floors.reduce((sum, floor) => sum + floor.rooms.length, 0),
    [floors],
  )

  function addFloor() {
    const name = floorName.trim()
    onAddFloor(name)
    setFloorName('')
  }

  function addRoom(floorId: string) {
    const name = roomDrafts[floorId]?.trim() ?? ''
    onAddRoom(floorId, name)
    setRoomDrafts((current) => ({ ...current, [floorId]: '' }))
  }

  function updateRoomDraft(floorId: string, value: string) {
    setRoomDrafts((current) => ({ ...current, [floorId]: value }))
  }

  function toggleFloor(floorId: string) {
    setCollapsedFloors((current) => {
      const next = new Set(current)
      if (next.has(floorId)) {
        next.delete(floorId)
      } else {
        next.add(floorId)
      }
      return next
    })
  }

  function startEditRoom(roomId: string, currentName: string) {
    setEditingRoomId(roomId)
    setEditingRoomName(currentName)
  }

  function saveRoomName(roomId: string) {
    if (onRenameRoom && editingRoomName.trim()) {
      onRenameRoom(roomId, editingRoomName)
    }
    setEditingRoomId(null)
    setEditingRoomName('')
  }

  function cancelEditRoom() {
    setEditingRoomId(null)
    setEditingRoomName('')
  }

  return (
    <aside className="dashboard-panel flex h-fit flex-col gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-tremor-content-strong">
          Floors & Rooms
        </h2>
        <Text className="text-tremor-content-subtle">
          Organize items by floor, then drag furniture into rooms.
        </Text>
      </div>

      <div className="flex gap-2">
        <TextInput
          className="flex-1"
          value={floorName}
          onChange={(event) => setFloorName(event.target.value)}
          onValueChange={setFloorName}
          placeholder="New floor name"
          aria-label="New floor name"
        />
        <button
          type="button"
          onClick={addFloor}
          className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.22)] bg-white/70 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
        >
          Add Floor
        </button>
      </div>

      {floors.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-[rgba(109,91,81,0.18)] bg-white/40 p-4 text-sm text-tremor-content">
          Add a floor to start nesting rooms, then drop catalog items into each room.
        </div>
      ) : (
        <div className="space-y-3">
          {floors.map((floor) => {
            const isActiveFloor = floor.id === activeFloorId
            const isCollapsed = collapsedFloors.has(floor.id)
            return (
              <section
                key={floor.id}
                className={
                  'rounded-[22px] border p-3 transition-colors ' +
                  (isActiveFloor
                    ? 'border-[rgba(228,60,47,0.32)] bg-white/70'
                    : 'border-[rgba(109,91,81,0.14)] bg-white/45')
                }
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFloor(floor.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-tremor-content-strong transition-transform"
                    aria-label={isCollapsed ? 'Expand floor' : 'Collapse floor'}
                  >
                    <span className={`text-lg transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                      ‹
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectFloor(floor.id)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-tremor-content-strong">
                        {floor.name}
                      </div>
                      <div className="text-xs text-tremor-content-subtle">
                        {floor.rooms.length} rooms
                      </div>
                    </div>
                  </button>
                  {onRemoveFloor && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRemoveFloor(floor.id) }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Remove floor"
                      aria-label="Remove floor"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    <div
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverFloorId(floor.id)
                  }}
                  onDragLeave={() => setDragOverFloorId(null)}
                  onDrop={(event) => {
                    event.preventDefault()
                    const roomId = event.dataTransfer.getData('application/x-kidzink-room-id')
                    if (roomId && onMoveRoom && roomId !== floor.id) {
                      onMoveRoom(roomId, floor.id)
                    }
                    setDragOverFloorId(null)
                  }}
                  className={dragOverFloorId === floor.id ? 'rounded-[22px] ring-2 ring-[rgba(228,60,47,0.4)] -m-3 p-3' : ''}
                >
                  <div className="mt-3 flex gap-2">
                  <TextInput
                    className="flex-1"
                    value={roomDrafts[floor.id] ?? ''}
                    onChange={(event) =>
                      updateRoomDraft(floor.id, event.target.value)
                    }
                    onValueChange={(value) => updateRoomDraft(floor.id, value)}
                    placeholder="New room name"
                    aria-label={`New room name for ${floor.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => addRoom(floor.id)}
                    className="whitespace-nowrap rounded-full border border-[rgba(228,60,47,0.22)] bg-white/70 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white"
                  >
                    Add Room
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {floor.rooms.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-[rgba(109,91,81,0.14)] bg-white/35 px-3 py-2 text-sm text-tremor-content-subtle">
                      No rooms yet.
                    </div>
                  ) : (
                    floor.rooms.map((room) => {
                      const isActiveRoom = room.id === activeRoomId
                      const isDraggingOver = dragRoomId === room.id
                      const items = roomItemsById[room.id] ?? []
                      const count = roomItemCountById[room.id] ?? room.itemIds.length

                      return (
                        <div
                          key={room.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(event) => {
                            setDraggedRoomId(room.id)
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('application/x-kidzink-room-id', room.id)
                          }}
                          onDragEnd={() => {
                            setDraggedRoomId(null)
                            setDragOverFloorId(null)
                          }}
                          onClick={() => onSelectRoom(room.id)}
                          onDragOver={(event) => {
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                            onDragRoom(room.id)
                          }}
                          onDragLeave={() => onDragRoom(null)}
                          onDrop={(event) => {
                            event.preventDefault()
                            const itemId =
                              event.dataTransfer.getData(
                                'application/x-kidzink-item-id',
                              ) ||
                              event.dataTransfer.getData('text/plain') ||
                              dragItemId ||
                              draggedItemRef.current ||
                              window.sessionStorage.getItem(draggedItemStorageKey) ||
                              ''
                            if (itemId) onDropItem(room.id, itemId)
                            draggedItemRef.current = null
                            window.sessionStorage.removeItem(draggedItemStorageKey)
                            onDragRoom(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onSelectRoom(room.id)
                            }
                          }}
                          className={
                            'relative w-full rounded-[18px] border px-3 py-3 text-left transition-colors cursor-move ' +
                            (draggedRoomId === room.id ? 'opacity-50' : '') +
                            ' ' +
                            (isDraggingOver
                              ? 'border-[rgba(228,60,47,0.45)] bg-[rgba(228,60,47,0.08)]'
                              : isActiveRoom
                                ? 'border-[rgba(228,60,47,0.3)] bg-white'
                                : 'border-[rgba(109,91,81,0.12)] bg-white/70 hover:bg-white')
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {editingRoomId === room.id ? (
                                <input
                                  type="text"
                                  value={editingRoomName}
                                  onChange={(e) => setEditingRoomName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRoomName(room.id)
                                    if (e.key === 'Escape') cancelEditRoom()
                                  }}
                                  onBlur={() => saveRoomName(room.id)}
                                  autoFocus
                                  className="w-full rounded-full border border-[rgba(228,60,47,0.3)] bg-white px-2 py-1 text-sm font-medium text-tremor-content-strong focus:outline-none focus:ring-2 focus:ring-[rgba(228,60,47,0.4)]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditRoom(room.id, room.name)
                                  }}
                                  className="cursor-text truncate text-sm font-medium text-tremor-content-strong hover:text-[#e43c2f] transition-colors"
                                >
                                  {room.name}
                                </div>
                              )}
                              <div className="text-xs text-tremor-content-subtle">
                                {count} item{count === 1 ? '' : 's'}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {onCloneRoom && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onCloneRoom(room.id) }}
                                  className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-white/50 hover:text-tremor-content-strong"
                                  title="Clone room"
                                  aria-label="Clone room"
                                >
                                  <span className="text-xs font-bold">⊕</span>
                                </button>
                              )}
                              {onRemoveRoom && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onRemoveRoom(room.id) }}
                                  className="flex h-5 w-5 items-center justify-center rounded text-tremor-content-subtle transition-colors hover:bg-red-50 hover:text-red-500"
                                  title="Remove room"
                                  aria-label="Remove room"
                                >
                                  <span className="text-xs">✕</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-tremor-content">
                            {items.length === 0 ? (
                              <span className="text-tremor-content-subtle">
                                Drop items here
                              </span>
                            ) : (
                              <>
                                {items.slice(0, 4).map((item) => (
                                  <div key={item.id} className="flex items-center justify-between gap-1 group">
                                    <span className="truncate">{item.label}</span>
                                    {onRemoveItem && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onRemoveItem(room.id, item.id) }}
                                        className="invisible group-hover:visible shrink-0 text-tremor-content-subtle hover:text-red-500 transition-colors leading-none"
                                        title="Remove item"
                                        aria-label="Remove item from room"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {items.length > 4 ? (
                                  <div className="text-tremor-content-subtle">
                                    +{items.length - 4} more
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                    </div>
                  </div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </aside>
  )
}
