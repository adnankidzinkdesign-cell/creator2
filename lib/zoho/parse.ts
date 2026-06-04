/**
 * Parse helpers for Zoho Creator field values.
 *
 * Zoho returns field values in shapes that don't map cleanly to a typed DB:
 * numerics arrive as strings, lookups as `{ID, zc_display_value, ...}` objects,
 * empty lookups as `{}` (not null), multi-lookups as arrays of those objects,
 * names as `{prefix, first_name, last_name, suffix}`, rich text as HTML.
 *
 * Every helper here:
 *  - Accepts `unknown` (Zoho responses are dynamic; callers pass values from
 *    `Record<string, unknown>` directly).
 *  - Returns `null` (or `[]` for collections) on any unparseable / empty input.
 *  - Never throws.
 *
 * The intent is that a mapper can call these without try/catch and trust that
 * each field becomes either a real typed value or a clean null.
 */

/**
 * Returns a trimmed non-empty string, or null.
 *  - undefined / null / non-string → null
 *  - "" or whitespace-only → null
 */
export function parseString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Parses a Zoho-style numeric (which Zoho returns as a string like "500" or
 * "1968.60") into a finite number, or null.
 *
 * IMPORTANT: We do NOT use `Number(v)` directly on `unknown` — `Number("")`
 * returns `0` and `Number(null)` returns `0`, which would silently turn empty
 * fields into zero. We require a non-empty string first.
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null
  }
  const s = parseString(v)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Like `parseNumber` but truncates toward zero for integer columns.
 * Returns null for non-finite input.
 */
export function parseInteger(v: unknown): number | null {
  const n = parseNumber(v)
  return n === null ? null : Math.trunc(n)
}

/**
 * Parses a date-ish value into a `Date`. Returns null if the input cannot be
 * understood as a real date. Zoho typically returns ISO-like strings; the
 * built-in `Date` constructor handles those.
 */
export function parseDate(v: unknown): Date | null {
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v : null
  }
  const s = parseString(v)
  if (s === null) return null
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : null
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * For a single-lookup field shaped `{ ID, zc_display_value, <field>: ... }`,
 * returns the human-readable display value, or null.
 *
 * Notably:
 *  - `{}` (empty lookup) → null, NOT empty string. Zoho sends `{}` for unset
 *    lookups, and we want callers to be able to distinguish "no value" from
 *    "explicit empty string".
 */
export function lookupDisplay(v: unknown): string | null {
  if (!isPlainObject(v)) return null
  return parseString(v.zc_display_value)
}

/**
 * Returns the lookup's ID for foreign-key style joins, or null.
 */
export function lookupId(v: unknown): string | null {
  if (!isPlainObject(v)) return null
  return parseString(v.ID ?? v.id)
}

/**
 * For multi-lookup fields (arrays of lookup objects, e.g. `Suitable_Spaces`),
 * returns the display values of each entry, dropping any that are missing.
 *
 * Non-array input → []. Inner non-objects are skipped.
 */
export function multiLookupDisplays(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const entry of v) {
    const display = lookupDisplay(entry)
    if (display !== null) out.push(display)
  }
  return out
}

/**
 * For a name-shaped object `{ prefix, first_name, last_name, suffix }`,
 * returns a human-readable joined name, or null if every part is empty.
 */
export function nameDisplay(v: unknown): string | null {
  if (!isPlainObject(v)) return null
  const parts: string[] = []
  for (const key of ['prefix', 'first_name', 'last_name', 'suffix']) {
    const part = parseString(v[key])
    if (part !== null) parts.push(part)
  }
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Strips HTML tags from a rich-text field for a plain-text preview / table
 * display. Decodes a few of the common HTML entities (&amp; / &lt; / &gt; /
 * &quot; / &#39; / &nbsp;) — anything more elaborate should go through a real
 * sanitizer (e.g. isomorphic-dompurify) when rendering to the DOM as HTML.
 */
export function stripHtml(v: unknown): string | null {
  const s = parseString(v)
  if (s === null) return null
  const stripped = s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > 0 ? stripped : null
}
