"use client";

import { useMemo, useEffect, useState, useRef } from "react";

// ─── tipos ────────────────────────────────────────────────────────────────────
type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

type Row = {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
  service: { id: string; name: string };
  staff: { id: string; name: string | null; email: string };
  customer: { id: string; name: string | null; email: string };
  payments: Array<{ id: string; status: string; amountCents: number; currency: string }>;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function toLocalDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(cents: number, currency: string) {
  const symbol = (currency ?? "EUR").toUpperCase() === "EUR" ? "€" : (currency.toUpperCase() + " ");
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateOfRow(row: Row) {
  const d = new Date(row.startAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── color de status ──────────────────────────────────────────────────────────
const STATUS_STYLES: Record<AppointmentStatus, { badge: string; label: string }> = {
  PENDING:   { badge: "bg-amber-500/20 text-amber-300 ring-amber-500/30",  label: "Pendiente"  },
  CONFIRMED: { badge: "bg-blue-500/20  text-blue-300  ring-blue-500/30",   label: "Confirmada" },
  COMPLETED: { badge: "bg-green-500/20 text-green-300 ring-green-500/30",  label: "Completada" },
  CANCELLED: { badge: "bg-red-500/20   text-red-300   ring-red-500/30",    label: "Cancelada"  },
  NO_SHOW:   { badge: "bg-zinc-500/20  text-zinc-300  ring-zinc-500/30",   label: "No-show"    },
};

const ALL_STATUSES: AppointmentStatus[] = [
  "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW",
];

// ─── patch api ────────────────────────────────────────────────────────────────
async function apiPatch(id: string, status: AppointmentStatus) {
  const res = await fetch(`/api/admin/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al actualizar");
  return json.data;
}

// ─── componente: date picker custom ──────────────────────────────────────────
function DatePicker({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (v: string) => void;
  today: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isToday = value === today;

  function shiftDay(n: number) {
    // parse as local date to avoid UTC offset issues
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    onChange(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
    );
  }

  const [y, mo, d] = value.split("-").map(Number);
  const displayDate = new Date(y, mo - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex items-center rounded-2xl ring-1 ring-white/10 bg-white/5 overflow-hidden h-10">
      {/* flecha izquierda */}
      <button
        onClick={() => shiftDay(-1)}
        className="px-3 h-full text-white/40 hover:text-white hover:bg-white/8 transition text-base leading-none select-none"
        title="Día anterior"
      >
        ‹
      </button>

      {/* fecha + input oculto */}
      <div
        className="relative flex-1 flex items-center justify-center gap-2 cursor-pointer h-full"
        onClick={() => inputRef.current?.showPicker?.()}
      >
        <svg
          className="h-3.5 w-3.5 text-white/30 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="text-sm text-white capitalize">{displayDate}</span>
        {isToday && (
          <span className="rounded-full bg-ap-copper/20 text-ap-copper px-1.5 py-0.5 text-[9px] font-bold tracking-wide leading-none">
            HOY
          </span>
        )}
        {/* input nativo invisible — solo para abrir el calendario del browser */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
          tabIndex={-1}
        />
      </div>

      {/* botón "Hoy" cuando no es hoy */}
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="px-3 h-full text-[10px] font-semibold text-ap-copper hover:bg-white/8 hover:text-orange-400 transition whitespace-nowrap"
        >
          Hoy
        </button>
      )}

      {/* flecha derecha */}
      <button
        onClick={() => shiftDay(1)}
        className="px-3 h-full text-white/40 hover:text-white hover:bg-white/8 transition text-base leading-none select-none"
        title="Día siguiente"
      >
        ›
      </button>
    </div>
  );
}

// ─── componente: status select custom ────────────────────────────────────────
const STATUS_DOT: Record<AppointmentStatus | "ALL", string> = {
  ALL:       "bg-white/30",
  PENDING:   "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  COMPLETED: "bg-green-400",
  CANCELLED: "bg-red-400",
  NO_SHOW:   "bg-zinc-400",
};

const STATUS_OPTIONS: Array<{ value: AppointmentStatus | "ALL"; label: string }> = [
  { value: "ALL",       label: "Todos los estados" },
  { value: "PENDING",   label: "Pendiente"  },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada"  },
  { value: "NO_SHOW",   label: "No-show"    },
];

function StatusSelect({
  value,
  onChange,
}: {
  value: AppointmentStatus | "ALL";
  onChange: (v: AppointmentStatus | "ALL") => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = STATUS_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={wrapRef} className="relative">
      {/* trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 h-10 text-sm text-white ring-1 ring-white/10 hover:ring-white/20 transition"
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[value]}`} />
          <span>{selected.label}</span>
        </div>
        <svg
          className={`h-4 w-4 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl border border-white/10 bg-[#1d1b19] shadow-2xl overflow-hidden">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition
                  ${isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[opt.value]}`} />
                <span className="flex-1">{opt.label}</span>
                {isActive && (
                  <svg className="h-3.5 w-3.5 text-ap-copper shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function AppointmentsTable({ initial }: { initial: Row[] }) {
  const [rows, setRows]             = useState<Row[]>(initial);
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState(todayISO);
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | "ALL">("ALL");
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── filtrado ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // filtro fecha
      if (filterDate && dateOfRow(r) !== filterDate) return false;
      // filtro nombre cliente
      if (filterName.trim()) {
        const name = (r.customer.name ?? r.customer.email).toLowerCase();
        if (!name.includes(filterName.trim().toLowerCase())) return false;
      }
      // filtro status
      if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, filterDate, filterName, filterStatus]);

  // ── cambio de status ──────────────────────────────────────────────────────
  async function setStatus(id: string, status: AppointmentStatus) {
    setBusyId(id);
    try {
      const updated = await apiPatch(id, status);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: updated.status } : r)));
    } catch (e: any) {
      alert(e.message ?? "Error");
    } finally {
      setBusyId(null);
    }
  }

  const today = todayISO();

  return (
    <div className="space-y-5">
      {/* ── BARRA DE FILTROS ─────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <p className="mb-3 text-xs font-semibold text-white/50 uppercase tracking-wide">Filtros</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">

          {/* Nombre */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-white/50">Nombre del cliente</label>
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Buscar por nombre…"
              className="rounded-2xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-white/25"
            />
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs text-white/50">Fecha</label>
            <DatePicker value={filterDate} onChange={setFilterDate} today={today} />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[190px]">
            <label className="text-xs text-white/50">Estado</label>
            <StatusSelect value={filterStatus} onChange={setFilterStatus} />
          </div>

          {/* Reset */}
          <button
            onClick={() => { setFilterName(""); setFilterDate(today); setFilterStatus("ALL"); }}
            className="self-end rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white transition"
          >
            Limpiar
          </button>
        </div>

        {/* resumen de resultados */}
        <p className="mt-3 text-xs text-white/40">
          {filtered.length === 0
            ? "Sin citas para los filtros actuales."
            : `${filtered.length} cita${filtered.length !== 1 ? "s" : ""} encontrada${filtered.length !== 1 ? "s" : ""}`}
          {filterDate === today && (
            <span className="ml-2 rounded-full bg-ap-copper/20 text-ap-copper px-2 py-0.5 text-[10px] font-semibold">HOY</span>
          )}
        </p>
      </div>

      {/* ── CARDS ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl">
          <p className="text-white/40 text-sm">No hay citas para esta búsqueda.</p>
          <button
            onClick={() => { setFilterName(""); setFilterDate(today); setFilterStatus("ALL"); }}
            className="mt-4 text-xs text-ap-copper hover:text-orange-400 transition"
          >
            Ver citas de hoy
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const pay = r.payments?.[0];
            const st = STATUS_STYLES[r.status];
            const busy = busyId === r.id;

            return (
              <div
                key={r.id}
                className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition hover:bg-white/8"
              >
                {/* ── cabecera ── */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${st.badge}`}>
                    {st.label}
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-white">
                      {mounted ? toLocalTime(r.startAt) : "—"}
                      <span className="text-white/40"> → </span>
                      {mounted ? toLocalTime(r.endAt) : "—"}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {mounted ? toLocalDate(r.startAt) : "—"}
                    </p>
                  </div>
                </div>

                {/* ── info ── */}
                <div className="space-y-2 flex-1">
                  {/* cliente */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-white/30 shrink-0">👤</span>
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">
                        {r.customer.name ?? "Sin nombre"}
                      </p>
                      <p className="text-xs text-white/40">{r.customer.email}</p>
                    </div>
                  </div>

                  {/* servicio */}
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 shrink-0">✂️</span>
                    <p className="text-sm text-white/80">{r.service.name}</p>
                  </div>

                  {/* profesional */}
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 shrink-0">💼</span>
                    <p className="text-sm text-white/80">
                      {r.staff.name ?? r.staff.email}
                    </p>
                  </div>

                  {/* pago */}
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 shrink-0">💳</span>
                    {pay ? (
                      <p className="text-sm">
                        <span className="font-semibold text-white">{money(pay.amountCents, pay.currency)}</span>
                        {" "}
                        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                          pay.status === "PAID"
                            ? "bg-green-500/20 text-green-300"
                            : "bg-white/10 text-white/50"
                        }`}>
                          {pay.status}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-white/30">Sin pago registrado</p>
                    )}
                  </div>

                  {/* notas */}
                  {r.notes && (
                    <div className="mt-1 rounded-xl bg-white/5 px-3 py-2">
                      <p className="text-xs text-white/50 italic">{r.notes}</p>
                    </div>
                  )}
                </div>

                {/* ── acciones ── */}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                  {r.status !== "CONFIRMED" && r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                    <ActionBtn disabled={busy} onClick={() => setStatus(r.id, "CONFIRMED")} color="blue">
                      Confirmar
                    </ActionBtn>
                  )}
                  {r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                    <ActionBtn disabled={busy} onClick={() => setStatus(r.id, "COMPLETED")} color="green">
                      Completar
                    </ActionBtn>
                  )}
                  {r.status !== "NO_SHOW" && r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
                    <ActionBtn disabled={busy} onClick={() => setStatus(r.id, "NO_SHOW")} color="zinc">
                      No-show
                    </ActionBtn>
                  )}
                  {r.status !== "CANCELLED" && r.status !== "COMPLETED" && (
                    <ActionBtn disabled={busy} onClick={() => setStatus(r.id, "CANCELLED")} color="red">
                      Cancelar
                    </ActionBtn>
                  )}
                  {(r.status === "COMPLETED" || r.status === "CANCELLED") && (
                    <span className="text-xs text-white/30 self-center">Sin acciones disponibles</span>
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

// ─── botón de acción ──────────────────────────────────────────────────────────
type BtnColor = "blue" | "green" | "red" | "zinc" | "amber";

const BTN_COLORS: Record<BtnColor, string> = {
  blue:  "bg-blue-500/10  text-blue-300  ring-blue-500/20  hover:bg-blue-500/20",
  green: "bg-green-500/10 text-green-300 ring-green-500/20 hover:bg-green-500/20",
  red:   "bg-red-500/10   text-red-300   ring-red-500/20   hover:bg-red-500/20",
  zinc:  "bg-zinc-500/10  text-zinc-300  ring-zinc-500/20  hover:bg-zinc-500/20",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20 hover:bg-amber-500/20",
};

function ActionBtn({
  children,
  disabled,
  onClick,
  color,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  color: BtnColor;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition disabled:opacity-40 ${BTN_COLORS[color]}`}
    >
      {children}
    </button>
  );
}
