"use client";

import { useState } from "react";
import { Trash2, Plus, Save, CheckCircle } from "lucide-react";

type BusinessHours = {
  id: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type BusinessOffDay = {
  id: string;
  date: string;
  reason: string | null;
};

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function ScheduleEditor({
  initialHours,
  initialOffDays,
}: {
  initialHours: BusinessHours[];
  initialOffDays: BusinessOffDay[];
}) {
  const [hours, setHours] = useState<BusinessHours[]>(initialHours);
  const [offDays, setOffDays] = useState<BusinessOffDay[]>(initialOffDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addingOffDay, setAddingOffDay] = useState(false);
  const [offDayError, setOffDayError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateHour(dayOfWeek: number, field: keyof BusinessHours, value: boolean | string) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  }

  async function saveHours() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al guardar");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addOffDay() {
    if (!newDate) {
      setOffDayError("Seleccioná una fecha.");
      return;
    }
    setOffDayError(null);
    setAddingOffDay(true);
    try {
      const res = await fetch("/api/admin/schedule/off-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, reason: newReason || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al agregar");
      setOffDays((prev) => [...prev, json.data]);
      setNewDate("");
      setNewReason("");
    } catch (e: any) {
      setOffDayError(e.message);
    } finally {
      setAddingOffDay(false);
    }
  }

  async function deleteOffDay(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/schedule/off-days?id=${id}`, { method: "DELETE" });
      setOffDays((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function formatOffDayDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  return (
    <div className="space-y-8">
      {/* ── Weekly hours ── */}
      <section className="bg-[#181716] border border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E2A25]">
          <h2 className="text-base font-semibold text-white">Horario semanal</h2>
          <p className="text-xs text-white/40 mt-0.5">Activá los días y definí el rango de atención.</p>
        </div>

        <div className="divide-y divide-[#2E2A25]">
          {hours.map((h) => (
            <div key={h.dayOfWeek} className="flex items-center gap-4 px-5 py-3">
              {/* Day name */}
              <span className="w-24 text-sm font-medium text-white/80">{DAY_NAMES[h.dayOfWeek]}</span>

              {/* Toggle */}
              <button
                onClick={() => updateHour(h.dayOfWeek, "isOpen", !h.isOpen)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  h.isOpen ? "bg-[#B16E34]" : "bg-white/10"
                }`}
                aria-label={h.isOpen ? "Cerrar este día" : "Abrir este día"}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    h.isOpen ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>

              {/* Times */}
              {h.isOpen ? (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={h.openTime}
                    onChange={(e) => updateHour(h.dayOfWeek, "openTime", e.target.value)}
                    className="bg-[#211F1C] border border-[#2E2A25] rounded-lg px-2 py-1 text-sm text-[#FAF4EA] focus:outline-none focus:border-[#B16E34]"
                  />
                  <span className="text-white/40">–</span>
                  <input
                    type="time"
                    value={h.closeTime}
                    onChange={(e) => updateHour(h.dayOfWeek, "closeTime", e.target.value)}
                    className="bg-[#211F1C] border border-[#2E2A25] rounded-lg px-2 py-1 text-sm text-[#FAF4EA] focus:outline-none focus:border-[#B16E34]"
                  />
                </div>
              ) : (
                <span className="text-sm text-white/30 italic">Cerrado</span>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#2E2A25] flex items-center gap-3">
          <button
            onClick={saveHours}
            disabled={saving}
            className="flex items-center gap-2 bg-[#B16E34] hover:bg-[#8F5828] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar horario"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <CheckCircle className="h-4 w-4" /> Guardado
            </span>
          )}
          {saveError && <span className="text-sm text-red-400">{saveError}</span>}
        </div>
      </section>

      {/* ── Off-days ── */}
      <section className="bg-[#181716] border border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E2A25]">
          <h2 className="text-base font-semibold text-white">Días no laborables</h2>
          <p className="text-xs text-white/40 mt-0.5">Fechas específicas en las que el negocio está cerrado.</p>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 border-b border-[#2E2A25]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Fecha</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="bg-[#211F1C] border border-[#2E2A25] rounded-lg px-3 py-2 text-sm text-[#FAF4EA] focus:outline-none focus:border-[#B16E34]"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs text-white/50">Motivo (opcional)</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Ej: Feriado nacional"
                className="bg-[#211F1C] border border-[#2E2A25] rounded-lg px-3 py-2 text-sm text-[#FAF4EA] focus:outline-none focus:border-[#B16E34] placeholder-white/20"
              />
            </div>
            <button
              onClick={addOffDay}
              disabled={addingOffDay}
              className="flex items-center gap-1.5 bg-[#B16E34] hover:bg-[#8F5828] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
            >
              <Plus className="h-4 w-4" />
              {addingOffDay ? "Agregando…" : "Agregar"}
            </button>
          </div>
          {offDayError && <p className="mt-2 text-sm text-red-400">{offDayError}</p>}
        </div>

        {/* List */}
        {offDays.length === 0 ? (
          <div className="px-5 py-6 text-sm text-white/30 italic">
            No hay fechas no laborables programadas.
          </div>
        ) : (
          <ul className="divide-y divide-[#2E2A25]">
            {offDays.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm text-[#FAF4EA] capitalize">
                    {formatOffDayDate(d.date)}
                  </span>
                  {d.reason && (
                    <span className="ml-2 text-xs text-white/40">— {d.reason}</span>
                  )}
                </div>
                <button
                  onClick={() => deleteOffDay(d.id)}
                  disabled={deletingId === d.id}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
