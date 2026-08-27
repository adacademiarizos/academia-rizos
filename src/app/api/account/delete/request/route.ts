import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendAccountDeletionVerificationEmail } from "@/lib/mail";
import { createAccountDeletionRequest } from "@/server/services/gdpr-service";

const requestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        deletedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (user.deletedAt) {
      return NextResponse.json({
        success: true,
        alreadyDeleted: true,
        message: "La cuenta ya habia sido anonimizada previamente.",
      });
    }

    const result = await createAccountDeletionRequest({
      user,
      reason: payload.data.reason,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      sendVerificationEmail: sendAccountDeletionVerificationEmail,
    });

    return NextResponse.json({
      success: true,
      data: {
        requestId: result.requestId,
        confirmationMethod: result.confirmationMethod,
        expiresAt: result.expiresAt?.toISOString() ?? null,
      },
      message:
        result.confirmationMethod === "password"
          ? "Confirma tu contrasena para continuar con la eliminacion."
          : "Te enviamos un enlace de confirmacion a tu email.",
    });
  } catch (error) {
    console.error("[account/delete/request]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create deletion request",
      },
      { status: 500 }
    );
  }
}
