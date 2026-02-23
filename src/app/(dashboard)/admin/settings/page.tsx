import { db } from "@/lib/db";

export default async function AdminSettingsPage() {
  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  return (
    <div className="mx-auto max-w-300">
      <h1 className="text-2xl font-semibold text-white">Configuración</h1>
      <p className="mt-1 text-sm text-white/60">Comisiones de Stripe y configuración de pagos.</p>

      <form action="/api/admin/settings" method="post" className="mt-6 max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
        <h2 className="text-base font-semibold text-white mb-4">Margen de Stripe</h2>

        <label className="block text-sm font-semibold text-white">
          Porcentaje de comisión Stripe (%)
        </label>
        <p className="text-xs text-white/40 mb-2">Ej: 2.9 para el plan estándar de Stripe</p>
        <input
          name="feePercent"
          type="number"
          step="0.01"
          defaultValue={settings.feePercent}
          className="mt-1 w-full rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
        />

        <label className="mt-5 block text-sm font-semibold text-white">
          Comisión fija de Stripe (centavos)
        </label>
        <p className="text-xs text-white/40 mb-2">Ej: 30 = $0.30 fijo por transacción (plan estándar de Stripe)</p>
        <input
          name="feeFixedCents"
          type="number"
          defaultValue={settings.feeFixedCents}
          className="mt-1 w-full rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
        />

        <label className="mt-5 block text-sm font-semibold text-white">Moneda default</label>
        <input
          name="defaultCurrency"
          defaultValue={settings.defaultCurrency}
          className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
        />

        <button className="mt-6 w-full rounded-full bg-(--copper) px-6 py-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-95 transition">
          Guardar
        </button>

        <p className="mt-3 text-xs text-white/55">
          Estos valores se suman al precio base del curso. El cliente paga precio base + ({settings.feePercent}% + ${(settings.feeFixedCents / 100).toFixed(2)} fijo). Tú recibes el precio base.
        </p>
      </form>
    </div>
  );
}
