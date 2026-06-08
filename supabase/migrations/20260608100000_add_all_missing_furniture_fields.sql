-- Add all missing furniture specification and detail fields from Zoho Creator
-- Total fields being added: 76

-- Status and Tracking Fields
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS entry_source text; -- "Variant" or direct item
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS variation_id text; -- Variant identifier (e.g., "V0004")
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS match_key text; -- Link to standard item (e.g., "C1-V0004")

-- Approval and Requestor Fields
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS approval_status text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS approved_date text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS requestor jsonb; -- Name object with display value

-- Alternative Descriptions
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS description1 text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS assembled_items_summary text;

-- Country and Range
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS country_of_origin text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS range text; -- Product line/range

-- Specification Fields - Material and Structure
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS item_material jsonb; -- {"Specification_Option": "...", "ID": "...", "zc_display_value": "..."}
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS item_material_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS top_material jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS top_material_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS top_shape jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS top_shape_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS top_thickness text;

-- Specification Fields - Door and Drawer
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS door_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS door_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS door_quantity text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS drawer_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS drawer_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS number_of_drawers text;

-- Specification Fields - Shelves and Tiers
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS type_of_shelves jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS type_of_shelves_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS number_of_tiers text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS number_of_display_tiers text;

-- Specification Fields - Hardware and Fittings
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS handles jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS handles_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS lock jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS lock_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS cable_management jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS cable_management_display text;

-- Specification Fields - Base and Support
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS base jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS base_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS base_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS base_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS leg_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS leg_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS number_of_legs text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS number_of_bases text;

-- Specification Fields - Panels and Boards
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back_panel jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back_panel_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS side_panels jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS side_panels_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back_board_face jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS back_board_face_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS front_board_face jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS front_board_face_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS external_left_wall_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS external_left_wall_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS external_right_wall_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS external_right_wall_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS internal_left_wall_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS internal_left_wall_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS internal_right_wall_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS internal_right_wall_type_display text;

-- Specification Fields - Shape and Design
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS shape jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS shape_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS skirting_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS skirting_type_display text;

-- Specification Fields - Seat and Comfort
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS seat_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS seat_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS seat_upholstery jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS seat_upholstery_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS seat_height_mm text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS arm_rest jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS arm_rest_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS filler_cushion jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS filler_cushion_display text;

-- Specification Fields - Upholstery and Textiles
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS structure_upholstery jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS structure_upholstery_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS carpet jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS carpet_display text;

-- Specification Fields - Wheels and Mobility
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS castor_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS castor_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS castor_placement jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS castor_placement_display text;

-- Specification Fields - Pod and Trolley
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_roof jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_roof_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_table jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_table_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_table_length_mm text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_table_height_mm text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS pod_table_depth_mm text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS type_of_trolley jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS type_of_trolley_display text;

-- Specification Fields - Storage and Organization
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS unit_type jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS unit_type_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS storage_bucket jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS storage_bucket_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS standard_item_sku jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS standard_item_sku_display text;

-- Specification Fields - Special Features
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS lights jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS lights_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS power_socket text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS electric_pop_up_power_socket text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS round_grommet text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS zipper jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS zipper_display text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS vices jsonb;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS vices_display text;

-- Specification Fields - Gratnells and Storage Accessories
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS shallow_gratnells_quantity text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS deep_gratnells_quantity text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS extra_deep_gratnells_quantity text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS plastic_tray text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS organiser text;

-- Miscellaneous Fields
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS spine text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS flip_cover text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS tweaked_standard_item_sp text;
ALTER TABLE mirror_furniture_items ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_furniture_status ON mirror_furniture_items(status);
CREATE INDEX IF NOT EXISTS idx_furniture_variation_id ON mirror_furniture_items(variation_id);
CREATE INDEX IF NOT EXISTS idx_furniture_entry_source ON mirror_furniture_items(entry_source);
CREATE INDEX IF NOT EXISTS idx_furniture_match_key ON mirror_furniture_items(match_key);
