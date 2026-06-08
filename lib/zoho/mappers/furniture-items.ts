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
  // Status and Tracking
  status: string | null
  entry_source: string | null
  variation_id: string | null
  match_key: string | null
  // Approval and Requestor
  approval_status: string | null
  approved_by: string | null
  approved_date: string | null
  requestor: unknown | null
  // Alternative Descriptions
  description1: string | null
  assembled_items_summary: string | null
  // Country and Range
  country_of_origin: string | null
  range: string | null
  // Material and Structure
  item_material: unknown | null
  item_material_display: string | null
  top_material: unknown | null
  top_material_display: string | null
  top_shape: unknown | null
  top_shape_display: string | null
  top_thickness: string | null
  // Door and Drawer
  door_type: unknown | null
  door_type_display: string | null
  door_quantity: string | null
  drawer_type: unknown | null
  drawer_type_display: string | null
  number_of_drawers: string | null
  // Shelves and Tiers
  type_of_shelves: unknown | null
  type_of_shelves_display: string | null
  number_of_tiers: string | null
  number_of_display_tiers: string | null
  // Hardware and Fittings
  handles: unknown | null
  handles_display: string | null
  lock: unknown | null
  lock_display: string | null
  cable_management: unknown | null
  cable_management_display: string | null
  // Base and Support
  base: unknown | null
  base_display: string | null
  base_type: unknown | null
  base_type_display: string | null
  leg_type: unknown | null
  leg_type_display: string | null
  number_of_legs: string | null
  number_of_bases: string | null
  // Panels and Boards
  back_panel: unknown | null
  back_panel_display: string | null
  back: unknown | null
  back_display: string | null
  side_panels: unknown | null
  side_panels_display: string | null
  back_board_face: unknown | null
  back_board_face_display: string | null
  front_board_face: unknown | null
  front_board_face_display: string | null
  external_left_wall_type: unknown | null
  external_left_wall_type_display: string | null
  external_right_wall_type: unknown | null
  external_right_wall_type_display: string | null
  internal_left_wall_type: unknown | null
  internal_left_wall_type_display: string | null
  internal_right_wall_type: unknown | null
  internal_right_wall_type_display: string | null
  // Shape and Design
  shape: unknown | null
  shape_display: string | null
  skirting_type: unknown | null
  skirting_type_display: string | null
  // Seat and Comfort
  seat_type: unknown | null
  seat_type_display: string | null
  seat_upholstery: unknown | null
  seat_upholstery_display: string | null
  seat_height_mm: string | null
  arm_rest: unknown | null
  arm_rest_display: string | null
  filler_cushion: unknown | null
  filler_cushion_display: string | null
  // Upholstery and Textiles
  structure_upholstery: unknown | null
  structure_upholstery_display: string | null
  carpet: unknown | null
  carpet_display: string | null
  // Wheels and Mobility
  castor_type: unknown | null
  castor_type_display: string | null
  castor_placement: unknown | null
  castor_placement_display: string | null
  // Pod and Trolley
  pod_roof: unknown | null
  pod_roof_display: string | null
  pod_table: unknown | null
  pod_table_display: string | null
  pod_table_length_mm: string | null
  pod_table_height_mm: string | null
  pod_table_depth_mm: string | null
  type_of_trolley: unknown | null
  type_of_trolley_display: string | null
  // Storage and Organization
  unit_type: unknown | null
  unit_type_display: string | null
  storage_bucket: unknown | null
  storage_bucket_display: string | null
  standard_item_sku: unknown | null
  standard_item_sku_display: string | null
  // Special Features
  lights: unknown | null
  lights_display: string | null
  power_socket: string | null
  electric_pop_up_power_socket: string | null
  round_grommet: string | null
  zipper: unknown | null
  zipper_display: string | null
  vices: unknown | null
  vices_display: string | null
  // Gratnells and Storage Accessories
  shallow_gratnells_quantity: string | null
  deep_gratnells_quantity: string | null
  extra_deep_gratnells_quantity: string | null
  plastic_tray: string | null
  organiser: string | null
  // Miscellaneous
  spine: string | null
  flip_cover: string | null
  tweaked_standard_item_sp: string | null
  rejection_reason: string | null
  raw: ZohoRecord
}

function getSpecDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const display = obj.zc_display_value ?? obj.Specification_Option
    return typeof display === 'string' && display.trim() ? display : null
  }
  return null
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
    // Status and Tracking
    status: parseString(record.Status),
    entry_source: parseString(record.Entry_Source),
    variation_id: parseString(record.Variation_ID),
    match_key: parseString(record.Match_Key),
    // Approval and Requestor
    approval_status: parseString(record.Approval_Status),
    approved_by: parseString(record.Approved_By),
    approved_date: parseString(record.Approved_Date),
    requestor: record.Requestor ?? null,
    // Alternative Descriptions
    description1: parseString(record.Description1),
    assembled_items_summary: parseString(record.Assembled_Items_Summary),
    // Country and Range
    country_of_origin: parseString(record.Country_of_Origin),
    range: parseString(record.Range),
    // Material and Structure
    item_material: record.Item_Material ?? null,
    item_material_display: getSpecDisplayValue(record.Item_Material),
    top_material: record.Top_Material ?? null,
    top_material_display: getSpecDisplayValue(record.Top_Material),
    top_shape: record.Top_Shape ?? null,
    top_shape_display: getSpecDisplayValue(record.Top_Shape),
    top_thickness: parseString(record.Top_Thickness),
    // Door and Drawer
    door_type: record.Door_Type ?? null,
    door_type_display: getSpecDisplayValue(record.Door_Type),
    door_quantity: parseString(record.Door_Quantity),
    drawer_type: record.Drawer_Type ?? null,
    drawer_type_display: getSpecDisplayValue(record.Drawer_Type),
    number_of_drawers: parseString(record.Number_of_Drawers),
    // Shelves and Tiers
    type_of_shelves: record.Type_of_Shelves ?? null,
    type_of_shelves_display: getSpecDisplayValue(record.Type_of_Shelves),
    number_of_tiers: parseString(record.Number_of_Tiers),
    number_of_display_tiers: parseString(record.Number_of_Display_Tiers),
    // Hardware and Fittings
    handles: record.Handles ?? null,
    handles_display: getSpecDisplayValue(record.Handles),
    lock: record.Lock ?? null,
    lock_display: getSpecDisplayValue(record.Lock),
    cable_management: record.Cable_Management ?? null,
    cable_management_display: getSpecDisplayValue(record.Cable_Management),
    // Base and Support
    base: record.Base ?? null,
    base_display: getSpecDisplayValue(record.Base),
    base_type: record.Base_Type ?? null,
    base_type_display: getSpecDisplayValue(record.Base_Type),
    leg_type: record.Leg_Type ?? null,
    leg_type_display: getSpecDisplayValue(record.Leg_Type),
    number_of_legs: parseString(record.Number_of_Legs),
    number_of_bases: parseString(record.Number_of_Bases),
    // Panels and Boards
    back_panel: record.Back_Panel ?? null,
    back_panel_display: getSpecDisplayValue(record.Back_Panel),
    back: record.Back ?? null,
    back_display: getSpecDisplayValue(record.Back),
    side_panels: record.Side_Panels ?? null,
    side_panels_display: getSpecDisplayValue(record.Side_Panels),
    back_board_face: record.Back_Board_Face ?? null,
    back_board_face_display: getSpecDisplayValue(record.Back_Board_Face),
    front_board_face: record.Front_Board_Face ?? null,
    front_board_face_display: getSpecDisplayValue(record.Front_Board_Face),
    external_left_wall_type: record.External_Left_Wall_Type ?? null,
    external_left_wall_type_display: getSpecDisplayValue(record.External_Left_Wall_Type),
    external_right_wall_type: record.External_Right_Wall_Type ?? null,
    external_right_wall_type_display: getSpecDisplayValue(record.External_Right_Wall_Type),
    internal_left_wall_type: record.Internal_Left_Wall_Type ?? null,
    internal_left_wall_type_display: getSpecDisplayValue(record.Internal_Left_Wall_Type),
    internal_right_wall_type: record.Internal_Right_Wall_Type ?? null,
    internal_right_wall_type_display: getSpecDisplayValue(record.Internal_Right_Wall_Type),
    // Shape and Design
    shape: record.Shape ?? null,
    shape_display: getSpecDisplayValue(record.Shape),
    skirting_type: record.Skirting_Type ?? null,
    skirting_type_display: getSpecDisplayValue(record.Skirting_Type),
    // Seat and Comfort
    seat_type: record.Seat_Type ?? null,
    seat_type_display: getSpecDisplayValue(record.Seat_Type),
    seat_upholstery: record.Seat_Upholstery ?? null,
    seat_upholstery_display: getSpecDisplayValue(record.Seat_Upholstery),
    seat_height_mm: parseString(record.Seat_Height_mm),
    arm_rest: record.Arm_Rest ?? null,
    arm_rest_display: getSpecDisplayValue(record.Arm_Rest),
    filler_cushion: record.Filler_Cushion ?? null,
    filler_cushion_display: getSpecDisplayValue(record.Filler_Cushion),
    // Upholstery and Textiles
    structure_upholstery: record.Structure_Upholstery ?? null,
    structure_upholstery_display: getSpecDisplayValue(record.Structure_Upholstery),
    carpet: record.Carpet ?? null,
    carpet_display: getSpecDisplayValue(record.Carpet),
    // Wheels and Mobility
    castor_type: record.Castor_Type ?? null,
    castor_type_display: getSpecDisplayValue(record.Castor_Type),
    castor_placement: record.Castor_Placement ?? null,
    castor_placement_display: getSpecDisplayValue(record.Castor_Placement),
    // Pod and Trolley
    pod_roof: record.Pod_Roof ?? null,
    pod_roof_display: getSpecDisplayValue(record.Pod_Roof),
    pod_table: record.Pod_Table ?? null,
    pod_table_display: getSpecDisplayValue(record.Pod_Table),
    pod_table_length_mm: parseString(record.Pod_Table_Length_mm),
    pod_table_height_mm: parseString(record.Pod_Table_Height_mm),
    pod_table_depth_mm: parseString(record.Pod_Table_Depth_mm),
    type_of_trolley: record.Type_of_Trolley ?? null,
    type_of_trolley_display: getSpecDisplayValue(record.Type_of_Trolley),
    // Storage and Organization
    unit_type: record.Unit_Type ?? null,
    unit_type_display: getSpecDisplayValue(record.Unit_Type),
    storage_bucket: record.Storage_Bucket ?? null,
    storage_bucket_display: getSpecDisplayValue(record.Storage_Bucket),
    standard_item_sku: record.Standard_Item_SKU ?? null,
    standard_item_sku_display: getSpecDisplayValue(record.Standard_Item_SKU),
    // Special Features
    lights: record.Lights ?? null,
    lights_display: getSpecDisplayValue(record.Lights),
    power_socket: parseString(record.Power_Socket),
    electric_pop_up_power_socket: parseString(record.Electric_Pop_Up_Power_Socket),
    round_grommet: parseString(record.Round_Grommet),
    zipper: record.Zipper ?? null,
    zipper_display: getSpecDisplayValue(record.Zipper),
    vices: record.Vices ?? null,
    vices_display: getSpecDisplayValue(record.Vices),
    // Gratnells and Storage Accessories
    shallow_gratnells_quantity: parseString(record.Shallow_Gratnells_Quantity),
    deep_gratnells_quantity: parseString(record.Deep_Gratnells_Quantity),
    extra_deep_gratnells_quantity: parseString(record.Extra_Deep_Gratnells_Quantity),
    plastic_tray: parseString(record.Plastic_Tray),
    organiser: parseString(record.Organiser),
    // Miscellaneous
    spine: parseString(record.Spine),
    flip_cover: parseString(record.Flip_Cover),
    tweaked_standard_item_sp: parseString(record.Tweaked_Standard_Item_SP),
    rejection_reason: parseString(record.Rejection_Reason),
    raw: record,
  }
}
