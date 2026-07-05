import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ForgotPasswordSchema,
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  getRequestIp,
} from "@/lib/password-reset";
import { passwordResetService } from "@/server/services/password-reset-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = ForgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message ?? "Datos invalidos",
        },
        { status: 400 }
      );
    }

    await passwordResetService.requestPasswordReset({
      email: validation.data.email,
      requestIp: getRequestIp(request.headers),
    });

    return NextResponse.json({
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    });
  } catch (error) {
    console.error("[forgot-password] request failed", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: error.issues[0]?.message ?? "Datos invalidos",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "No pudimos procesar tu solicitud en este momento.",
      },
      { status: 500 }
    );
  }
}
