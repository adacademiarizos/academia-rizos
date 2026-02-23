import { db } from "@/lib/db";
import CopyOpenRow from "@/app/(dashboard)/components/CopyOpenRow";
import DeleteButton from "@/components/dashboard/DeleteButton";

function money(cents: number, currency = "EUR") {
  const symbol = currency === "EUR" ? "€" : currency + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export default async function AdminPaymentLinksPage() {
  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  const links = await db.paymentLink.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-2xl font-semibold text-white">Links de pago</h1>
      <p className="mt-1 text-sm text-white/60">
        El total suma fee automáticamente ({settings.feePercent}% + {settings.feeFixedCents}¢).
      </p>

      {/* Crear link */}
      <form
        action="/api/admin/payment-links"
        method="post"
        className="mt-6 grid max-w-2xl gap-3 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="title"
            placeholder="Título (ej: Reserva especial / Curso / Producto)"
            className="rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
            required
          />
          <input
            name="customerEmail"
            placeholder="Email cliente (opcional)"
            className="rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
          />
        </div>

        <textarea
          name="description"
          placeholder="Descripción/nota (opcional)"
          className="rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="baseAmount"
            type="number"
            step="0.01"
            placeholder="Monto base en € (ej 10.00)"
            className="rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
            required
          />
          <input type="hidden" name="currency" value="EUR" />
          <button className="rounded-full bg-[var(--copper)] px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-95 transition">
            Crear link
          </button>
        </div>

        <p className="text-xs text-white/55">
          “Monto base” = lo que ella quiere recibir. “Total” = base + fee.
        </p>
      </form>

      {/* Listado */}
      <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-3xl overflow-hidden">
        <div className="grid grid-cols-12 gap-0 border-b border-white/10 px-5 py-3 text-xs text-white/55">
          <div className="col-span-4">Título</div>
          <div className="col-span-2">Base</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2 text-right">Último pago</div>
        </div>

        <div className="divide-y divide-white/10">
          {links.map((l) => {
            const lastPay = l.payments?.[0];
            const url = `${baseUrl}/pay/${l.id}`;

            return (
              <div key={l.id} className="px-5 py-4">
                <div className="grid grid-cols-12 items-center gap-0">
                  <div className="col-span-4">
                    <div className="text-sm font-semibold text-white">{l.title}</div>
                    <div className="text-xs text-white/55">{l.customerEmail ?? "—"}</div>
                  </div>

                  <div className="col-span-2 text-sm text-white/80">
                    {money(l.baseAmountCents, l.currency)}
                  </div>

                  <div className="col-span-2 text-sm text-white/90 font-semibold">
                    {money(l.totalAmountCents, l.currency)}
                  </div>

                  <div className="col-span-2">
                    <StatusPill status={l.status} />
                  </div>

                  <div className="col-span-2 text-right">
                    {lastPay ? (
                      <div className="text-xs">
                        <div className="text-white/85 font-semibold">
                          {money(lastPay.amountCents, lastPay.currency)}
                        </div>
                        <div className="text-white/55">
                          {lastPay.status}
                          {lastPay.payerEmail ? ` · ${lastPay.payerEmail}` : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-white/55">—</div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <CopyOpenRow url={url} />
                </div>

              {l.status !== "PAID" && <DeleteButton id={l.id}/>}
                
              </div>
            );
          })}

          {links.length === 0 && (
            <div className="px-5 py-10 text-sm text-white/60">No hay links aún.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    REQUIRES_PAYMENT: "bg-white/10 text-white/80",
    PROCESSING: "bg-white/10 text-white/80",
    PAID: "bg-[var(--copper)]/25 text-white ring-1 ring-[var(--copper)]/25",
    FAILED: "bg-white/10 text-white/80",
    CANCELED: "bg-white/10 text-white/80",
    EXPIRED: "bg-white/10 text-white/80",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${map[status] ?? "bg-white/10 text-white/80"}`}>
      {status}
    </span>
  );
}
