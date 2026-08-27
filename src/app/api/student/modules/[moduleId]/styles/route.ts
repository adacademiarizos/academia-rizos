import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Los estilos se consultan desde el curso, no desde un módulo.' },
    { status: 410 }
  )
}
