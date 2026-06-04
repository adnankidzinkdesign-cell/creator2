# Zoho Creator Excel Upload

This folder is intentionally small:

- `Zoho_Creator_Upload_Template.xlsx` - the Excel file to fill in.
- `Zoho_Lookup_Mapping.xlsx` - maps Excel display values to Zoho lookup record
  IDs.
- `creator-importer.js` - reads the Excel file, builds parent records, adds
  `Finishes` subform rows, resolves configured lookup values, and uploads to
  Zoho Creator.
- `creator-import-config.json` - controls the field mapping, lookup IDs,
  lookup fields, report candidates, and template columns.

## How To Fill The Template

Use the `Upload_Data` sheet for real import rows. One Excel row becomes one
parent `Furniture_Items_List` record with one `Finishes` subform row.

Important columns:

- `Old_Code` is the main row identifier.
- `Category` and `SubCategory` can use display names such as `Storage` and
  `Vanity Overhead`; the importer converts configured lookup values to Zoho
  record IDs.
- `SubCategory_1` is the subform SubCategory. If blank, it falls back to the
  parent `SubCategory`.
- `Entry_Source_1` is the subform Entry Source.

Helper sheets in `Zoho_Creator_Upload_Template.xlsx`:

- `Example_Row` shows a sample row. Do not paste real data there for upload.
- `Lookup_Values` shows a small static lookup summary.
- `Field_Map` shows which Excel columns upload to the parent form or subform.

## Lookup Mapping

Fill `Zoho_Lookup_Mapping.xlsx` when a column is a Zoho lookup field. The
important sheet is `Lookup_Map`.

Each mapped lookup value needs:

- `Zoho field` - the Creator field link name, such as `Item_Material`.
- `Excel display value` - exactly what you type in the upload template, such as
  `MDF 18mm`.
- `Zoho record ID` - the linked Creator record ID.

The importer does not skip lookup fields. If a filled lookup value is missing
from `Zoho_Lookup_Mapping.xlsx`, the dry-run fails before upload.

## Commands

Create a fresh blank template:

```bash
node upload/creator-importer.js --create-template
```

Create or refresh the lookup mapping workbook:

```bash
node upload/creator-importer.js --create-mapping --fetch-lookups
```

Preview the payload without uploading:

```bash
node upload/creator-importer.js --file upload/Zoho_Creator_Upload_Template.xlsx --mapping upload/Zoho_Lookup_Mapping.xlsx
```

Upload to Zoho Creator:

```bash
node upload/creator-importer.js --file upload/Zoho_Creator_Upload_Template.xlsx --mapping upload/Zoho_Lookup_Mapping.xlsx --yes
```

## Lookups

Lookup fields are listed in `creator-import-config.json` under `lookupFields`.
The mapping workbook is the upload-time source of truth for display values and
Zoho record IDs.

Zoho report fetching currently finds:

- `All_Categories`

The other lookup fields are present in the mapping workbook with blank rows so
you can fill in the IDs as you find them in Creator.
