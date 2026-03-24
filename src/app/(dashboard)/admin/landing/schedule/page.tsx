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

  const offDays = offDaysRaw.map((d) => ({ ...d, date: d.date.toISOString() }));

  return <ScheduleEditor initialHours={hours} initialOffDays={offDays} />;
}
