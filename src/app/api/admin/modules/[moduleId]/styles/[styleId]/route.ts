import { NextResponse } from 'next/server'

const message = 'Los estilos pertenecen directamente al curso y no se pueden gestionar dentro de un módulo.'

export async function PUT() {
  return NextResponse.json({ success: false, error: message }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: message }, { status: 410 })
}
