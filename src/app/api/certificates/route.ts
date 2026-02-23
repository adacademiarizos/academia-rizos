/**
 * GET /api/certificates
 * Get all certificates for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get certificates
    const certificates = await db.certificate.findMany({
      where: {
        userId: user.id,
        valid: true,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: certificates.map((cert) => ({
        id: cert.id,
        code: cert.code,
        courseId: cert.course.id,
        courseTitle: cert.course.title,
        issuedAt: cert.issuedAt,
        pdfUrl: cert.pdfUrl,
        verificationUrl: `/verify/certificate/${cert.code}`,
      })),
      count: certificates.length,
    })
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
