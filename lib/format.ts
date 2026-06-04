import { formatDistanceToNow } from 'date-fns'

const aedFormatter = new Intl.NumberFormat('en-AE', {
  style: 'currency',
  currency: 'AED',
})

const sarFormatter = new Intl.NumberFormat('en-SA', {
  style: 'currency',
  currency: 'SAR',
})

const integerFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** "AED 1,930.00" or "—" for null / non-finite. */
export function formatAED(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '—'
  return aedFormatter.format(amount)
}

export type PriceCurrency = 'AED' | 'SAR'

/** Currency-formatted price or "—" for null / non-finite. */
export function formatPrice(
  amount: number | null,
  currency: PriceCurrency,
): string {
  if (amount === null || !Number.isFinite(amount)) return '—'
  return currency === 'SAR'
    ? sarFormatter.format(amount)
    : aedFormatter.format(amount)
}

/** "1,234" or "—" for null / non-finite. en-GB locale, no decimals. */
export function formatNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return integerFormatter.format(n)
}

/** "2 minutes ago" / "yesterday" / etc. "never" for null / unparseable. */
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'never'
  const d = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(d.getTime())) return 'never'
  return `${formatDistanceToNow(d)} ago`
}

/** "08/05/2026" — en-GB DD/MM/YYYY. "—" for null / unparseable. */
export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/**
 * Renders furniture dimensions as "L500 × D500 × H500", omitting any
 * dimension that's null/non-finite. Note the display order is L → D → H,
 * which is the convention used in the catalog, even though the function
 * receives them in (length, height, depth) order.
 *
 * Returns "—" if every dimension is missing.
 */
export function formatDimensions(
  length: number | null,
  height: number | null,
  depth: number | null,
): string {
  const parts: string[] = []
  if (length !== null && Number.isFinite(length)) parts.push(`L${length}`)
  if (depth !== null && Number.isFinite(depth)) parts.push(`D${depth}`)
  if (height !== null && Number.isFinite(height)) parts.push(`H${height}`)
  return parts.length === 0 ? '—' : parts.join(' × ')
}
