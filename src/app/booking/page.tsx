"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import StaffCards from "./StaffCards";
import CalendarPicker from "./CalendarPicker";
import TimeSlotPicker from "./TimeSlotPicker";
import VariantSelector from "./VariantSelector";
import WhatsAppButton from "./WhatsAppButton";
import { toast } from "sonner";

/* ───── Types ───── */

type Variant = {
  id: string;
  name: string;
  durationMin: number;
  order: number;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  currency: string;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number | null;
  billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
  depositPct: number | null;
  imageUrls: string[];
  typeOfService: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hasVariants: boolean;
  variants: Variant[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  currency: string;
};

type CategoryGroup = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  services: Service[];
};

type StaffMember = {
  staffId: string;
  name: string | null;
  photoUrl: string | null;
  priceCents: number;
  currency: string;
};

/* ───── Helpers ───── */

async function readJsonSafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

function priceRangeLabel(
  minCents: number | null,
  maxCents: number | null,
  currency = "EUR"
): string {
  if (minCents == null && maxCents == null) return "Consultar";
  const min = minCents ?? maxCents!;
  const max = maxCents ?? minCents!;
  if (min === max) return `${(min / 100).toFixed(0)}€`;
  return `${(min / 100).toFixed(0)} - ${(max / 100).toFixed(0)}€`;
}

/* ───── SectionCard ───── */

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

/* ───── Main booking content ───── */

