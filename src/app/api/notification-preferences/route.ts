import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { NotificationPreferenceCategory } from "@prisma/client";

import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";

const preferenceCategories = [
  NotificationPreferenceCategory.COURSE_UPDATES,
  NotificationPreferenceCategory.COMMUNITY,
  NotificationPreferenceCategory.ACHIEVEMENTS,
] as const;

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }

  return db.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
}

/**
 * Returns only optional categories. Transactional, appointment, security and
 * review notifications intentionally do not have user-controllable settings.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await db.notificationPreference.findMany({
      where: { userId: user.id },
      select: { category: true, enabled: true },
    });
    const enabledByCategory = new Map(preferences.map((preference) => [preference.category, preference.enabled]));

    return NextResponse.json({
      success: true,
      data: preferenceCategories.map((category) => ({
        category,
        enabled: enabledByCategory.get(category) ?? true,
      })),
    });
  } catch (error) {
    console.error("[notification-preferences] unable to fetch preferences", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notification preferences" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !preferenceCategories.includes((body as { category?: NotificationPreferenceCategory }).category as NotificationPreferenceCategory) ||
      typeof (body as { enabled?: unknown }).enabled !== "boolean"
    ) {
      return NextResponse.json({ success: false, error: "Invalid preference" }, { status: 400 });
    }

    const { category, enabled } = body as {
      category: NotificationPreferenceCategory;
      enabled: boolean;
    };
    const preference = await db.notificationPreference.upsert({
      where: {
        userId_category: {
          userId: user.id,
          category,
        },
      },
      create: { userId: user.id, category, enabled },
      update: { enabled },
      select: { category: true, enabled: true },
    });

    return NextResponse.json({ success: true, data: preference });
  } catch (error) {
    console.error("[notification-preferences] unable to update preference", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification preference" },
      { status: 500 },
    );
  }
}
