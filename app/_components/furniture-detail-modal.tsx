'use client'

import { Dialog } from '@headlessui/react'
import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { categoryDisplay } from './catalog-utils'

interface FurnitureDetailModalProps {
  item: FurnitureItemRow | null
  isOpen: boolean
  onClose: () => void
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('zc_display_value' in obj) {
      return String(obj.zc_display_value)
    }
    if ('Specification_Option' in obj) {
      return String(obj.Specification_Option)
    }
    return '—'
  }
  return String(value)
}

function getFieldLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function FurnitureDetailModal({
  item,
  isOpen,
  onClose,
}: FurnitureDetailModalProps) {
  if (!item) return null

  const nonNullFields = Object.entries(item)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false
      if (Array.isArray(value) && value.length === 0) return false
      if (typeof value === 'object' && value instanceof Object && !Array.isArray(value) && Object.keys(value).length === 0) return false
      return true
    })
    .filter(([key]) => key !== 'raw')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))

  const itemTitle =
    item.furniture_item_name ||
    categoryDisplay(item.category, item.subcategory) ||
    item.sku_id ||
    'Furniture Item'

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
          <div className="sticky top-0 border-b bg-white px-6 py-4 flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold text-tremor-content-strong">
              {itemTitle}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="text-tremor-content hover:text-tremor-content-strong text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {nonNullFields.map(([key, value]) => (
                <div key={key} className="border-b pb-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-tremor-content-subtle">
                    {getFieldLabel(key)}
                  </dt>
                  <dd className="mt-2 break-words text-tremor-content">
                    {formatValue(value)}
                  </dd>
                </div>
              ))}
            </div>

            {nonNullFields.length === 0 && (
              <div className="text-center py-8 text-tremor-content-subtle">
                No additional fields available
              </div>
            )}
          </div>

          <div className="border-t bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-tremor-border bg-white px-4 py-2 text-sm font-medium text-tremor-content-strong hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
