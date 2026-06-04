import type { ZohoRecord } from '@/lib/zoho/client'
import {
  parseString,
  parseNumber,
  parseInteger,
  parseDate,
  lookupDisplay,
  lookupId,
  multiLookupDisplays,
  nameDisplay,
  stripHtml,
} from '@/lib/zoho/parse'

/**
 * Shape of a single mirror_furniture_items row, ready to upsert via the
 * Supabase admin client. Every field is nullable except `id` and `raw` to
 * match the column constraints, plus the multi-value array columns which use
 * `[]` for "no values" rather than null.
 */
export type FurnitureItemRow = {
  id: string
  sku_id: string | null
  old_code: string | null
  furniture_item_name: string | null
  description: string | null
  internal_description: string | null
  first_name: string | null
  last_name: string | null
  furniture_type: string | null
  category: string | null
  category_id: string | null
  subcategory: string | null
  subcategory_id: string | null
  approval: string | null
  length_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  retail_price_aed: number | null
  retail_price_usd: number | null
  retail_price_sar: number | null
  finishes_summary: string | null
  number_of_shelves: number | null
  number_of_compartments: number | null
  age_range: string | null
  designer_name: string | null
  customisation_details_html: string | null
  customisation_details_text: string | null
  suitable_spaces: string[]
  finishes: string[]
  role_play_purpose: string | null
  created_time: string | null
  modified_time: string | null
  image_storage_path?: string | null
  image_url?: string | null
  image_storage_paths?: string[]
  image_urls?: string[]
  image_synced_at?: string | null
  raw: ZohoRecord
}

export function mapFurnitureItem(record: ZohoRecord): FurnitureItemRow {
  const id = parseString(record.ID)
  if (id === null) {
    throw new Error('Furniture record is missing required field "ID"')
  }

  const firstName = parseString(
    record.First_Name ??
      record.first_name ??
      record.FirstName ??
      record.firstname,
  )
  const lastName = parseString(
    record.Last_Name ??
      record.last_name ??
      record.LastName ??
      record.lastname,
  )

  return {
    id,
    sku_id: parseString(record.SKU_ID),
    old_code: parseString(record.Old_Code),
    furniture_item_name: parseString(record.Furniture_Item_Name),
    description: parseString(record.Description),
    internal_description: parseString(record.Internal_Description),
    first_name: firstName,
    last_name: lastName,
    furniture_type: parseString(record.Furniture_Type),
    category: lookupDisplay(record.Category),
    category_id: lookupId(record.Category),
    subcategory: lookupDisplay(record.SubCategory),
    subcategory_id: lookupId(record.SubCategory),
    approval: parseString(record.Approval),
    length_mm: parseInteger(record.Length_mm),
    height_mm: parseInteger(record.Height_mm),
    depth_mm: parseInteger(record.Depth_mm),
    retail_price_aed: parseNumber(record.Retail_Selling_Price_AED),
    retail_price_usd: parseNumber(record.Retail_Selling_Price_USD),
    retail_price_sar: parseNumber(record.Retail_Selling_Price_SAR),
    finishes_summary: parseString(record.Finishes_Summary),
    number_of_shelves: parseInteger(record.Number_of_Shelves),
    number_of_compartments: parseInteger(record.Number_of_Compartments),
    age_range: parseString(record.Age_Range),
    designer_name: nameDisplay(record.Designer_Name),
    customisation_details_html: parseString(record.Customisation_Details),
    customisation_details_text: stripHtml(record.Customisation_Details),
    suitable_spaces: multiLookupDisplays(record.Suitable_Spaces),
    finishes: multiLookupDisplays(record.Finishes),
    role_play_purpose: lookupDisplay(record.Role_Play_Purpose),
    created_time: parseDate(record.Added_Time)?.toISOString() ?? null,
    modified_time: parseDate(record.Modified_Time)?.toISOString() ?? null,
    raw: record,
  }
}
