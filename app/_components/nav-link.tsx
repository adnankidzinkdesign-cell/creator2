'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={
        'border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200 ' +
        (isActive
          ? 'border-[#e43c2f] text-tremor-content-strong'
          : 'border-transparent text-tremor-content hover:border-[rgba(46,45,44,0.18)] hover:text-tremor-content-strong')
      }
    >
      {children}
    </Link>
  )
}
