'use client'

import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { categoryDisplay } from './catalog-utils'

interface FurnitureDetailModalProps {
  item: FurnitureItemRow | null
  isOpen: boolean
  onClose: () => void
  onAddToBoq?: (item: FurnitureItemRow) => void
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

// Define field groups in logical order
const FIELD_GROUPS = {
  'Basic Information': [
    'furniture_item_name',
    'sku_id',
    'old_code',
    'furniture_type',
    'category',
    'subcategory',
  ],
  'Dimensions': [
    'length_mm',
    'height_mm',
    'depth_mm',
    'seat_height_mm',
    'pod_table_length_mm',
    'pod_table_height_mm',
    'pod_table_depth_mm',
  ],
  'Materials & Finishes': [
    'item_material',
    'item_material_display',
    'finishes',
    'finishes_summary',
    'top_material',
    'top_material_display',
    'back_board_face',
    'back_board_face_display',
    'front_board_face',
    'front_board_face_display',
  ],
  'Specifications': [
    'door_type',
    'door_type_display',
    'door_quantity',
    'drawer_type',
    'drawer_type_display',
    'number_of_drawers',
    'type_of_shelves',
    'type_of_shelves_display',
    'number_of_shelves',
    'number_of_compartments',
    'number_of_tiers',
    'number_of_display_tiers',
    'number_of_bases',
    'number_of_legs',
    'handles',
    'handles_display',
    'lock',
    'lock_display',
    'base_type',
    'base_type_display',
    'leg_type',
    'leg_type_display',
    'shape',
    'shape_display',
    'skirting_type',
    'skirting_type_display',
  ],
  'Design & Features': [
    'age_range',
    'role_play_purpose',
    'suitable_spaces',
    'designer_name',
    'customisation_details_html',
    'customisation_details_text',
    'description',
    'description1',
  ],
  'Pricing': [
    'retail_price_aed',
    'retail_price_usd',
    'retail_price_sar',
  ],
  'Status & Approval': [
    'approval',
    'approval_status',
    'approved_by',
    'approved_date',
    'status',
    'entry_source',
  ],
  'Variant Information': [
    'variation_id',
    'match_key',
    'standard_item_sku',
    'standard_item_sku_display',
  ],
  'Metadata': [
    'created_time',
    'modified_time',
    'country_of_origin',
    'range',
    'requestor',
    'internal_description',
  ],
}

export function FurnitureDetailModal({
  item,
  isOpen,
  onClose,
  onAddToBoq,
}: FurnitureDetailModalProps) {
  if (!item || !isOpen) return null

  // Organize fields into groups
  const allFields = Object.entries(item)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false
      if (Array.isArray(value) && value.length === 0) return false
      if (typeof value === 'object' && value instanceof Object && !Array.isArray(value) && Object.keys(value).length === 0) return false
      return true
    })
    .filter(([key]) => key !== 'raw')

  const groupedFields: Record<string, Array<[string, unknown]>> = {}
  const uncategorizedFields: Array<[string, unknown]> = []

  for (const [key, value] of allFields) {
    let found = false
    for (const [groupName, groupKeys] of Object.entries(FIELD_GROUPS)) {
      if (groupKeys.includes(key)) {
        if (!groupedFields[groupName]) {
          groupedFields[groupName] = []
        }
        groupedFields[groupName].push([key, value])
        found = true
        break
      }
    }
    if (!found) {
      uncategorizedFields.push([key, value])
    }
  }

  if (uncategorizedFields.length > 0) {
    groupedFields['Other'] = uncategorizedFields
  }

  const itemTitle =
    item.furniture_item_name ||
    categoryDisplay(item.category, item.subcategory) ||
    item.sku_id ||
    'Furniture Item'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="mx-auto w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
          <div className="sticky top-0 border-b bg-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-tremor-content-strong">
              {itemTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-tremor-content hover:text-tremor-content-strong text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            {Object.entries(FIELD_GROUPS).map(([groupName]) => {
              const fields = groupedFields[groupName]
              if (!fields || fields.length === 0) return null

              return (
                <div key={groupName}>
                  <h3 className="mb-4 text-sm font-semibold text-tremor-content-strong border-b pb-2">
                    {groupName}
                  </h3>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                    {fields.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-semibold uppercase tracking-wider text-tremor-content-subtle">
                          {getFieldLabel(key)}
                        </dt>
                        <dd className="mt-2 break-words text-tremor-content">
                          {formatValue(value)}
                        </dd>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {allFields.length === 0 && (
              <div className="text-center py-8 text-tremor-content-subtle">
                No additional fields available
              </div>
            )}
          </div>

          <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-tremor-border bg-white px-4 py-2 text-sm font-medium text-tremor-content-strong hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            {onAddToBoq && (
              <button
                type="button"
                onClick={() => {
                  onAddToBoq(item)
                  onClose()
                }}
                className="rounded-full border border-[rgba(228,60,47,0.22)] bg-[#e43c2f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c93226]"
              >
                Add to BOQ
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
