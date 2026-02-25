import { db } from "@/lib/db";
import PriceForm from "./PriceForm";
import RemovePriceButton from "./RemovePriceButton";

export default async function AdminStaffPage() {
  const staff = await db.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    include: { staffProfile: true },
    orderBy: { createdAt: "desc" },
  });

  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const prices = await db.serviceStaffPrice.findMany();

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
            Asigná precios por servicio a cada profesional.
          </p>
        </div>

        {/* Forms */}
        <div className="mt-8 grid gap-4">
          {/* Asignar precio */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur max-w-lg">
            <h2 className="text-sm font-semibold text-white/90">
              Asignar precio por servicio
            </h2>
            <p className="mt-1 text-xs text-white/55">
              Elegí staff + servicio y guardá el precio.
            </p>

            <PriceForm
              staff={staff.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
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
              const staffPrices = prices.filter((p) => p.staffId === u.id);

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
                    {staffPrices.map((p) => {
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
                    {staffPrices.length === 0 && (
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
