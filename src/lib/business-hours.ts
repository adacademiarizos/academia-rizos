/**
 * A single source of truth for the salon's opening hours.
 *
 * The hours used to live in three places at once: the BusinessHours table shown
 * on the schedule page, and two free-text lines in ContactContent rendered in
 * the footers. They drifted apart and the site ended up advertising three
 * different timetables. Everything that shows salon hours now formats them from
 * this table instead, so editing them in the admin changes them everywhere.
 */

import { db } from "@/lib/db";

const DAY_NAMES_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

type Row = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

/** Monday first, Sunday last — the order a Spanish reader expects. */
function weekOrder(rows: Row[]) {
  return [...rows.filter((r) => r.dayOfWeek !== 0), ...rows.filter((r) => r.dayOfWeek === 0)];
}

function sameHours(a: Row, b: Row) {
  return a.isOpen === b.isOpen && a.openTime === b.openTime && a.closeTime === b.closeTime;
}

function rangeLabel(from: Row, to: Row) {
  return from.dayOfWeek === to.dayOfWeek
    ? DAY_NAMES_ES[from.dayOfWeek]
    : `${DAY_NAMES_ES[from.dayOfWeek]} - ${DAY_NAMES_ES[to.dayOfWeek]}`;
}

/**
 * Collapses consecutive days that share the same hours into one line, so a
 * regular week reads "Lunes - Viernes: 10:00 - 20:00" instead of five rows.
 */
export function formatBusinessHoursLines(rows: Row[]): string[] {
  const ordered = weekOrder(rows);
  if (ordered.length === 0) return [];

  const lines: string[] = [];
  let groupStart = ordered[0];
  let groupEnd = ordered[0];

  const flush = () => {
    const label = rangeLabel(groupStart, groupEnd);
    lines.push(
      groupStart.isOpen
        ? `${label}: ${groupStart.openTime} - ${groupStart.closeTime}`
        : `${label}: cerrado`
    );
  };

  for (const row of ordered.slice(1)) {
    if (sameHours(row, groupEnd)) {
      groupEnd = row;
      continue;
    }
    flush();
    groupStart = row;
    groupEnd = row;
  }
  flush();

  return lines;
}

export async function getBusinessHoursLines(): Promise<string[]> {
  try {
    const rows = await db.businessHours.findMany({
      orderBy: { dayOfWeek: "asc" },
      select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
    });
    return formatBusinessHoursLines(rows);
  } catch (error) {
    console.error("Error loading business hours:", error);
    return [];
  }
}
