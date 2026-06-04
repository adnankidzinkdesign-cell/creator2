import { loadEnvFile } from 'node:process'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'furniture-images'
const CONCURRENCY = 4

type FurnitureImageRow = {
  id: string
  raw: Record<string, unknown>
}

type RuntimeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string
  ZOHO_API_BASE: string
}

function rawImagePath(row: FurnitureImageRow): string | null {
  const value = row.raw.Image
  return typeof value === 'string' && value.trim() ? value : null
}

function rawImagePaths(row: FurnitureImageRow): string[] {
  const paths: string[] = []
  const singleImage = rawImagePath(row)
  if (singleImage) paths.push(singleImage)

  const multiImage = row.raw.Image1
  if (Array.isArray(multiImage)) {
    paths.push(
      ...multiImage.filter(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      ),
    )
  } else if (typeof multiImage === 'string' && multiImage.trim()) {
    paths.push(multiImage)
  }

  return [...new Set(paths)]
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return 'jpg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

function publicUrl(path: string, runtimeEnv: RuntimeEnv): string {
  return `${runtimeEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

function zohoDownloadUrl(imagePath: string, runtimeEnv: RuntimeEnv): string {
  const apiPath = imagePath.replace('/api/v2.1/', '/creator/v2.1/data/')
  return `${runtimeEnv.ZOHO_API_BASE}${apiPath}`
}

async function syncRow(
  row: FurnitureImageRow,
  accessToken: string,
  supabase: SupabaseClient,
  runtimeEnv: RuntimeEnv,
): Promise<'synced' | 'skipped'> {
  const imagePaths = rawImagePaths(row)
  if (imagePaths.length === 0) return 'skipped'

  const storagePaths: string[] = []
  for (const [imageIndex, imagePath] of imagePaths.entries()) {
    const response = await fetch(zohoDownloadUrl(imagePath, runtimeEnv), {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Zoho image fetch failed for ${row.id}: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const extension = extensionFromContentType(contentType)
    const suffix = imageIndex === 0 ? 'primary' : `gallery-${imageIndex}`
    const storagePath = `${row.id}/${suffix}.${extension}`
    const buffer = Buffer.from(await response.arrayBuffer())
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      })

    if (upload.error) {
      throw new Error(`Supabase upload failed for ${row.id}: ${upload.error.message}`)
    }

    storagePaths.push(storagePath)
  }

  const imageUrls = storagePaths.map((path) => publicUrl(path, runtimeEnv))
  const update = await supabase
    .from('mirror_furniture_items')
    .update({
      image_storage_path: storagePaths[0] ?? null,
      image_url: imageUrls[0] ?? null,
      image_storage_paths: storagePaths,
      image_urls: imageUrls,
      image_synced_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (update.error) {
    throw new Error(`Image row update failed for ${row.id}: ${update.error.message}`)
  }

  return 'synced'
}

async function main() {
  loadEnvFile('.env.local')
  const { createAdminClient } = await import('../lib/supabase/admin')
  const { getAccessToken } = await import('../lib/zoho/auth')
  const { env } = await import('../lib/env')

  const supabase = createAdminClient()
  const runtimeEnv: RuntimeEnv = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    ZOHO_API_BASE: env.ZOHO_API_BASE,
  }
  const { data, error } = await supabase
    .from('mirror_furniture_items')
    .select('id, raw')

  if (error) {
    throw new Error(`Failed to load image rows: ${error.message}`)
  }

  const rows = ((data ?? []) as FurnitureImageRow[]).filter(
    (row) => rawImagePaths(row).length > 0,
  )
  const accessToken = await getAccessToken()
  let synced = 0
  let skipped = 0
  let failed = 0

  for (let index = 0; index < rows.length; index += CONCURRENCY) {
    const batch = rows.slice(index, index + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((row) => syncRow(row, accessToken, supabase, runtimeEnv)),
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value === 'synced') synced += 1
        else skipped += 1
      } else {
        failed += 1
        console.error(result.reason instanceof Error ? result.reason.message : result.reason)
      }
    }
  }

  console.log(JSON.stringify({ scanned: rows.length, synced, skipped, failed }, null, 2))
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
