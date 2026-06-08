'use client'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isDangerous?: boolean
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="mx-auto w-full max-w-md rounded-[22px] bg-white shadow-xl overflow-hidden">
          <div className="bg-white px-6 py-4 rounded-t-[22px]">
            <h2 className="text-lg font-semibold text-tremor-content-strong">
              {title}
            </h2>
          </div>

          <div className="px-6 py-6">
            <p className="text-tremor-content">
              {message}
            </p>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-[22px]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-tremor-border bg-white px-4 py-2 text-sm font-medium text-tremor-content-strong hover:bg-gray-100 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors ${
                isDangerous
                  ? 'bg-red-500 hover:bg-red-600 border border-red-600'
                  : 'bg-[#e43c2f] hover:bg-[#c93226] border border-[rgba(228,60,47,0.22)]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
