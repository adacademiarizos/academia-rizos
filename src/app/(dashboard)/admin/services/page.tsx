"use client";

import { useEffect, useState } from "react";
import ServiceImages from "./ServiceImages";
import ServiceVariants from "./ServiceVariants";

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
}

interface ServiceVariantType {
  id: string;
  name: string;
  durationMin: number;
  order: number;
  isActive: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number | null;
  billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
  depositPct: number | null;
  imageUrls: string[];
  categoryId: string | null;
  category: ServiceCategory | null;
  isActive: boolean;
  order: number;
  variants: ServiceVariantType[];
}

const BILLING_LABELS: Record<string, string> = {
  FULL: "Cobro completo",
  DEPOSIT: "Seña",
  AUTHORIZE: "Autorizar (sin cobrar)",
};

const INPUT = "w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";
const SELECT = "w-full rounded-xl bg-[#181716] px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";

type EditDraft = {
  name: string;
  description: string;
  durationMin: number | null;
  billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE";
  depositPct: string | number | null;
  categoryId: string;
  isActive: boolean;
  order: number;
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [creating, setCreating] = useState(false);
  const emptyNew = {
    name: "",
    description: "",
    durationMin: 60 as number | "",
    billingRule: "FULL" as "FULL" | "DEPOSIT" | "AUTHORIZE",
    depositPct: "" as string,
    categoryId: "",
    isActive: true,
    order: 0,
  };
  const [newService, setNewService] = useState(emptyNew);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: "", description: "", durationMin: null, billingRule: "FULL",
    depositPct: "", categoryId: "", isActive: true, order: 0,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Inline category creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    fetchServices();
    fetchCategories();
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

  async function fetchCategories() {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.data ?? []);
    } catch { /* ignore */ }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        await fetchCategories();
        // Auto-select the new category
        if (creating) {
          setNewService((p) => ({ ...p, categoryId: json.data.id }));
        } else if (editingId) {
          setEditDraft((p) => ({ ...p, categoryId: json.data.id }));
        }
        setNewCategoryName("");
        setShowNewCategory(false);
      }
    } catch { /* ignore */ } finally {
      setCreatingCategory(false);
    }
  }

  // ─── Create ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newService.name,
          description: newService.description || null,
          durationMin: newService.durationMin || null,
          billingRule: newService.billingRule,
          depositPct: newService.billingRule === "DEPOSIT" && newService.depositPct
            ? Number(newService.depositPct) : null,
          categoryId: newService.categoryId || null,
          isActive: newService.isActive,
          order: newService.order,
        }),
      });
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
      categoryId: s.categoryId ?? "",
      isActive: s.isActive,
      order: s.order,
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
          durationMin: editDraft.durationMin ? Number(editDraft.durationMin) : null,
          billingRule: editDraft.billingRule,
          depositPct: editDraft.billingRule === "DEPOSIT" && editDraft.depositPct
            ? Number(editDraft.depositPct) : null,
          categoryId: editDraft.categoryId || null,
          isActive: editDraft.isActive,
          order: Number(editDraft.order ?? 0),
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

  // ─── Category selector (reusable for create & edit forms) ──────────────
  function CategorySelector({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <select className={SELECT + " flex-1"} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewCategory(true)}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/15 transition shrink-0"
            title="Nueva categoría"
          >
            +
          </button>
        </div>
        {showNewCategory && (
          <div className="flex gap-2 items-center">
            <input
              className={INPUT + " flex-1"}
              placeholder="Nombre de la categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCategory())}
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={creatingCategory}
              className="rounded-xl bg-ap-copper px-3 py-2 text-xs text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {creatingCategory ? "..." : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewCategory(false); setNewCategoryName(""); }}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/5 transition"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Active toggle (reusable) ──────────────────────────────────────────
  function ActiveToggle({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative w-10 h-5 rounded-full transition ${checked ? "bg-ap-copper" : "bg-white/10"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-5.5" : "left-0.5"}`} />
        </div>
        <span className="text-sm text-white/70">{checked ? "Activo" : "Inactivo"}</span>
      </label>
    );
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
          <CategorySelector
            value={newService.categoryId}
            onChange={(v) => setNewService((p) => ({ ...p, categoryId: v }))}
          />
          <input
            className={INPUT}
            type="number"
            placeholder="Duración (min)"
            min={1}
            value={newService.durationMin}
            onChange={(e) => setNewService((p) => ({ ...p, durationMin: e.target.value ? Number(e.target.value) : "" }))}
          />
          <p className="text-[11px] text-white/40 -mt-2">
            Puedes dejarlo vacío si el servicio tendrá variantes con duración propia.
          </p>
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
          <input
            className={INPUT}
            type="number"
            min={0}
            placeholder="Orden (0 = primero)"
            value={newService.order}
            onChange={(e) => setNewService((p) => ({ ...p, order: Number(e.target.value) }))}
          />
          <ActiveToggle
            checked={newService.isActive}
            onChange={(v) => setNewService((p) => ({ ...p, isActive: v }))}
          />
          <p className="text-[11px] text-white/40">
            Las variantes se pueden agregar después de crear el servicio.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setCreating(false); setShowNewCategory(false); }}
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
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nombre *"
                  required
                />
                <textarea
                  className={INPUT}
                  rows={2}
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descripción"
                />
                <CategorySelector
                  value={editDraft.categoryId}
                  onChange={(v) => setEditDraft((p) => ({ ...p, categoryId: v }))}
                />
                <div>
                  <input
                    className={INPUT}
                    type="number"
                    min={1}
                    value={editDraft.durationMin ?? ""}
                    onChange={(e) => setEditDraft((p) => ({
                      ...p,
                      durationMin: e.target.value ? Number(e.target.value) : null,
                    }))}
                    placeholder="Duración (min)"
                    disabled={s.variants.length > 0}
                  />
                  {s.variants.length > 0 && (
                    <p className="mt-1 text-[11px] text-white/40">
                      Duración definida por cada variante.
                    </p>
                  )}
                </div>
                <select
                  className={SELECT}
                  value={editDraft.billingRule}
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
                <input
                  className={INPUT}
                  type="number"
                  min={0}
                  value={editDraft.order}
                  onChange={(e) => setEditDraft((p) => ({ ...p, order: Number(e.target.value) }))}
                  placeholder="Orden"
                />
                <ActiveToggle
                  checked={editDraft.isActive}
                  onChange={(v) => setEditDraft((p) => ({ ...p, isActive: v }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingId(null); setShowNewCategory(false); }}
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      {!s.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-[10px] text-red-400 font-medium">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <div className="mt-0.5 text-sm text-white/70">{s.description}</div>
                    )}
                    {s.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-white/60">
                        {s.category.name}
                      </span>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-white/55">
                      {s.durationMin != null && <span>{s.durationMin} min</span>}
                      {s.variants.length > 0 && (
                        <span>{s.variants.length} variante{s.variants.length > 1 ? "s" : ""}</span>
                      )}
                      <span>·</span>
                      <span>{BILLING_LABELS[s.billingRule]}</span>
                      {s.depositPct && <span>· Seña {s.depositPct}%</span>}
                      <span>· Orden: {s.order}</span>
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
                <ServiceVariants
                  serviceId={s.id}
                  variants={s.variants}
                  onVariantsChange={(updatedVariants) => {
                    setServices((prev) =>
                      prev.map((svc) =>
                        svc.id === s.id ? { ...svc, variants: updatedVariants } : svc
                      )
                    );
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
