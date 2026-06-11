export const BOQ_STORAGE_KEY = 'kidzink-boqs'
export const ACTIVE_BOQ_STORAGE_KEY = 'kidzink-active-boq'

export type BoqCurrency = 'AED' | 'SAR'
export type BoqLine = { itemId: string; quantity: number; discount?: number; comment?: string }
export type Boq = {
  id: string
  name: string
  currency?: BoqCurrency
  lines: BoqLine[]
  dealId?: string
  dealName?: string | null
  dealStage?: string | null
  dealAccountName?: string | null
}
export type BoqState = { boqs: Boq[]; activeBoqId: string }

export function readBoqState(): BoqState {
  const rawBoqs = window.localStorage.getItem(BOQ_STORAGE_KEY)
  const activeBoqId = window.localStorage.getItem(ACTIVE_BOQ_STORAGE_KEY) ?? ''

  if (!rawBoqs) return { boqs: [], activeBoqId: '' }

  try {
    const boqs = JSON.parse(rawBoqs) as Boq[]
    return {
      boqs: boqs.map((boq) => ({
        ...boq,
        currency: boq.currency ?? 'AED',
      })),
      activeBoqId:
        boqs.some((boq) => boq.id === activeBoqId)
          ? activeBoqId
          : boqs[0]?.id ?? '',
    }
  } catch {
    window.localStorage.removeItem(BOQ_STORAGE_KEY)
    window.localStorage.removeItem(ACTIVE_BOQ_STORAGE_KEY)
    return { boqs: [], activeBoqId: '' }
  }
}

export function writeBoqState(state: BoqState) {
  window.localStorage.setItem(BOQ_STORAGE_KEY, JSON.stringify(state.boqs))
  if (state.activeBoqId) {
    window.localStorage.setItem(ACTIVE_BOQ_STORAGE_KEY, state.activeBoqId)
  } else {
    window.localStorage.removeItem(ACTIVE_BOQ_STORAGE_KEY)
  }
}

export function addItemToStoredBoq(itemId: string, quantity = 1): BoqState {
  const addQuantity = Math.max(1, Math.floor(quantity || 1))
  const current = readBoqState()
  const activeBoqId = current.activeBoqId || current.boqs[0]?.id || crypto.randomUUID()
  const hasActiveBoq = current.boqs.some((boq) => boq.id === activeBoqId)
  const boqs: Boq[] = hasActiveBoq
    ? current.boqs
    : [
        { id: activeBoqId, name: 'Draft BOQ', currency: 'AED', lines: [] },
        ...current.boqs,
      ]

  const nextBoqs = boqs.map((boq) => {
    if (boq.id !== activeBoqId) return boq
    const existing = boq.lines.find((line) => line.itemId === itemId)

    if (existing) {
      return {
        ...boq,
        lines: boq.lines.map((line) =>
          line.itemId === itemId
            ? { ...line, quantity: line.quantity + addQuantity }
            : line,
        ),
      }
    }

    return { ...boq, lines: [...boq.lines, { itemId, quantity: addQuantity }] }
  })

  const nextState: BoqState = { boqs: nextBoqs, activeBoqId }
  writeBoqState(nextState)
  return nextState
}
