export const DEFAULT_ANALYTICS_TIME_ZONE = process.env.ANALYTICS_TIME_ZONE || "Europe/Madrid";
export const MAX_ANALYTICS_RANGE_DAYS = 366;

export type AnalyticsDateRange = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  fromKey: string;
  toKey: string;
  days: number;
  timeZone: string;
};

export type AnalyticsDateRangeResult =
  | { ok: true; value: AnalyticsDateRange }
  | { ok: false; error: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function getDateParts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => Number(values.find((item) => item.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  ) + date.getUTCMilliseconds();
  return localAsUtc - date.getTime();
}

function toZonedUtc(dateKey: string, endOfDay: boolean, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  let result = new Date(localAsUtc - getTimeZoneOffset(new Date(localAsUtc), timeZone));
  const correctedOffset = getTimeZoneOffset(result, timeZone);
  result = new Date(localAsUtc - correctedOffset);

  return result;
}

function asUtcCalendarDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = asUtcCalendarDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function isCalendarDate(dateKey: string) {
  if (!DATE_KEY.test(dateKey)) return false;
  const date = asUtcCalendarDate(dateKey);
  return toDateKey(date) === dateKey;
}

export function getCurrentDateKey(now = new Date(), timeZone = DEFAULT_ANALYTICS_TIME_ZONE) {
  const parts = getDateParts(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function parseAnalyticsDateRange(
  fromInput?: string | null,
  toInput?: string | null,
  now = new Date(),
  timeZone = DEFAULT_ANALYTICS_TIME_ZONE
): AnalyticsDateRangeResult {
  const toKey = toInput || getCurrentDateKey(now, timeZone);
  const fromKey = fromInput || shiftDateKey(toKey, -29);

  if (!isCalendarDate(fromKey) || !isCalendarDate(toKey)) {
    return { ok: false, error: "Fechas inválidas. Usa el formato YYYY-MM-DD." };
  }

  const fromCalendar = asUtcCalendarDate(fromKey);
  const toCalendar = asUtcCalendarDate(toKey);
  if (fromCalendar > toCalendar) {
    return { ok: false, error: "La fecha inicial no puede ser posterior a la final." };
  }

  const days = Math.floor((toCalendar.getTime() - fromCalendar.getTime()) / 86_400_000) + 1;
  if (days > MAX_ANALYTICS_RANGE_DAYS) {
    return { ok: false, error: `El rango máximo es de ${MAX_ANALYTICS_RANGE_DAYS} días.` };
  }

  const previousToKey = shiftDateKey(fromKey, -1);
  const previousFromKey = shiftDateKey(previousToKey, -(days - 1));

  return {
    ok: true,
    value: {
      from: toZonedUtc(fromKey, false, timeZone),
      to: toZonedUtc(toKey, true, timeZone),
      previousFrom: toZonedUtc(previousFromKey, false, timeZone),
      previousTo: toZonedUtc(previousToKey, true, timeZone),
      fromKey,
      toKey,
      days,
      timeZone,
    },
  };
}
