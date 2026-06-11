'use client'

import { useState } from 'react'
import { TableHeaderCell } from '@tremor/react'

export function ResizableHeaderCell({
  children,
  columnKey,
  width,
  onResizeStart,
}: {
  children: React.ReactNode
  columnKey: string
  width: number
  onResizeStart: (column: string, startX: number) => void
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <TableHeaderCell
      className="relative select-none"
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        position: 'relative',
        borderRight: '1px solid #d4c5b9',
        backgroundColor: '#e8ddd3',
        color: '#5c4033',
        fontWeight: '600',
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between w-full h-full px-4 py-3">
        <span className="flex-1 truncate">{children}</span>

        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              bottom: '-28px',
              right: '0',
              padding: '4px 8px',
              backgroundColor: '#1f2937',
              color: 'white',
              fontSize: '12px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          >
            Drag to resize
          </div>
        )}

        <div
          onMouseDown={(e) => {
            e.preventDefault()
            onResizeStart(columnKey, e.clientX)
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            position: 'absolute',
            right: '-4px',
            top: '0',
            bottom: '0',
            width: '8px',
            cursor: 'col-resize',
            userSelect: 'none',
          }}
          className="bg-[#d4c5b9] hover:bg-[#8b7355] opacity-0 hover:opacity-100 transition-opacity"
        />
      </div>
    </TableHeaderCell>
  )
}
