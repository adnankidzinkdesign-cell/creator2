'use client'

export function QuantityStepper({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  const committedValue = Math.max(1, Math.floor(Number(value) || 1))

  return (
    <div
      className="grid h-9 w-28 shrink-0 grid-cols-3 overflow-hidden rounded-full border border-[rgba(228,60,47,0.22)] bg-white/70"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(String(Math.max(1, committedValue - 1)))}
        disabled={committedValue <= 1}
        className="flex items-center justify-center text-base font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        -
      </button>
      <input
        aria-label="Quantity"
        inputMode="numeric"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="min-w-0 border-x border-[rgba(228,60,47,0.16)] bg-transparent text-center text-sm font-medium text-tremor-content-strong outline-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(String(committedValue + 1))}
        className="flex items-center justify-center text-base font-medium text-tremor-content-strong transition-colors hover:bg-white"
      >
        +
      </button>
    </div>
  )
}
