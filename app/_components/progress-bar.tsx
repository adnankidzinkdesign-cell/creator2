'use client'

import { useEffect, useState } from 'react'

export function ProgressBar() {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    let timeoutId: NodeJS.Timeout

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href && !link.target && !link.download) {
        const href = link.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('mailto:')) {
          setIsVisible(true)
          setProgress(10)
          interval = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 90) return 90
              return prev + Math.random() * 30
            })
          }, 200)

          // Auto-complete after 2 seconds (for Next.js client-side routing)
          timeoutId = setTimeout(() => {
            clearInterval(interval)
            setProgress(100)
            setTimeout(() => {
              setIsVisible(false)
              setProgress(0)
            }, 300)
          }, 2000)
        }
      }
    }

    document.addEventListener('click', handleLinkClick)

    return () => {
      document.removeEventListener('click', handleLinkClick)
      clearInterval(interval)
      clearTimeout(timeoutId)
    }
  }, [])

  return (
    <div
      className="fixed top-[68px] left-0 right-0 h-1 bg-red-500 transition-all duration-300 z-30"
      style={{
        width: isVisible ? `${progress}%` : '0%',
        opacity: isVisible ? 1 : 0,
      }}
    />
  )
}
