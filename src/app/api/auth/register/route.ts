/**
 * POST /api/auth/register
 * Register a new user with email and password
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'

const RegisterSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = RegisterSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message || 'Datos inválidos',
        },
        { status: 400 }
      )
    }

    const { name, email: rawEmail, password } = validation.data
    const email = rawEmail.toLowerCase().trim()

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Este email ya está registrado',
        },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Cuenta registrada exitosamente',
        data: user,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validación fallida',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error al registrar usuario',
      },
      { status: 500 }
    )
  }
}
