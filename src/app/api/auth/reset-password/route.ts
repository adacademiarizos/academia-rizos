import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  INVALID_RESET_PASSWORD_MESSAGE,
  ResetPasswordSchema,
} from "@/lib/password-reset";
import {
  InvalidPasswordResetTokenError,
  passwordResetService,
} from "@/server/services/password-reset-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = ResetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error.issues[0]?.message ?? "Datos invalidos",
        },
        { status: 400 }
      );
    }

    const result = await passwordResetService.resetPassword({
      token: validation.data.token,
      password: validation.data.password,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      return NextResponse.json(
        {
          success: false,
          message: INVALID_RESET_PASSWORD_MESSAGE,
        },
        { status: 400 }
      );
    }

    console.error("[reset-password] request failed", error);

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
        message: "No pudimos actualizar tu contrasena en este momento.",
      },
      { status: 500 }
    );
  }
}
