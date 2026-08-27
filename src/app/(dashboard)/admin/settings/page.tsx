import Link from "next/link";
import { BookOpen, Bug } from "lucide-react";
import { db } from "@/lib/db";
import { maskEmailAddress } from "@/lib/gdpr";

export default async function AdminSettingsPage() {
  const [settings, deletionRequests] = await Promise.all([
    db.settings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: {},
    }),
    db.accountDeletionRequest.findMany({
      orderBy: { requestedAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        requestedAt: true,
        confirmedAt: true,
        completedAt: true,
        originalEmail: true,
        user: {
          select: {
            role: true,
            name: true,
          },
        },
      },
    }),
  ]);

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

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Solicitudes de borrado RGPD
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Historial de solicitudes procesadas o pendientes. Esta vista es solo de
              lectura y no permite revertir anonimizaciones completadas.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
            {deletionRequests.length} registros recientes
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
          {deletionRequests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-white/50">
              Aun no hay solicitudes registradas.
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-white/10 bg-black/20">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-white/45">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-white/45">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-white/45">
                    Solicitado
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-white/45">
                    Confirmado
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-white/45">
                    Completado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deletionRequests.map((request: (typeof deletionRequests)[number]) => (
                  <tr key={request.id} className="bg-white/[0.02]">
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-semibold text-white">
                        {request.user.name ?? "Usuario sin nombre"}
                      </div>
                      <div className="text-xs text-white/50">
                        {maskEmailAddress(request.originalEmail)}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/35">
                        {request.user.role}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-4 text-sm text-white/65 align-top">
                      {formatDateTime(request.requestedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/65 align-top">
                      {formatDateTime(request.confirmedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/65 align-top">
                      {formatDateTime(request.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: Date | null) {
  if (!value) return "Pendiente";

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function StatusBadge({
  status,
}: {
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "FAILED";
}) {
  const styles = {
    PENDING: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    CONFIRMED: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    COMPLETED: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    FAILED: "border-red-400/20 bg-red-500/10 text-red-200",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}