function BookingContent() {
  const searchParams = useSearchParams();
  const serviceIdParam = searchParams.get("serviceId") ?? "";

  /* State */
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceIdParam);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffId, setStaffId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Filtered services based on selected category tag
  const filteredServices = useMemo(() => {
    if (!filterCategory) return services;
    return services.filter((s) => s.categoryId === filterCategory);
  }, [services, filterCategory]);

  /* Fetch all services once */
  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then(readJsonSafe)
      .then((j) => {
        setServices(j.data?.services ?? []);
        setCategories(j.data?.groupedByCategory ?? []);
      })
      .catch(() => {});
  }, []);

  /* Sync with URL param */
  useEffect(() => {
    if (serviceIdParam) setSelectedServiceId(serviceIdParam);
  }, [serviceIdParam]);

  /* Derived */
  const service = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const selectedVariant = useMemo(
    () => service?.variants.find((v) => v.id === selectedVariantId) ?? null,
    [service, selectedVariantId]
  );

  const hasVariants = !!service?.hasVariants && (service.variants.length ?? 0) > 0;

  // Service is "ready" when either variant is selected (if needed) or no variants
  const serviceReady = !!service && (!hasVariants || !!selectedVariantId);

  /* Fetch staff when service (and variant if needed) are known */
  useEffect(() => {
    if (!selectedServiceId || !serviceReady) return;
    setStaffId("");
    setSelectedDate(null);
    setSelectedSlot(null);
    setStaff([]);

    const params = new URLSearchParams({ });
    if (selectedVariantId) params.set("variantId", selectedVariantId);

    fetch(`/api/services/${selectedServiceId}/staff?${params.toString()}`, { cache: "no-store" })
      .then(readJsonSafe)
      .then((j) => setStaff(j.data?.staff ?? []))
      .catch(() => {});
  }, [selectedServiceId, selectedVariantId, serviceReady]);

  /* Reset cascades */
  useEffect(() => {
    // When service changes, reset everything downstream
    setSelectedVariantId(null);
    setStaffId("");
    setSelectedDate(null);
    setSelectedSlot(null);
    setStaff([]);
  }, [selectedServiceId]);

  useEffect(() => {
    // When variant changes, reset staff/date/slot (but NOT via the service reset above)
    setStaffId("");
    setSelectedDate(null);
    setSelectedSlot(null);
  }, [selectedVariantId]);

  useEffect(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
  }, [staffId]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const selectedStaff = useMemo(
    () => staff.find((s) => s.staffId === staffId) ?? null,
    [staff, staffId]
  );

  /* Dynamic step numbers */
  const variantStep = hasVariants ? 2 : null;
  const professionalStep = hasVariants ? 3 : 2;
  const dateStep = hasVariants ? 4 : 3;
  const dataStep = hasVariants ? 5 : 4;

  /* Duration label */
  const displayDuration = selectedVariant?.durationMin ?? service?.durationMin;

  /* Handle payment */
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
          variantId: selectedVariantId || undefined,
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
        toast.success("Solicitud enviada. Te enviaremos el link de pago cuando sea autorizada.");
        setSelectedServiceId("");
        setCustomer({ name: "", email: "", phone: "" });
        return;
      }

      // Collect analytics data for conversion attribution
      let analyticsData = {};
      try {
        const { getAnalyticsData } = await import("@/components/analytics/AnalyticsProvider");
        analyticsData = getAnalyticsData() || {};
      } catch {}

      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "APPOINTMENT", appointmentId, ...analyticsData }),
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
              <div>
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
                    {service.categoryName && (
                      <p className="text-[11px] text-white/35 mt-0.5">{service.categoryName}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[#c8cf94]">
                      {displayDuration ? (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>{displayDuration} min</span>
                        </>
                      ) : (
                        <span className="text-white/40">Duración según opción</span>
                      )}
                      <span className="ml-2 font-semibold">
                        {priceRangeLabel(service.minPriceCents, service.maxPriceCents, service.currency)}
                      </span>
                    </div>
                  </div>
                  {!serviceIdParam && (
                    <button
                      type="button"
                      onClick={() => setSelectedServiceId("")}
                      className="shrink-0 text-xs text-white/40 hover:text-white/70 transition"
                    >
                      Cambiar
                    </button>
                  )}
                </div>

                {/* Description + WhatsApp */}
                {service.description && (
                  <p className="mt-3 text-xs text-white/45 leading-relaxed">{service.description}</p>
                )}
                <div className="mt-3">
                  <WhatsAppButton
                    serviceName={service.name}
                    variantName={selectedVariant?.name}
                  />
                </div>
              </div>
            ) : services.length > 0 ? (
              <div className="grid gap-3">
                <p className="text-xs text-white/40 mb-1">Selecciona un servicio para continuar</p>

                {/* ── Category filter tags ── */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                  <button
                    type="button"
                    onClick={() => setFilterCategory(null)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition
                      ${filterCategory === null
                        ? "bg-[#646a40] text-white ring-1 ring-[#646a40]/60"
                        : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/70"
                      }`}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.categoryId}
                      type="button"
                      onClick={() => setFilterCategory(filterCategory === cat.categoryId ? null : cat.categoryId)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition
                        ${filterCategory === cat.categoryId
                          ? "bg-[#646a40] text-white ring-1 ring-[#646a40]/60"
                          : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/70"
                        }`}
                    >
                      {cat.categoryName}
                    </button>
                  ))}
                </div>

                {/* ── Service cards ── */}
                <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedServiceId(s.id)}
                      className="flex items-center gap-3 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-3 text-left transition"
                    >
                      {s.imageUrls[0] && (
                        <img
                          src={s.imageUrls[0]}
                          alt={s.name}
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.durationMin ? (
                            <span className="text-[11px] text-white/40">{s.durationMin} min</span>
                          ) : s.hasVariants ? (
                            <span className="text-[11px] text-white/30">Varias opciones</span>
                          ) : null}
                          <span className="text-xs font-semibold text-[#c8cf94]">
                            {priceRangeLabel(s.minPriceCents, s.maxPriceCents, s.currency)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredServices.length === 0 && (
                    <p className="text-xs text-white/30 py-4 text-center">No hay servicios en esta categoría.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/40">Cargando servicios…</p>
            )}
          </SectionCard>

          {/* ── 2. VARIANTE (condicional) ──────────────────────────── */}
          {hasVariants && (
            <SectionCard step={variantStep!} title="Opción del servicio" active={!!service}>
              <VariantSelector
                variants={service!.variants}
                selected={selectedVariantId}
                onSelect={setSelectedVariantId}
              />
            </SectionCard>
          )}

          {/* ── PROFESIONAL ────────────────────────────────────────── */}
          <SectionCard step={professionalStep} title="Profesional" active={serviceReady}>
            <StaffCards staff={staff} selected={staffId} onSelect={setStaffId} />
          </SectionCard>

          {/* ── FECHA Y HORA ───────────────────────────────────────── */}
          <SectionCard step={dateStep} title="Fecha y hora" active={!!staffId}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <CalendarPicker
                serviceId={selectedServiceId}
                staffId={staffId}
                variantId={selectedVariantId}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {selectedDate && (
                <div className="md:w-48">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-1">
                    Horarios disponibles
                  </p>
                  <TimeSlotPicker
                    serviceId={selectedServiceId}
                    staffId={staffId}
                    variantId={selectedVariantId}
                    date={selectedDate}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── TUS DATOS ──────────────────────────────────────────── */}
          <SectionCard step={dataStep} title="Tus datos" active={!!selectedSlot}>
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
                  <span>Servicio</span>
                  <span className="text-white text-right max-w-[60%] truncate">
                    {service?.name}{selectedVariant ? ` - ${selectedVariant.name}` : ""}
                  </span>
                </div>
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
