"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarDays, Clock } from "lucide-react";

type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  service: { name: string; durationMin: number | null };
  variant: { name: string; durationMin: number } | null;
  customer: { id: string; name: string | null; email: string; image: string | null } | null;
  payments: { id: string; status: string; amountCents: number; currency: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PENDING:   { label: "Pendiente",  badge: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30" },
  CONFIRMED: { label: "Confirmada", badge: "bg-blue-500/20  text-blue-300  ring-1 ring-blue-500/30"  },
  COMPLETED: { label: "Completada", badge: "bg-green-500/20 text-green-300 ring-1 ring-green-500/30" },
  CANCELLED: { label: "Cancelada",  badge: "bg-red-500/20   text-red-300   ring-1 ring-red-500/30"   },
  NO_SHOW:   { label: "No asistió", badge: "bg-zinc-500/20  text-zinc-300  ring-1 ring-zinc-500/30"  },
};

const PAY_STATUS: Record<string, { label: string; style: string }> = {
  PAID:             { label: "Pagado",      style: "bg-green-500/20 text-green-300" },
  PARTIAL:          { label: "Parcial",     style: "bg-amber-500/20 text-amber-300" },
  PROCESSING:       { label: "Procesando",  style: "bg-blue-500/20 text-blue-300" },
  REQUIRES_PAYMENT: { label: "Sin pagar",   style: "bg-white/10 text-white/50" },
  AUTHORIZED:       { label: "Autorizado",  style: "bg-indigo-500/20 text-indigo-300" },
  FAILED:           { label: "Fallido",     style: "bg-red-500/20 text-red-300" },
  REFUNDED:         { label: "Reembolsado", style: "bg-zinc-500/20 text-zinc-300" },
  CANCELED:         { label: "Cancelado",   style: "bg-zinc-500/20 text-zinc-300" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function calcDuration(startAt: string, endAt: string) {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

export default function StaffAppointmentsPage() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter === "upcoming") params.set("upcoming", "true");
    if (statusFilter !== "all") params.set("status", statusFilter);

    setLoading(true);
    fetch(`/api/staff/appointments?${params}`)
      .then((r) => r.json())
      .then((d) => setAppointments(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-ap-copper" /> Mis Citas
        </h1>
        <p className="text-white/60 mt-1 text-sm">Citas asignadas a tu perfil</p>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Toggle próximas / todas */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setFilter("upcoming")}
              className={`px-4 py-2 text-sm font-medium transition ${filter === "upcoming" ? "bg-ap-copper text-white" : "text-white/60 hover:text-white bg-white/5"}`}
            >
              Próximas
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-sm font-medium transition ${filter === "all" ? "bg-ap-copper text-white" : "text-white/60 hover:text-white bg-white/5"}`}
            >
              Todas
            </button>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 text-white px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20 transition"
          >
            <option value="all" className="bg-[#1a1919]">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k} className="bg-[#1a1919]">{v.label}</option>
            ))}
          </select>

          <span className="text-xs text-white/40 ml-auto">
            {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/40 text-sm">
          Cargando citas...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/40 text-sm">
          No hay citas {filter === "upcoming" ? "próximas" : ""} con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const sc = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.PENDING;
            const pay = appt.payments[0];
            const payInfo = pay ? (PAY_STATUS[pay.status] ?? { label: pay.status, style: "bg-white/10 text-white/50" }) : null;
            const durationMin = calcDuration(appt.startAt, appt.endAt);
            const clientName = appt.customer?.name ?? appt.customerName ?? "Sin nombre";
            const clientEmail = appt.customer?.email ?? appt.customerEmail ?? "—";
            const clientPhone = appt.customerPhone;

            return (
              <div
                key={appt.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/8 transition"
              >
                {/* Primera fila: fecha/hora + status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">{formatDate(appt.startAt)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/50">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(appt.startAt)} – {formatTime(appt.endAt)}</span>
                      <span className="text-white/25">·</span>
                      <span>{durationMin} min</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold self-start sm:self-auto ${sc.badge}`}>
                    {sc.label}
                  </span>
                </div>

                {/* Segunda fila: detalles en grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Servicio + variante */}
                  <div className="flex items-start gap-2.5">
                    <span className="text-white/30 text-base mt-0.5 shrink-0">✂️</span>
                    <div>
                      <p className="text-sm font-medium text-white/90 leading-tight">{appt.service.name}</p>
                      {appt.variant && (
                        <p className="text-[11px] text-white/45 mt-0.5 leading-tight">◆ {appt.variant.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Cliente */}
                  <div className="flex items-start gap-2.5">
                    <span className="text-white/30 text-base mt-0.5 shrink-0">👤</span>
                    <div>
                      <p className="text-sm font-medium text-white/90 leading-tight">{clientName}</p>
                      <p className="text-xs text-white/40 mt-0.5">{clientEmail}</p>
                      {clientPhone && (
                        <a
                          href={`tel:${clientPhone}`}
                          className="text-xs text-white/40 hover:text-white/70 transition mt-0.5 block"
                        >
                          {clientPhone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pago */}
                  {pay && payInfo && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-white/30 text-base shrink-0">💳</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          €{(pay.amountCents / 100).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${payInfo.style}`}>
                          {payInfo.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notas */}
                  {appt.notes && (
                    <div className="sm:col-span-2 rounded-xl bg-white/5 px-3 py-2">
                      <p className="text-xs text-white/50 italic">"{appt.notes}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
