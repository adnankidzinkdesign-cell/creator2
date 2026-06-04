'use client'

import { BarList, Callout, DonutChart, Legend } from '@tremor/react'

/**
 * Tremor 3's interactive components (charts, callout, etc.) use React refs
 * but don't ship a `'use client'` directive themselves — this wrapper makes
 * them callable from server components without crashing the renderer.
 */

export function CategoryBarList({
  data,
}: {
  data: Array<{ name: string; value: number }>
}) {
  return <BarList data={data} className="mt-6" />
}

export function TypeDonut({
  data,
  categories,
}: {
  data: Array<{ name: string; value: number }>
  categories: string[]
}) {
  return (
    <>
      <DonutChart
        className="mt-6 h-48"
        data={data}
        category="value"
        index="name"
        variant="donut"
        showAnimation={false}
      />
      <Legend className="mt-4 justify-center" categories={categories} />
    </>
  )
}

export function NoSyncCallout({ children }: { children: React.ReactNode }) {
  return (
    <Callout title="No sync yet" color="amber" className="mt-3">
      {children}
    </Callout>
  )
}
