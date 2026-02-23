import { db } from "@/lib/db";
import ServiceImages from "./ServiceImages";

export default async function AdminServicesPage() {
  const services = await db.service.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-white">Servicios</h1>

      <form action="/api/admin/services" method="post" className="mt-6 grid max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
        <input name="name" placeholder="Nombre" className="rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10" required />
        <textarea name="description" placeholder="Descripción" className="rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10" />
        <input name="durationMin" type="number" placeholder="Duración (min)" className="rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10" required />
        <select name="billingRule" className="rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10" defaultValue="FULL">
          <option value="FULL">Cobro completo</option>
          <option value="DEPOSIT">Seña</option>
          <option value="AUTHORIZE">Autorizar (sin cobrar)</option>
        </select>
        <input name="depositPct" type="number" placeholder="Seña % (solo DEPOSIT)" className="rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10" />

        <button className="mt-2 rounded-xl bg-(--copper) px-4 py-3 font-semibold text-white ring-1 ring-white/10 hover:opacity-95">
          Crear servicio
        </button>
      </form>

      <div className="mt-10 grid gap-3">
        {services.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-white/70">{s.billingRule}</div>
            </div>
            <div className="mt-1 text-sm text-white/70">{s.description ?? "-"}</div>
            <div className="mt-2 text-xs text-white/55">
              {s.durationMin} min {s.depositPct ? `· Seña ${s.depositPct}%` : ""}
            </div>
            <ServiceImages serviceId={s.id} imageUrls={s.imageUrls} />
          </div>
        ))}
      </div>
    </main>
  );
}
