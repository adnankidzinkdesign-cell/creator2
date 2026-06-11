import type { FurnitureItemRow } from '@/lib/zoho/mappers/furniture-items'
import { formatAED, formatDimensions } from '@/lib/format'

export const ALL_VALUE = '__all__'

export type CatalogView = 'list' | 'cards'
export type ItemTypeValue = 'standard' | 'sp' | 'custom' | 'assembled'

export const ITEM_TYPE_OPTIONS: Array<{ value: ItemTypeValue; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'sp', label: 'SP' },
  { value: 'custom', label: 'Custom' },
  { value: 'assembled', label: 'Assembled' },
]

export function categoryDisplay(
  category: string | null,
  subcategory: string | null,
): string {
  if (category && subcategory) return `${category} › ${subcategory}`
  return category ?? subcategory ?? '—'
}

export function truncate(s: string | null, max: number): string {
  if (!s) return '—'
  if (s.length <= max) return s
  return s.slice(0, max).trimEnd() + '…'
}

export function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b))
}

export function displayValues(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value]
  const values: string[] = []

  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    values.push(
      ...entry
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean),
    )
  }

  return [...new Set(values)]
}

function normalizedValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function itemTypeValue(item: FurnitureItemRow): ItemTypeValue | null {
  const furnitureType = normalizedValue(item.furniture_type)

  if (furnitureType === 'assembly' || furnitureType === 'assembled') {
    return 'assembled'
  }
  if (normalizedValue(item.tweaked_standard_item_sp) === 'yes') {
    return 'sp'
  }
  if (furnitureType === 'custom') {
    return 'custom'
  }
  if (furnitureType === 'standard') {
    return 'standard'
  }

  return null
}

export function itemTypeLabel(item: FurnitureItemRow): string {
  const value = itemTypeValue(item)
  return ITEM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? '—'
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchTokens(value: string): string[] {
  return normalizeSearch(value).split(' ').filter(Boolean)
}

export function approvalValue(item: FurnitureItemRow): string | null {
  return item.approval ?? null
}

export function normalizedApprovalValue(value: string | null): string {
  return value?.trim().toLowerCase() ?? ''
}

export function isApprovedApproval(value: string | null): boolean {
  return normalizedApprovalValue(value) === 'approved'
}

export function isApprovedItem(item: FurnitureItemRow): boolean {
  return isApprovedApproval(approvalValue(item))
}

export function searchableText(item: FurnitureItemRow): string {
  return [
    item.sku_id,
    item.old_code,
    item.furniture_item_name,
    item.category,
    item.subcategory,
    item.furniture_type,
    itemTypeLabel(item),
    item.approval,
    item.internal_description,
    formatDimensions(item.length_mm, item.height_mm, item.depth_mm),
    item.length_mm,
    item.height_mm,
    item.depth_mm,
    formatAED(item.retail_price_aed),
    item.retail_price_aed,
    item.description,
    item.finishes_summary,
    item.first_name,
    item.last_name,
    item.designer_name,
    item.age_range,
    ...displayValues(item.suitable_spaces),
    ...displayValues(item.finishes),
  ]
    .filter(Boolean)
    .join(' ')
}
