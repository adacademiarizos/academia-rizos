import Link from "next/link";
import { BookOpen, Bug } from "lucide-react";
import { db } from "@/lib/db";

export default async function AdminSettingsPage() {
  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configuracion</h1>
        <p className="mt-1 text-sm text-white/60">
          Ajustes globales de comisiones y accesos administrativos.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form
          action="/api/admin/settings"
          method="post"
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl"
        >
          <h2 className="mb-4 text-base font-semibold text-white">Margen de Stripe</h2>

          <label className="block text-sm font-semibold text-white">
            Porcentaje de comision Stripe (%)
          </label>
          <p className="mb-2 text-xs text-white/40">Ej: 2.9 para el plan estandar de Stripe</p>
          <input
            name="feePercent"
            type="number"
            step="0.01"
            defaultValue={settings.feePercent}
            className="mt-1 w-full rounded-2xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none"
          />

          <label className="mt-5 block text-sm font-semibold text-white">
            Comision fija de Stripe (centavos)
          </label>
          <p className="mb-2 text-xs text-white/40">
            Ej: 30 = $0.30 fijo por transaccion (plan estandar de Stripe)
          </p>
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

          <button className="mt-6 w-full rounded-full bg-(--copper) px-6 py-4 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:opacity-95">
            Guardar
          </button>

          <p className="mt-3 text-xs text-white/55">
            Estos valores se suman al precio base del curso. El cliente paga precio base + (
            {settings.feePercent}% + ${(settings.feeFixedCents / 100).toFixed(2)} fijo). Tu
            recibes el precio base.
          </p>
        </form>

        <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
          <h2 className="text-base font-semibold text-white">Accesos rapidos</h2>
          <p className="mt-1 text-sm text-white/55">
            Manuales y reportes movidos al area de configuracion para mantener el menu principal mas
            limpio.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/admin/manuales"
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4 text-ap-copper" />
              <div>
                <p className="font-semibold text-white">Manuales</p>
                <p className="text-xs text-white/50">Documentacion de admin y staff</p>
              </div>
            </Link>

            <Link
              href="/bug-report"
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
            >
              <Bug className="h-4 w-4 text-ap-copper" />
              <div>
                <p className="font-semibold text-white">Reportes</p>
                <p className="text-xs text-white/50">Enviar incidencias y bugs</p>
              </div>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
