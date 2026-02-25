"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import StaffCards from "./StaffCards";
import CalendarPicker from "./CalendarPicker";
import TimeSlotPicker from "./TimeSlotPicker";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
  depositPct: number | null;
  imageUrls: string[];
};

type StaffMember = {
  staffId: string;
  name: string | null;
  photoUrl: string | null;
  priceCents: number;
  currency: string;
};

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

function SectionCard({
  step,
  title,
  active,
  children,
}: {
  step: number;
  title: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 backdrop-blur-xl transition-opacity duration-300
        ${active ? "border-white/10 bg-white/5 opacity-100" : "border-white/5 bg-white/[0.03] opacity-40 pointer-events-none"}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition
            ${active ? "bg-[#646a40] text-white ring-[#646a40]/40" : "bg-white/5 text-white/40 ring-white/10"}`}
        >
          {step}
        </span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const serviceIdParam = searchParams.get("serviceId") ?? "";

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceIdParam);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffId, setStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch all services once
  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then(readJsonSafe)
      .then((j) => setServices(j.data?.services ?? []))
      .catch(() => {});
  }, []);

  // Sync with URL when navigating with serviceId
  useEffect(() => {
    if (serviceIdParam) setSelectedServiceId(serviceIdParam);
  }, [serviceIdParam]);

  const service = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  // Fetch staff when service is known
  useEffect(() => {
    if (!selectedServiceId) return;
    setStaffId("");
    setSelectedDate(null);
    setSelectedSlot(null);
    setStaff([]);

    fetch(`/api/services/${selectedServiceId}/staff`, { cache: "no-store" })
      .then(readJsonSafe)
      .then((j) => setStaff(j.data?.staff ?? []))
      .catch(() => {});
  }, [selectedServiceId]);

  // Reset date/slot when staff changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
  }, [staffId]);

  // Reset slot when date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const selectedStaff = useMemo(
    () => staff.find((s) => s.staffId === staffId) ?? null,
    [staff, staffId]
  );

  async function handlePay() {
    if (!selectedServiceId || !staffId || !selectedSlot || !customer.email || !customer.name) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const draftRes = await fetch("/api/bookings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          staffId,
          startAt: selectedSlot,
          customer,
          notes: "",
        }),
      });

      const draftJson = await readJsonSafe(draftRes);
      if (!draftRes.ok || !draftJson.ok) {
        throw new Error(draftJson?.error?.message ?? `Draft error (${draftRes.status})`);
      }

      const { appointmentId, billingRule } = draftJson.data as {
        appointmentId: string;
        billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
      };

      if (billingRule === "AUTHORIZE") {
        alert("✅ Solicitud enviada. Te enviaremos el link de pago cuando sea autorizada.");
        setStaffId("");
        setSelectedDate(null);
        setSelectedSlot(null);
        setCustomer({ name: "", email: "", phone: "" });
        return;
      }

      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "APPOINTMENT", appointmentId }),
      });

      const checkoutJson = await readJsonSafe(checkoutRes);
      if (!checkoutRes.ok || !checkoutJson.ok) {
        throw new Error(checkoutJson?.error?.message ?? `Checkout error (${checkoutRes.status})`);
      }

      window.location.href = checkoutJson.data.checkoutUrl;
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const canPay =
    !!selectedServiceId && !!staffId && !!selectedSlot && !!customer.email && !!customer.name;

  return (
    <main className="min-h-screen bg-[#181716] px-4 py-10 md:px-8 text-white">
      <div className="mx-auto max-w-lg">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-['migthy'] md:text-4xl text-white">Reservar cita</h1>
          <p className="mt-1.5 text-sm text-white/50">Confirmás con Stripe de forma segura.</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* ── 1. SERVICIO ───────────────────────────────────────── */}
          <SectionCard step={1} title="Servicio" active={true}>
            {service ? (
              <div className="flex items-start gap-4">
                {service.imageUrls[0] && (
                  <img
                    src={service.imageUrls[0]}
                    alt={service.name}
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                  />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-white">{service.name}</p>
                  {service.description && (
                    <p className="mt-0.5 text-xs text-white/55">{service.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#c8cf94]">
                    <Clock className="h-3 w-3" />
                    <span>{service.durationMin} min</span>
                    {service.depositPct && (
                      <span className="ml-2 text-white/40">· Seña {service.depositPct}%</span>
                    )}
                  </div>
                </div>
                {!serviceIdParam && (
                  <button
                    type="button"
                    onClick={() => { setSelectedServiceId(""); setStaffId(""); setSelectedDate(null); setSelectedSlot(null); }}
                    className="shrink-0 text-xs text-white/40 hover:text-white/70 transition"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : services.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-xs text-white/40 mb-1">Seleccioná un servicio para continuar</p>
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedServiceId(s.id)}
                    className="flex items-center gap-3 w-full rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-left transition"
                  >
                    {s.imageUrls[0] && (
                      <img src={s.imageUrls[0]} alt={s.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <p className="text-xs text-[#c8cf94] mt-0.5">{s.durationMin} min</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40">Cargando servicios…</p>
            )}
          </SectionCard>

          {/* ── 2. PROFESIONAL ────────────────────────────────────── */}
          <SectionCard step={2} title="Profesional" active={!!service}>
            <StaffCards staff={staff} selected={staffId} onSelect={setStaffId} />
          </SectionCard>

          {/* ── 3. FECHA Y HORA ───────────────────────────────────── */}
          <SectionCard step={3} title="Fecha y hora" active={!!staffId}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              {/* Calendar */}
              <CalendarPicker
                serviceId={selectedServiceId}
                staffId={staffId}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {/* Time slots */}
              {selectedDate && (
                <div className="md:w-48">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1">
                    Horarios disponibles
                  </p>
                  <TimeSlotPicker
                    serviceId={selectedServiceId}
                    staffId={staffId}
                    date={selectedDate}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── 4. TUS DATOS ──────────────────────────────────────── */}
          <SectionCard step={4} title="Tus datos" active={!!selectedSlot}>
            <div className="grid gap-3">
              <input
                placeholder="Nombre completo"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20"
              />
              <input
                type="email"
                placeholder="Email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20"
              />
              <input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20"
              />
            </div>

            {/* Summary */}
            {selectedStaff && selectedSlot && (
              <div className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs text-white/55 space-y-1">
                <div className="flex justify-between">
                  <span>Profesional</span>
                  <span className="text-white">{selectedStaff.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha y hora</span>
                  <span className="text-white">
                    {new Date(selectedSlot).toLocaleString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
                {service?.billingRule === "DEPOSIT" && service.depositPct ? (() => {
                  const depositCents = Math.round(selectedStaff.priceCents * service.depositPct / 100);
                  const remainingCents = selectedStaff.priceCents - depositCents;
                  return (
                    <>
                      <div className="border-t border-white/8 my-1" />
                      <div className="flex justify-between font-semibold text-[#c8cf94]">
                        <span>Pagás ahora (seña {service.depositPct}%)</span>
                        <span>{(depositCents / 100).toFixed(2)} {selectedStaff.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resto al final del servicio</span>
                        <span className="text-white/70">{(remainingCents / 100).toFixed(2)} {selectedStaff.currency}</span>
                      </div>
                      <div className="flex justify-between text-white/30 pt-0.5">
                        <span>Total</span>
                        <span>{(selectedStaff.priceCents / 100).toFixed(2)} {selectedStaff.currency}</span>
                      </div>
                    </>
                  );
                })() : (
                  <div className="flex justify-between">
                    <span>{service?.billingRule === "AUTHORIZE" ? "Pagás en el local" : "Total a pagar"}</span>
                    <span className="font-semibold text-[#c8cf94]">
                      {(selectedStaff.priceCents / 100).toFixed(2)} {selectedStaff.currency}
                    </span>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <p className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={loading || !canPay}
              className="mt-4 w-full rounded-2xl bg-[#646a40] px-6 py-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {loading ? "Procesando…" : "Confirmar y pagar"}
            </button>

            <p className="mt-2.5 text-center text-[11px] text-white/35">
              Al continuar, recibirás confirmación y comprobante por correo.
            </p>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingContent />
    </Suspense>
  );
}
