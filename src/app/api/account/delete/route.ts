import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { deleteFile } from "@/lib/storage";
import { db } from "@/lib/db";
import { sendAccountDeletionConfirmationEmail } from "@/lib/mail";
import { processAccountDeletion } from "@/server/services/gdpr-service";

const deleteSchema = z.object({
  requestId: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

function clearAuthCookies(response: NextResponse) {
  const cookieNames = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
  ];

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = deleteSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const result = await processAccountDeletion({
      userId: session.user.id,
      requestId: payload.data.requestId,
      password: payload.data.password,
      token: payload.data.token,
      reason: payload.data.reason,
      prisma: db,
      deleteObject: deleteFile,
      sendConfirmationEmail: sendAccountDeletionConfirmationEmail,
    });

    const response = NextResponse.json({
      success: true,
      data: result,
      message: result.alreadyDeleted
        ? "La cuenta ya estaba anonimizada."
        : "Tu cuenta y tus datos personales fueron anonimizados.",
    });

    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error("[account/delete]", error);
    const message =
      error instanceof Error ? error.message : "Could not delete account";
    const status =
      /password|token|confirmation/i.test(message)
        ? 400
        : /not found/i.test(message)
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
