import { loadEnvFile } from 'node:process'

type AllFieldsAnalysis = {
  totalRecords: number
  allFields: Set<string>
  fieldTypes: Record<string, Set<string>>
  currentlyMappedFields: string[]
  missingFields: string[]
  fieldSamples: Record<string, unknown[]>
}

async function getAccessTokenFromZoho(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  accountsUrl: string,
): Promise<string> {
  const response = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  const body = (await response.json()) as Record<string, unknown>
  const accessToken = body.access_token

  if (typeof accessToken !== 'string') {
    throw new Error('Failed to obtain access token from Zoho')
  }

  return accessToken
}

async function fetchReport(
  apiBase: string,
  accountOwner: string,
  appName: string,
  reportName: string,
  accessToken: string,
): Promise<Record<string, unknown>[]> {
  const url = new URL(
    `/creator/v2.1/data/${accountOwner}/${appName}/report/${encodeURIComponent(reportName)}`,
    apiBase,
  )
  url.searchParams.set('field_config', 'all')
  url.searchParams.set('max_records', '200')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  })

  const body = (await response.json()) as Record<string, unknown>
  if (!Array.isArray(body.data)) {
    throw new Error('Zoho response data is not an array')
  }

  return body.data as Record<string, unknown>[]
}

async function main() {
  loadEnvFile('.env.local')

  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL
  const apiBase = process.env.ZOHO_API_BASE
  const accountOwner = process.env.ZOHO_ACCOUNT_OWNER
  const appName = process.env.ZOHO_APP_NAME

  if (!clientId || !clientSecret || !refreshToken || !accountsUrl || !apiBase || !accountOwner || !appName) {
    throw new Error('Missing required environment variables')
  }

  const currentlyMappedFields = [
    'ID',
    'SKU_ID',
    'Old_Code',
    'Furniture_Item_Name',
    'Description',
    'Internal_Description',
    'First_Name',
    'Last_Name',
    'Furniture_Type',
    'Category',
    'SubCategory',
    'Approval',
    'Length_mm',
    'Height_mm',
    'Depth_mm',
    'Retail_Selling_Price_AED',
    'Retail_Selling_Price_USD',
    'Retail_Selling_Price_SAR',
    'Finishes_Summary',
    'Number_of_Shelves',
    'Number_of_Compartments',
    'Age_Range',
    'Designer_Name',
    'Customisation_Details',
    'Suitable_Spaces',
    'Finishes',
    'Role_Play_Purpose',
    'Added_Time',
    'Modified_Time',
    'Image',
    'Image1',
  ]

  const analysis: AllFieldsAnalysis = {
    totalRecords: 0,
    allFields: new Set(),
    fieldTypes: {},
    currentlyMappedFields,
    missingFields: [],
    fieldSamples: {},
  }

  console.log('Obtaining access token from Zoho...')
  const accessToken = await getAccessTokenFromZoho(clientId, clientSecret, refreshToken, accountsUrl)

  console.log('Fetching furniture items from Zoho Creator...')
  const records = await fetchReport(apiBase, accountOwner, appName, 'Furniture_Items_List_Report', accessToken)

  analysis.totalRecords = records.length

  for (const record of records) {
    for (const [fieldName, fieldValue] of Object.entries(record)) {
      analysis.allFields.add(fieldName)

      // Track field types
      const fieldType = Array.isArray(fieldValue)
        ? 'array'
        : fieldValue === null
          ? 'null'
          : typeof fieldValue === 'object'
            ? 'object'
            : typeof fieldValue

      if (!analysis.fieldTypes[fieldName]) {
        analysis.fieldTypes[fieldName] = new Set()
      }
      analysis.fieldTypes[fieldName].add(fieldType)

      // Collect non-null samples
      if (fieldValue !== null && fieldValue !== undefined) {
        if (!analysis.fieldSamples[fieldName]) {
          analysis.fieldSamples[fieldName] = []
        }
        if (analysis.fieldSamples[fieldName].length < 3) {
          analysis.fieldSamples[fieldName].push(fieldValue)
        }
      }
    }
  }

  // Find missing fields
  analysis.missingFields = Array.from(analysis.allFields).filter(
    (field) => !currentlyMappedFields.includes(field),
  )

  // Generate report
  console.log('\n' + '='.repeat(80))
  console.log('FURNITURE ITEMS FIELD ANALYSIS REPORT')
  console.log('='.repeat(80))
  console.log(`\nTotal Records Analyzed: ${analysis.totalRecords}`)
  console.log(`Total Unique Fields in Zoho: ${analysis.allFields.size}`)
  console.log(`Currently Mapped Fields: ${analysis.currentlyMappedFields.length}`)
  console.log(`Missing Fields: ${analysis.missingFields.length}`)

  console.log('\n' + '-'.repeat(80))
  console.log('CURRENTLY MAPPED FIELDS (Being captured in Supabase)')
  console.log('-'.repeat(80))
  for (const field of currentlyMappedFields.sort()) {
    const types = analysis.fieldTypes[field] ? Array.from(analysis.fieldTypes[field]).join('/') : 'not_found'
    console.log(`  ✓ ${field.padEnd(40)} [${types}]`)
  }

  console.log('\n' + '-'.repeat(80))
  console.log('MISSING FIELDS (Available in Zoho but NOT captured in Supabase)')
  console.log('-'.repeat(80))
  if (analysis.missingFields.length === 0) {
    console.log('  ✓ No missing fields! All Zoho fields are being captured.')
  } else {
    for (const field of analysis.missingFields.sort()) {
      const types = analysis.fieldTypes[field]
        ? Array.from(analysis.fieldTypes[field]).join('/')
        : 'unknown'
      const samples = analysis.fieldSamples[field]
        ? JSON.stringify(analysis.fieldSamples[field][0]).substring(0, 60)
        : 'no_samples'
      console.log(`  ✗ ${field.padEnd(40)} [${types.padEnd(12)}] Sample: ${samples}`)
    }
  }

  console.log('\n' + '-'.repeat(80))
  console.log('ALL AVAILABLE FIELDS IN ZOHO')
  console.log('-'.repeat(80))
  for (const field of Array.from(analysis.allFields).sort()) {
    const isMapped = currentlyMappedFields.includes(field) ? '✓' : '✗'
    const types = analysis.fieldTypes[field]
      ? Array.from(analysis.fieldTypes[field]).join('/')
      : 'unknown'
    console.log(`  ${isMapped} ${field.padEnd(40)} [${types}]`)
  }

  // Output JSON for programmatic use
  console.log('\n' + '='.repeat(80))
  console.log('MISSING FIELDS DETAILS (JSON)')
  console.log('='.repeat(80))
  console.log(
    JSON.stringify(
      {
        summary: {
          totalRecords: analysis.totalRecords,
          totalZohoFields: analysis.allFields.size,
          currentlyMappedFields: analysis.currentlyMappedFields.length,
          missingFieldsCount: analysis.missingFields.length,
        },
        missingFields: analysis.missingFields.map((field) => ({
          name: field,
          types: Array.from(analysis.fieldTypes[field] || new Set()),
          samples: analysis.fieldSamples[field] || [],
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
