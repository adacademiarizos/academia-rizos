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

  return NextResponse.json({ ok: true, data: { hours, offDays } });
}

export async function PUT(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { hours } = body as {
    hours?: Array<{ dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }>;
  };

  if (!Array.isArray(hours) || hours.length !== 7) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PAYLOAD", message: "hours must be an array of 7 entries" } },
      { status: 400 }
    );
  }

  await Promise.all(
    hours.map((h) =>
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
