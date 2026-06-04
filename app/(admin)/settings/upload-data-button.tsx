'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@tremor/react'
import { uploadFurnitureData, type UploadDataResult } from './actions'

export function UploadDataButton() {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<UploadDataResult | null>(null)

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      const next = await uploadFurnitureData(formData)
      setResult(next)
      if (next.success && next.errors.length === 0) {
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
          <span>Items Excel</span>
          <input
            name="items"
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm text-tremor-content file:mr-3 file:rounded-tremor-default file:border-0 file:bg-tremor-background-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-tremor-content-strong"
            required
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
          <span>Finishes Excel</span>
          <input
            name="finishes"
            type="file"
            accept=".xlsx,.xls"
            className="block w-full text-sm text-tremor-content file:mr-3 file:rounded-tremor-default file:border-0 file:bg-tremor-background-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-tremor-content-strong"
            required
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isPending} disabled={isPending}>
          {isPending ? 'Uploading...' : 'Upload data'}
        </Button>
        {result?.success && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Uploaded {result.uploaded} of {result.attempted} item
            {result.attempted === 1 ? '' : 's'}
            {result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ''}
          </span>
        )}
        {result && !result.success && (
          <span className="text-sm text-red-600 dark:text-red-400">
            Error: {result.error}
          </span>
        )}
      </div>
      {result?.success && result.errors.length > 0 && (
        <div className="rounded-tremor-default border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {result.errors.slice(0, 5).map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}
    </form>
  )
}
