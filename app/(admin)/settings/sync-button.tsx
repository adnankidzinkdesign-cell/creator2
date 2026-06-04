'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@tremor/react'
import { triggerCrmDealsSync, triggerFurnitureSync, type SyncResult } from './actions'

type SyncButtonProps = {
  source: 'furniture' | 'crm-deals'
}

export function SyncButton({ source }: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncResult | null>(null)
  const label = source === 'crm-deals' ? 'Sync deals' : 'Sync now'

  useEffect(() => {
    if (!result || !result.success) return
    const timer = setTimeout(() => setResult(null), 5000)
    return () => clearTimeout(timer)
  }, [result])

  const handleClick = () => {
    setResult(null)
    startTransition(async () => {
      const next =
        source === 'crm-deals'
          ? await triggerCrmDealsSync()
          : await triggerFurnitureSync()
      setResult(next)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleClick}
        loading={isPending}
        disabled={isPending}
        className="rounded-full border border-[rgba(228,60,47,0.2)] bg-[#e43c2f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c93226]"
      >
        {isPending ? 'Syncing...' : label}
      </Button>
      {result?.success && (
        <span className="text-sm text-emerald-700">
          Synced {result.synced} record{result.synced === 1 ? '' : 's'} in {result.duration_ms}ms
        </span>
      )}
      {result && !result.success && (
        <span className="text-sm text-red-700">
          Error: {result.error}
        </span>
      )}
    </div>
  )
}
