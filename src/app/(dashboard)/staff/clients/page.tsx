"use client";

import { useEffect, useState } from "react";
import { Users, Calendar, EuroIcon } from "lucide-react";

type Client = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  appointmentCount: number;
  totalPaidCents: number;
  lastAppointment: string | null;
  appointments: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    service: { name: string };
    payments: { amountCents: number; status: string; currency: string }[];
  }[];
};

export default function StaffClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/staff/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabel: Record<string, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmada",
    CANCELLED: "Cancelada",
    NO_SHOW: "No asistió",
    COMPLETED: "Completada",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-ap-copper" /> Mis Clientes
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Clientes que han agendado citas contigo
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-4">
          <div className="text-xs text-white/50 mb-1">Total clientes</div>
          <div className="text-2xl font-semibold text-white">{clients.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-4">
          <div className="text-xs text-white/50 mb-1">Total citas</div>
          <div className="text-2xl font-semibold text-white">
            {clients.reduce((a, c) => a + c.appointmentCount, 0)}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-white/50 mb-1">Ingresos totales</div>
          <div className="text-2xl font-semibold text-ap-copper">
            €{(clients.reduce((a, c) => a + c.totalPaidCents, 0) / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o email..."
        className="w-full max-w-md bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
      />

      {/* List */}
      {loading ? (
        <div className="text-white/60 text-center py-12">Cargando clientes...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-[28px] p-12 text-center text-white/50">
          No se encontraron clientes.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => (
            <div key={client.id} className="bg-white/5 border border-white/10 rounded-[24px] overflow-hidden">
              {/* Client row */}
              <button
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition"
                onClick={() => setExpanded(expanded === client.id ? null : client.id)}
              >
                {/* Avatar */}
                {client.image ? (
                  <img
                    src={client.image}
                    alt={client.name ?? ""}
                    className="h-10 w-10 rounded-2xl object-cover border border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-2xl bg-ap-copper/20 border border-ap-copper/30 flex items-center justify-center text-sm font-bold text-ap-copper flex-shrink-0">
                    {(client.name ?? client.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {client.name ?? "Sin nombre"}
                  </div>
                  <div className="text-xs text-white/50 truncate">{client.email}</div>
                </div>
                <div className="hidden md:flex items-center gap-6 text-sm flex-shrink-0">
                  <div className="text-center">
                    <div className="text-white font-semibold">{client.appointmentCount}</div>
                    <div className="text-white/40 text-xs">citas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-ap-copper font-semibold">
                      €{(client.totalPaidCents / 100).toFixed(2)}
                    </div>
                    <div className="text-white/40 text-xs">pagado</div>
                  </div>
                  {client.lastAppointment && (
                    <div className="text-center">
                      <div className="text-white/70 text-xs">
                        {new Date(client.lastAppointment).toLocaleDateString("es-ES", {
                          day: "numeric", month: "short",
                        })}
                      </div>
                      <div className="text-white/40 text-xs">última cita</div>
                    </div>
                  )}
                </div>
                <div className="text-white/30 ml-2">
                  {expanded === client.id ? "▲" : "▼"}
                </div>
              </button>

              {/* Expanded appointments */}
              {expanded === client.id && (
                <div className="border-t border-white/10 px-5 pb-5">
                  <div className="text-xs font-semibold text-white/50 uppercase tracking-wider pt-4 pb-2">
                    Historial de citas
                  </div>
                  <div className="space-y-2">
                    {client.appointments.map((appt) => {
                      const paid = appt.payments.find((p) => p.status === "PAID");
                      return (
                        <div key={appt.id} className="flex items-center gap-3 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                          <span className="text-white/70">
                            {new Date(appt.startAt).toLocaleDateString("es-ES", {
                              weekday: "short", day: "numeric", month: "short", year: "numeric",
                            })}
                          </span>
                          <span className="text-white/50">{appt.service.name}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
                            appt.status === "CONFIRMED" || appt.status === "COMPLETED"
                              ? "bg-green-500/20 text-green-400"
                              : appt.status === "CANCELLED"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {statusLabel[appt.status] ?? appt.status}
                          </span>
                          {paid && (
                            <span className="text-ap-copper text-xs font-semibold">
                              €{(paid.amountCents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
