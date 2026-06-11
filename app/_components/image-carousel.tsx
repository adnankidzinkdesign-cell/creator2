'use client'

import { useState } from 'react'

const FALLBACK_URL = '/product-images/nope-not-here.png'

export function ImageCarousel({
  alt,
  urls,
  failedUrls,
  onImageError,
}: {
  alt: string
  urls: string[]
  failedUrls: Set<string>
  onImageError: (url: string) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = Math.min(activeIndex, Math.max(urls.length - 1, 0))
  const activeUrl = urls[safeActiveIndex]
  const displayUrl = failedUrls.has(activeUrl || '') ? FALLBACK_URL : activeUrl

  if (!activeUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-tremor-content-subtle">
        <img src={FALLBACK_URL} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <img
        src={displayUrl}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          if (activeUrl) onImageError(activeUrl)
        }}
      />
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => setActiveIndex((i) => (i === 0 ? urls.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-semibold text-tremor-content-strong shadow"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => setActiveIndex((i) => (i + 1) % urls.length)}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-semibold text-tremor-content-strong shadow"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {urls.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`Show image ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={'h-1.5 w-1.5 rounded-full ' + (index === safeActiveIndex ? 'bg-white' : 'bg-white/50')}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
