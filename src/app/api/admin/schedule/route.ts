import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const DEFAULT_HOURS = [
  { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "18:00" }, // Sun
  { dayOfWeek: 1, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Mon
  { dayOfWeek: 2, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Tue
  { dayOfWeek: 3, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Wed
  { dayOfWeek: 4, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Thu
  { dayOfWeek: 5, isOpen: true,  openTime: "09:00", closeTime: "18:00" }, // Fri
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "18:00" }, // Sat
];

type HoursInput = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

function normalizeWeeklyHours(raw: unknown): HoursInput[] {
  const source = Array.isArray(raw) ? raw : [];
  const byDay = new Map<number, HoursInput>();

  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const h = entry as Partial<HoursInput>;
    if (
      typeof h.dayOfWeek !== "number" ||
      h.dayOfWeek < 0 ||
      h.dayOfWeek > 6 ||
      typeof h.isOpen !== "boolean" ||
      typeof h.openTime !== "string" ||
      typeof h.closeTime !== "string"
    ) {
      continue;
    }
    byDay.set(h.dayOfWeek, {
      dayOfWeek: h.dayOfWeek,
      isOpen: h.isOpen,
      openTime: h.openTime,
      closeTime: h.closeTime,
    });
  }

  return DEFAULT_HOURS.map((base) => byDay.get(base.dayOfWeek) ?? base);
}

export async function GET() {
  // Auto-seed if no rows exist
  const count = await db.businessHours.count();
  if (count === 0) {
    await db.businessHours.createMany({ data: DEFAULT_HOURS });
  }

  const [hours, offDays] = await Promise.all([
    db.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } }),
    db.businessOffDay.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
  ]);

  const normalizedHours = normalizeWeeklyHours(hours);

  await Promise.all(
    normalizedHours.map((h) =>
      db.businessHours.upsert({
        where: { dayOfWeek: h.dayOfWeek },
        create: h,
        update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
      })
    )
  );

  const persistedHours = await db.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  return NextResponse.json({ ok: true, data: { hours: persistedHours, offDays } });
}

export async function PUT(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { hours } = body as { hours?: unknown };
  if (!Array.isArray(hours) || hours.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PAYLOAD", message: "hours must be a non-empty array" } },
      { status: 400 }
    );
  }

  const normalizedHours = normalizeWeeklyHours(hours);

  await Promise.all(
    normalizedHours.map((h) =>
      db.businessHours.upsert({
        where: { dayOfWeek: h.dayOfWeek },
        create: h,
        update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/horarios");
  revalidatePath("/admin/schedule");
  return NextResponse.json({ ok: true });
}
