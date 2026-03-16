import { db } from "@/lib/db";
import PriceForm from "./PriceForm";
import RemovePriceButton from "./RemovePriceButton";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await db.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    include: { staffProfile: true },
    orderBy: { createdAt: "desc" },
  });

  const services = await db.service.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, durationMin: true },
      },
    },
  });

  const prices = await db.serviceStaffPrice.findMany();

  const variantPrices = await db.variantStaffPrice.findMany({
    include: {
      variant: {
        select: { id: true, name: true, serviceId: true },
      },
    },
  });

  const settings = await db.settings.findUnique({
    where: { id: "global" },
    select: { feePercent: true, feeFixedCents: true, defaultCurrency: true },
  });

  return (
    <main className="min-h-screen bg-[var(--ap-bg)] px-4 pt-24 pb-16 text-white">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-white/60">
            Asigna precios por servicio o variante a cada profesional.
          </p>
        </div>

        {/* Forms */}
        <div className="mt-8 grid gap-4">
          {/* Asignar precio */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur max-w-lg">
            <h2 className="text-sm font-semibold text-white/90">
              Asignar precio
            </h2>
            <p className="mt-1 text-xs text-white/55">
              Elegí staff + servicio (y variante si aplica) y guardá el precio.
            </p>

            <PriceForm
              staff={staff.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              services={services.map((s) => ({
                id: s.id,
                name: s.name,
                variants: s.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  durationMin: v.durationMin,
                })),
              }))}
              feePercent={settings?.feePercent ?? 0}
              feeFixedCents={settings?.feeFixedCents ?? 0}
              currency={settings?.defaultCurrency ?? "EUR"}
            />
          </section>
        </div>

        {/* Staff list */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">
              Profesionales
            </h2>
            <span className="text-xs text-white/55">
              {staff.length} {staff.length === 1 ? "persona" : "personas"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {staff.map((u) => {
              const staffServicePrices = prices.filter((p) => p.staffId === u.id);
              const staffVariantPrices = variantPrices.filter((p) => p.staffId === u.id);

              // Group variant prices by parent service
              const variantsByService = new Map<string, {
                serviceName: string;
                entries: { variantId: string; variantName: string; priceCents: number; currency: string }[];
              }>();

              for (const vp of staffVariantPrices) {
                const svc = services.find((s) => s.id === vp.variant.serviceId);
                const key = vp.variant.serviceId;
                if (!variantsByService.has(key)) {
                  variantsByService.set(key, {
                    serviceName: svc?.name ?? "Servicio eliminado",
                    entries: [],
                  });
                }
                variantsByService.get(key)!.entries.push({
                  variantId: vp.variantId,
                  variantName: vp.variant.name,
                  priceCents: vp.priceCents,
                  currency: vp.currency,
                });
              }

              const hasAnyPrice = staffServicePrices.length > 0 || staffVariantPrices.length > 0;

              return (
                <div
                  key={u.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{u.name ?? u.email}</div>
                      <div className="text-xs text-white/60">{u.email}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-white/55">Precios</div>

                  <ul className="mt-2 space-y-1 text-sm text-white/75">
                    {/* Service-level prices (services without variants) */}
                    {staffServicePrices.map((p) => {
                      const serviceName = services.find((s) => s.id === p.serviceId)?.name ?? p.serviceId;
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-3">
                          <span className="text-white/75 truncate">{serviceName}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium text-white">
                              {(p.priceCents / 100).toFixed(2)} {p.currency}
                            </span>
                            <RemovePriceButton
                              staffId={u.id}
                              serviceId={p.serviceId}
                              serviceName={serviceName}
                            />
                          </div>
                        </li>
                      );
                    })}

                    {/* Variant-level prices (services with variants) */}
                    {Array.from(variantsByService.entries()).map(([serviceId, group]) => (
                      <li key={serviceId} className="mt-2">
                        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
                          {group.serviceName}
                        </span>
                        <ul className="mt-1 space-y-1 pl-3 border-l border-white/8">
                          {group.entries.map((entry) => (
                            <li key={entry.variantId} className="flex items-center justify-between gap-3">
                              <span className="text-white/65 truncate text-xs">{entry.variantName}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-medium text-white text-xs">
                                  {(entry.priceCents / 100).toFixed(2)} {entry.currency}
                                </span>
                                <RemovePriceButton
                                  staffId={u.id}
                                  serviceId={serviceId}
                                  serviceName={`${group.serviceName} — ${entry.variantName}`}
                                  variantId={entry.variantId}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}

                    {!hasAnyPrice && (
                      <li className="text-white/50">—</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
