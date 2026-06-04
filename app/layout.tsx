import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Geist, Geist_Mono } from 'next/font/google'
import { NavLink } from './_components/nav-link'
import logo from '../assets/KIDZINK LOGO RED.png'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Kidzink Dashboard',
  description: 'Furniture catalog and analytics',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-tremor-content-strong">
        <nav className="sticky top-0 z-20 w-full px-0 pt-0">
          <div className="dashboard-shell dashboard-drop-header border-x-0 border-t-0">
            <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center px-1">
                <Image
                  src={logo}
                  alt="Kidzink"
                  className="h-10 w-[8.75rem] object-contain sm:w-[10.5rem]"
                  priority
                />
              </Link>
              <div className="flex items-center gap-6 px-1">
                <NavLink href="/">Catalog</NavLink>
                <NavLink href="/boq">BOQ</NavLink>
                <NavLink href="/pending">Pending</NavLink>
                <a
                  href="https://creatorapp.zoho.com/paolo_kidzinkdesign/product-base-range/#Form:Furniture_Items_List"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-tremor-content-strong transition-colors hover:text-[#e43c2f]"
                >
                  Add items
                </a>
                <NavLink href="/settings">Settings</NavLink>
              </div>
            </div>
          </div>
        </nav>
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1680px]">{children}</div>
        </main>
      </body>
    </html>
  )
}
