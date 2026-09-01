import { NextResponse } from 'next/server'

// Retained as a harmless compatibility endpoint for older clients. Styles are
// no longer nested in modules.
export async function GET() {
  return NextResponse.json({ success: true, data: [], videoExpired: false })
}
