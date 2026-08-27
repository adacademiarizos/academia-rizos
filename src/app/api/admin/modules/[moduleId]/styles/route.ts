import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'

// Styles are now course-level containers, never children of modules.
export async function GET() {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  return NextResponse.json({ success: true, data: [] })
}

export async function POST(_request: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response
  return NextResponse.json({ success: false, error: 'Los estilos se crean directamente en el curso' }, { status: 410 })
}
