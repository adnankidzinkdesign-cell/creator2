export const ROOM_PLANNER_STORAGE_KEY = 'kidzink-room-planner'

export type RoomPlannerRoom = {
  id: string
  name: string
  itemIds: string[]
}

export type RoomPlannerFloor = {
  id: string
  name: string
  rooms: RoomPlannerRoom[]
}

export type RoomPlannerState = {
  floors: RoomPlannerFloor[]
  activeFloorId: string
  activeRoomId: string
}

export type RoomPlannerLocation = {
  floorId: string
  floorName: string
  roomId: string
  roomName: string
}

export const DEFAULT_ROOM_PLANNER_STATE: RoomPlannerState = {
  floors: [],
  activeFloorId: '',
  activeRoomId: '',
}

function createFloorName(floorCount: number): string {
  return `Floor ${floorCount + 1}`
}

function createRoomName(roomCount: number): string {
  return `Room ${roomCount + 1}`
}

export function readRoomPlannerState(): RoomPlannerState {
  if (typeof window === 'undefined') return DEFAULT_ROOM_PLANNER_STATE

  const raw = window.localStorage.getItem(ROOM_PLANNER_STORAGE_KEY)
  if (!raw) return DEFAULT_ROOM_PLANNER_STATE

  try {
    const parsed = JSON.parse(raw) as Partial<RoomPlannerState>
    const floors = Array.isArray(parsed.floors) ? parsed.floors : []
    return {
      floors: floors.map((floor, floorIndex) => ({
        id: typeof floor.id === 'string' ? floor.id : crypto.randomUUID(),
        name:
          typeof floor.name === 'string' && floor.name.trim()
            ? floor.name.trim()
            : createFloorName(floorIndex),
        rooms: Array.isArray(floor.rooms)
          ? floor.rooms.map((room, roomIndex) => ({
              id: typeof room.id === 'string' ? room.id : crypto.randomUUID(),
              name:
                typeof room.name === 'string' && room.name.trim()
                  ? room.name.trim()
                  : createRoomName(roomIndex),
              itemIds: Array.isArray(room.itemIds)
                ? room.itemIds.filter((value): value is string => typeof value === 'string')
                : [],
            }))
          : [],
      })),
      activeFloorId:
        typeof parsed.activeFloorId === 'string' ? parsed.activeFloorId : '',
      activeRoomId:
        typeof parsed.activeRoomId === 'string' ? parsed.activeRoomId : '',
    }
  } catch {
    window.localStorage.removeItem(ROOM_PLANNER_STORAGE_KEY)
    return DEFAULT_ROOM_PLANNER_STATE
  }
}

export function writeRoomPlannerState(state: RoomPlannerState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROOM_PLANNER_STORAGE_KEY, JSON.stringify(state))
}

export function addFloorToState(
  state: RoomPlannerState,
  floorName?: string,
): RoomPlannerState {
  const name = floorName?.trim() || createFloorName(state.floors.length)
  const floorId = crypto.randomUUID()

  return {
    floors: [...state.floors, { id: floorId, name, rooms: [] }],
    activeFloorId: floorId,
    activeRoomId: '',
  }
}

export function addRoomToState(
  state: RoomPlannerState,
  floorId: string,
  roomName?: string,
): RoomPlannerState {
  const roomId = crypto.randomUUID()

  return {
    ...state,
    floors: state.floors.map((floor) =>
      floor.id === floorId
        ? {
            ...floor,
            rooms: [
              ...floor.rooms,
              {
                id: roomId,
                name: roomName?.trim() || createRoomName(floor.rooms.length),
                itemIds: [],
              },
            ],
          }
        : floor,
    ),
    activeFloorId: floorId,
    activeRoomId: roomId,
  }
}

export function cloneRoomToState(
  state: RoomPlannerState,
  roomId: string,
): RoomPlannerState {
  const targetFloor = state.floors.find((floor) =>
    floor.rooms.some((room) => room.id === roomId),
  )
  if (!targetFloor) return state

  const sourceRoom = targetFloor.rooms.find((r) => r.id === roomId)
  if (!sourceRoom) return state

  const newRoomId = crypto.randomUUID()
  const newRoom = {
    id: newRoomId,
    name: `${sourceRoom.name} (copy)`,
    itemIds: [...sourceRoom.itemIds],
  }

  return {
    ...state,
    floors: state.floors.map((floor) =>
      floor.id === targetFloor.id
        ? {
            ...floor,
            rooms: [...floor.rooms, newRoom],
          }
        : floor,
    ),
    activeFloorId: targetFloor.id,
    activeRoomId: newRoomId,
  }
}

