import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getAccessToken } from '@/lib/zoho/auth'

function isSafeZohoImagePath(path: string): boolean {
  return (
    path.startsWith('/api/v2.1/') &&
    path.includes('/Image/download') &&
    !path.includes('://')
  )
}

function zohoDownloadUrl(path: string): string {
  return `${env.ZOHO_API_BASE}${path.replace('/api/v2.1/', '/creator/v2.1/data/')}`
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  if (!path || !isSafeZohoImagePath(path)) {
    return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
  }

  const accessToken = await getAccessToken()
  const response = await fetch(zohoDownloadUrl(path), {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  })

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: 'Failed to load Zoho image' },
      { status: response.status || 502 },
    )
  }

  return new NextResponse(response.body, {
    headers: {
      'Cache-Control': 'private, max-age=3600',
      'Content-Type':
        response.headers.get('content-type') ?? 'application/octet-stream',
    },
  })
}
