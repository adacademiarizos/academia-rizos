"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarDays, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  service: { name: string; durationMin: number };
  customer: { id: string; name: string | null; email: string; image: string | null };
  payments: { id: string; status: string; amountCents: number; currency: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-500/20 text-yellow-400", icon: AlertCircle },
  CONFIRMED: { label: "Confirmada", color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  CANCELLED: { label: "Cancelada", color: "bg-red-500/20 text-red-400", icon: XCircle },
  NO_SHOW: { label: "No asistió", color: "bg-gray-500/20 text-gray-400", icon: XCircle },
  COMPLETED: { label: "Completada", color: "bg-blue-500/20 text-blue-400", icon: CheckCircle },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-ap-copper" /> Mis Citas
        </h1>
        <p className="text-white/60 mt-1 text-sm">Citas asignadas a tu perfil</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm outline-none"
        >
          <option value="all" className="bg-[#1a1a2e]">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k} className="bg-[#1a1a2e]">{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-white/60 text-center py-12">Cargando citas...</div>
      ) : appointments.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-[28px] p-12 text-center text-white/50">
          No hay citas {filter === "upcoming" ? "próximas" : ""} con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const sc = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.PENDING;
            const Icon = sc.icon;
            const paid = appt.payments.find((p) => p.status === "PAID");

            return (
              <div
                key={appt.id}
                className="bg-white/5 border border-white/10 rounded-[24px] p-5 flex flex-col md:flex-row md:items-center gap-4"
              >
                {/* Date/Time */}
                <div className="flex-shrink-0 md:w-44">
                  <div className="text-sm font-semibold text-white capitalize">
                    {formatDate(appt.startAt)}
                  </div>
                  <div className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTime(appt.startAt)} – {formatTime(appt.endAt)}
                  </div>
                </div>

                {/* Service + Customer */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{appt.service.name}</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Cliente: <span className="text-white/80">{appt.customer.name ?? appt.customer.email}</span>
                    <span className="text-white/40 ml-1">· {appt.customer.email}</span>
                  </div>
                  {appt.notes && (
                    <div className="text-xs text-white/40 mt-1 italic">"{appt.notes}"</div>
                  )}
                </div>

                {/* Payment */}
                <div className="flex-shrink-0 text-sm">
                  {paid ? (
                    <span className="text-green-400 font-semibold">
                      €{(paid.amountCents / 100).toFixed(2)} pagado
                    </span>
                  ) : (
                    <span className="text-white/40">Sin pago</span>
                  )}
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sc.color}`}>
                    <Icon className="h-3 w-3" />
                    {sc.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
