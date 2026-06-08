'use client'

import { useEffect, useState } from 'react'
import {
  readRoomPlannerState,
  writeRoomPlannerState,
  DEFAULT_ROOM_PLANNER_STATE,
  type RoomPlannerState,
} from './room-planner-storage'

// Shared state instance across all components
let sharedRoomPlannerState: RoomPlannerState = DEFAULT_ROOM_PLANNER_STATE
let subscribers: Set<(state: RoomPlannerState) => void> = new Set()

// Notify all subscribers when state changes
function notifySubscribers(state: RoomPlannerState) {
  sharedRoomPlannerState = state
  subscribers.forEach((callback) => callback(state))
}

// Update shared state and persist to localStorage
function updateSharedState(newState: RoomPlannerState) {
  notifySubscribers(newState)
  writeRoomPlannerState(newState)
}

/**
 * Hook that provides shared room planner state across all components.
 * Both Catalog and BOQ pages use this to reference the same state object.
 * Changes made by one page are immediately visible to the other.
 */
export function useRoomPlanner() {
  const [roomPlanner, setRoomPlanner] = useState<RoomPlannerState>(DEFAULT_ROOM_PLANNER_STATE)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Initialize state from localStorage on first mount
  useEffect(() => {
    const initialState = readRoomPlannerState()
    notifySubscribers(initialState)
    setRoomPlanner(initialState)
    setHasLoaded(true)

    // Subscribe to state changes from other components
    const handleStateChange = (newState: RoomPlannerState) => {
      setRoomPlanner(newState)
    }

    subscribers.add(handleStateChange)
    return () => {
      subscribers.delete(handleStateChange)
    }
  }, [])

  // Wrapper for setState that updates shared state
  const setRoomPlannerShared = (updater: RoomPlannerState | ((current: RoomPlannerState) => RoomPlannerState)) => {
    const newState = typeof updater === 'function' ? updater(sharedRoomPlannerState) : updater
    updateSharedState(newState)
  }

  return {
    roomPlanner,
    setRoomPlanner: setRoomPlannerShared,
    hasLoaded,
  }
}

// Export the state getter for direct access if needed
export function getSharedRoomPlannerState() {
  return sharedRoomPlannerState
}