export function renameRoomInState(
  state: RoomPlannerState,
  roomId: string,
  newName: string,
): RoomPlannerState {
  const trimmedName = newName.trim()
  if (!trimmedName) return state

  return {
    ...state,
    floors: state.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) =>
        room.id === roomId ? { ...room, name: trimmedName } : room,
      ),
    })),
  }
}

export function moveRoomToFloor(
  state: RoomPlannerState,
  roomId: string,
  targetFloorId: string,
): RoomPlannerState {
  const sourceFloor = state.floors.find((floor) =>
    floor.rooms.some((room) => room.id === roomId),
  )
  const targetFloor = state.floors.find((f) => f.id === targetFloorId)

  if (!sourceFloor || !targetFloor || sourceFloor.id === targetFloorId) {
    return state
  }

  const room = sourceFloor.rooms.find((r) => r.id === roomId)
  if (!room) return state

  return {
    ...state,
    activeFloorId: targetFloorId,
    activeRoomId: roomId,
    floors: state.floors.map((floor) => {
      if (floor.id === sourceFloor.id) {
        return {
          ...floor,
          rooms: floor.rooms.filter((r) => r.id !== roomId),
        }
      }
      if (floor.id === targetFloor.id) {
        return {
          ...floor,
          rooms: [...floor.rooms, room],
        }
      }
      return floor
    }),
  }
}

export function assignItemToRoomState(
  state: RoomPlannerState,
  itemId: string,
  roomId: string,
): RoomPlannerState {
  const targetFloor = state.floors.find((floor) =>
    floor.rooms.some((room) => room.id === roomId),
  )
  if (!targetFloor) return state

  return {
    ...state,
    activeFloorId: targetFloor.id,
    activeRoomId: roomId,
    floors: state.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) => {
        if (room.id === roomId) {
          return {
            ...room,
            itemIds: room.itemIds.includes(itemId)
              ? room.itemIds
              : [...room.itemIds, itemId],
          }
        }

        return {
          ...room,
          itemIds: room.itemIds.filter((currentId) => currentId !== itemId),
        }
      }),
    })),
  }
}

export function removeItemFromRoomState(
  state: RoomPlannerState,
  itemId: string,
): RoomPlannerState {
  return {
    ...state,
    floors: state.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) => ({
        ...room,
        itemIds: room.itemIds.filter((currentId) => currentId !== itemId),
      })),
    })),
  }
}

export function locationForItem(
  state: RoomPlannerState,
  itemId: string,
): RoomPlannerLocation | null {
  for (const floor of state.floors) {
    for (const room of floor.rooms) {
      if (room.itemIds.includes(itemId)) {
        return {
          floorId: floor.id,
          floorName: floor.name,
          roomId: room.id,
          roomName: room.name,
        }
      }
    }
  }

  return null
}

export function roomItemCount(state: RoomPlannerState, roomId: string): number {
  for (const floor of state.floors) {
    const room = floor.rooms.find((current) => current.id === roomId)
    if (room) return room.itemIds.length
  }

  return 0
}

export function removeRoomFromState(
  state: RoomPlannerState,
  roomId: string,
): RoomPlannerState {
  const floors = state.floors.map((floor) => ({
    ...floor,
    rooms: floor.rooms.filter((room) => room.id !== roomId),
  }))

  const activeRoomStillExists = floors.some((floor) =>
    floor.rooms.some((room) => room.id === state.activeRoomId),
  )

  return {
    ...state,
    floors,
    activeRoomId: activeRoomStillExists ? state.activeRoomId : (floors[0]?.rooms[0]?.id ?? ''),
  }
}

export function removeFloorFromState(
  state: RoomPlannerState,
  floorId: string,
): RoomPlannerState {
  const floors = state.floors.filter((floor) => floor.id !== floorId)

  const activeFloorStillExists = floors.some((floor) => floor.id === state.activeFloorId)

  return {
    ...state,
    floors,
    activeFloorId: activeFloorStillExists ? state.activeFloorId : (floors[0]?.id ?? ''),
    activeRoomId: activeFloorStillExists ? state.activeRoomId : (floors[0]?.rooms[0]?.id ?? ''),
  }
}

export function removeItemFromRoomByRoomState(
  state: RoomPlannerState,
  roomId: string,
  itemId: string,
): RoomPlannerState {
  return {
    ...state,
    floors: state.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) =>
        room.id === roomId
          ? { ...room, itemIds: room.itemIds.filter((id) => id !== itemId) }
          : room,
      ),
    })),
  }
}
