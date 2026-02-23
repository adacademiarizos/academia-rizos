"use client";

import { useEffect, useState } from "react";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TimeSlotPicker({
  serviceId,
  staffId,
  date,
  selectedSlot,
  onSelect,
}: {
  serviceId: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceId || !staffId || !date) return;
    setLoading(true);
    setSlots([]);

    fetch(
      `/api/availability?serviceId=${encodeURIComponent(serviceId)}&staffId=${encodeURIComponent(staffId)}&date=${encodeURIComponent(date)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j) => { if (j.ok) setSlots(j.data?.slots ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serviceId, staffId, date]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 mt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return <p className="text-xs text-white/40 mt-3">No hay horarios disponibles para este día.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-3 sm:grid-cols-4">
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onSelect(slot)}
          className={`rounded-xl py-2.5 text-xs font-semibold transition
            ${selectedSlot === slot
              ? "bg-[#646a40] text-white ring-2 ring-[#646a40]/60"
              : "bg-white/5 text-white/75 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
            }`}
        >
          {fmt(slot)}
        </button>
      ))}
    </div>
  );
}
