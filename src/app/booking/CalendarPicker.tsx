"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPicker({
  serviceId,
  staffId,
  selectedDate,
  onSelectDate,
}: {
  serviceId: string;
  staffId: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [closedDaysOfWeek, setClosedDaysOfWeek] = useState<Set<number>>(new Set());

  // Fetch business hours once to know which days of week are always closed
  useEffect(() => {
    fetch("/api/schedule", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const closed = new Set<number>(
          (j.data?.businessHours ?? [])
            .filter((h: { isOpen: boolean }) => !h.isOpen)
            .map((h: { dayOfWeek: number }) => h.dayOfWeek)
        );
        setClosedDaysOfWeek(closed);
      })
      .catch(() => {});
  }, []);

  // Fetch available days whenever service/staff/month changes
  useEffect(() => {
    if (!serviceId || !staffId) return;
    setLoading(true);
    setAvailableDates(new Set());

    fetch(
      `/api/availability/days?serviceId=${encodeURIComponent(serviceId)}&staffId=${encodeURIComponent(staffId)}&year=${year}&month=${month + 1}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setAvailableDates(new Set(j.data.availableDates as string[]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serviceId, staffId, year, month]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  // Disable prev if current month <= today's month
  const canGoPrev = !(year === today.getFullYear() && month === today.getMonth());
  // Disable next if we'd go past maxDate month
  const canGoNext = !(year === maxDate.getFullYear() && month === maxDate.getMonth());

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="h-8 w-8 flex items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-white">
          {MONTHS_LABEL[month]} {year}
          {loading && <span className="ml-2 text-xs text-white/40">cargando…</span>}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className="h-8 w-8 flex items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_LABEL.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-white/30 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;

          const date = new Date(year, month, day);
          const ymd = toYMD(date);
          const isPast = date <= today;
          const isBeyond = date > maxDate;
          const isClosed = closedDaysOfWeek.has(date.getDay());
          const isAvailable = !isPast && !isBeyond && !isClosed && availableDates.has(ymd);
          const isSelected = selectedDate === ymd;
          const isDisabled = isPast || isBeyond || isClosed || (!loading && !isAvailable);

          return (
            <button
              key={ymd}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(ymd)}
              className={`aspect-square w-full rounded-xl text-xs font-medium transition
                ${isSelected
                  ? "bg-[#646a40] text-white ring-2 ring-[#646a40]"
                  : isAvailable
                  ? "text-white hover:bg-white/10"
                  : "text-white/25 cursor-not-allowed"
                }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
