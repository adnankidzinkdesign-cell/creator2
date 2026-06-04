'use server'

import { revalidatePath } from 'next/cache'
import { syncCrmDeals } from '@/lib/sync/crm-deals'
import { syncFurnitureItems } from '@/lib/sync/furniture-items'
import { uploadFurnitureItemsFromExcel } from '@/lib/zoho/upload-furniture-items'
import { uploadFurnitureItemsFromSingleFile } from '@/lib/zoho/upload-single-file'

export type SyncResult =
  | { success: true; synced: number; duration_ms: number }
  | { success: false; error: string }

export type UploadDataResult =
  | { success: true; attempted: number; uploaded: number; errors: string[] }
  | { success: false; error: string }

export async function triggerFurnitureSync(): Promise<SyncResult> {
  try {
    const result = await syncFurnitureItems()
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true, synced: result.synced, duration_ms: result.duration_ms }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function triggerCrmDealsSync(): Promise<SyncResult> {
  try {
    const result = await syncCrmDeals()
    revalidatePath('/settings')
    return { success: true, synced: result.synced, duration_ms: result.duration_ms }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function uploadFurnitureData(
  formData: FormData,
): Promise<UploadDataResult> {
  try {
    const itemFile = formData.get('items')
    const finishesFile = formData.get('finishes')

    if (!(itemFile instanceof File) || itemFile.size === 0) {
      throw new Error('Choose an items Excel file.')
    }
    if (!(finishesFile instanceof File) || finishesFile.size === 0) {
      throw new Error('Choose a finishes Excel file.')
    }

    const result = await uploadFurnitureItemsFromExcel(itemFile, finishesFile)
    revalidatePath('/settings')
    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function uploadFurnitureDataSingleFile(
  formData: FormData,
): Promise<UploadDataResult> {
  try {
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      throw new Error('Choose an Excel file with Items and Finishes sheets.')
    }

    const result = await uploadFurnitureItemsFromSingleFile(file)
    revalidatePath('/settings')
    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
