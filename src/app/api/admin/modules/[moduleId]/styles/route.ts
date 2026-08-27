import { NextResponse } from 'next/server'

const message = 'Los estilos pertenecen directamente al curso y no se pueden gestionar dentro de un módulo.'

export async function GET() {
  return NextResponse.json({ success: false, error: message }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ success: false, error: message }, { status: 410 })
}
