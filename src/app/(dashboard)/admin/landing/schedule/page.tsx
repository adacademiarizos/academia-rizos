import { db } from "@/lib/db";
import ScheduleEditor from "./ScheduleEditor";

const DEFAULT_HOURS = [
  { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 1, isOpen: true,  openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 2, isOpen: true,  openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 3, isOpen: true,  openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 4, isOpen: true,  openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 5, isOpen: true,  openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "18:00" },
];

function normalizeHoursWithIds(
  hours: Array<{ id: string; dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }>
) {
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  return DEFAULT_HOURS.map((base) => {
    const existing = byDay.get(base.dayOfWeek);
    if (existing) return existing;
    return {
      id: `missing-${base.dayOfWeek}`,
      ...base,
    };
  });
}

export default async function LandingSchedulePage() {
  const count = await db.businessHours.count();
  if (count === 0) {
    await db.businessHours.createMany({ data: DEFAULT_HOURS });
  }

  const [hours, offDaysRaw] = await Promise.all([
    db.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } }),
    db.businessOffDay.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
    }),
  ]);

  const normalizedHours = normalizeHoursWithIds(hours);
  const offDays = offDaysRaw.map((d) => ({ ...d, date: d.date.toISOString() }));

  return <ScheduleEditor initialHours={normalizedHours} initialOffDays={offDays} />;
}
