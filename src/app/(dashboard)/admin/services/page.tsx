"use client";

import { useEffect, useState } from "react";
import ServiceImages from "./ServiceImages";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
  depositPct: number | null;
  imageUrls: string[];
}

const BILLING_LABELS: Record<string, string> = {
  FULL: "Cobro completo",
  DEPOSIT: "Seña",
  AUTHORIZE: "Autorizar (sin cobrar)",
};

const INPUT = "w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";
const SELECT = "w-full rounded-xl bg-[#181716] px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [creating, setCreating] = useState(false);
  const emptyNew = { name: "", description: "", durationMin: 60, billingRule: "FULL" as "FULL" | "DEPOSIT" | "AUTHORIZE", depositPct: "" };
  const [newService, setNewService] = useState(emptyNew);

  // Edit state — keyed by service id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Omit<Service, 'depositPct'> & { depositPct: string | number | null }>>({});

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/services");
      const data = await res.json();
      setServices(data.data ?? data ?? []);
    } finally {
      setLoading(false);
    }
  }

  // ─── Create ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", newService.name);
      form.append("description", newService.description);
      form.append("durationMin", String(newService.durationMin));
      form.append("billingRule", newService.billingRule);
      if (newService.billingRule === "DEPOSIT" && newService.depositPct) {
        form.append("depositPct", String(newService.depositPct));
      }
      const res = await fetch("/api/admin/services", { method: "POST", body: form });
      if (!res.ok) throw new Error("Error al crear");
      setNewService(emptyNew);
      setCreating(false);
      await fetchServices();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Edit ────────────────────────────────────────────────────────────────
  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditDraft({
      name: s.name,
      description: s.description ?? "",
      durationMin: s.durationMin,
      billingRule: s.billingRule,
      depositPct: s.depositPct ?? "",
    });
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name,
          description: editDraft.description || null,
          durationMin: Number(editDraft.durationMin),
          billingRule: editDraft.billingRule,
          depositPct: editDraft.billingRule === "DEPOSIT" && editDraft.depositPct ? Number(editDraft.depositPct) : null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setEditingId(null);
      await fetchServices();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete(s: Service) {
    if (!confirm(`¿Eliminar el servicio "${s.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(s.id);
    try {
      const res = await fetch(`/api/admin/services/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      await fetchServices();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <main className="p-6 text-white/50">Cargando...</main>;
  }

  return (
    <main className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Servicios</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            + Nuevo servicio
          </button>
        )}
      </div>

      {/* ─── Create form ─────────────────────────────────────────────────── */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="grid max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Nuevo servicio</h2>
          <input
            className={INPUT}
            placeholder="Nombre *"
            required
            value={newService.name}
            onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
          />
          <textarea
            className={INPUT}
            placeholder="Descripción"
            rows={2}
            value={newService.description}
            onChange={(e) => setNewService((p) => ({ ...p, description: e.target.value }))}
          />
          <input
            className={INPUT}
            type="number"
            placeholder="Duración (min) *"
            required
            min={1}
            value={newService.durationMin}
            onChange={(e) => setNewService((p) => ({ ...p, durationMin: Number(e.target.value) }))}
          />
          <select
            className={SELECT}
            value={newService.billingRule}
            onChange={(e) => setNewService((p) => ({ ...p, billingRule: e.target.value as any }))}
          >
            <option value="FULL">Cobro completo</option>
            <option value="DEPOSIT">Seña</option>
            <option value="AUTHORIZE">Autorizar (sin cobrar)</option>
          </select>
          {newService.billingRule === "DEPOSIT" && (
            <input
              className={INPUT}
              type="number"
              placeholder="Seña % (ej. 50)"
              min={1}
              max={100}
              value={newService.depositPct}
              onChange={(e) => setNewService((p) => ({ ...p, depositPct: e.target.value }))}
            />
          )}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-ap-copper px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Crear servicio"}
            </button>
          </div>
        </form>
      )}

      {/* ─── Services list ───────────────────────────────────────────────── */}
      <div className="grid gap-4">
        {services.length === 0 && (
          <p className="text-sm text-white/50">No hay servicios creados.</p>
        )}
        {services.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white space-y-3">
            {editingId === s.id ? (
              /* ── Inline edit form ── */
              <div className="grid gap-3">
                <input
                  className={INPUT}
                  value={editDraft.name ?? ""}
                  onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nombre *"
                  required
                />
                <textarea
                  className={INPUT}
                  rows={2}
                  value={(editDraft.description as string) ?? ""}
                  onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descripción"
                />
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={editDraft.durationMin ?? ""}
                  onChange={(e) => setEditDraft((p) => ({ ...p, durationMin: Number(e.target.value) }))}
                  placeholder="Duración (min)"
                />
                <select
                  className={SELECT}
                  value={editDraft.billingRule ?? "FULL"}
                  onChange={(e) => setEditDraft((p) => ({ ...p, billingRule: e.target.value as any }))}
                >
                  <option value="FULL">Cobro completo</option>
                  <option value="DEPOSIT">Seña</option>
                  <option value="AUTHORIZE">Autorizar (sin cobrar)</option>
                </select>
                {editDraft.billingRule === "DEPOSIT" && (
                  <input
                    className={INPUT}
                    type="number"
                    min={1}
                    max={100}
                    value={(editDraft.depositPct as string) ?? ""}
                    onChange={(e) => setEditDraft((p) => ({ ...p, depositPct: e.target.value }))}
                    placeholder="Seña %"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSave(s.id)}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Read view ── */
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    {s.description && (
                      <div className="mt-0.5 text-sm text-white/70">{s.description}</div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-white/55">
                      <span>{s.durationMin} min</span>
                      <span>·</span>
                      <span>{BILLING_LABELS[s.billingRule]}</span>
                      {s.depositPct && <span>· Seña {s.depositPct}%</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(s)}
                      className="rounded-lg px-3 py-1.5 text-xs bg-white/10 text-white/80 hover:bg-white/15 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deleting === s.id}
                      className="rounded-lg px-3 py-1.5 text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-50"
                    >
                      {deleting === s.id ? "..." : "Eliminar"}
                    </button>
                  </div>
                </div>
                <ServiceImages serviceId={s.id} imageUrls={s.imageUrls} />
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
