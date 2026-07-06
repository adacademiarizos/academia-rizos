import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { purgeExpiredGuestAppointments } from "@/server/services/gdpr-service";

function isAuthorized(request: NextRequest) {
  const header = request.headers.get("authorization");
  return Boolean(env.CRON_SECRET && header === `Bearer ${env.CRON_SECRET}`);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await purgeExpiredGuestAppointments({});

    console.info("[gdpr-purge-guests]", {
      processed: result.processed,
      cutoff: result.cutoff.toISOString(),
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      cutoff: result.cutoff.toISOString(),
    });
  } catch (error) {
    console.error("[gdpr-purge-guests]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Guest purge job failed",
      },
      { status: 500 }
    );
  }
}
