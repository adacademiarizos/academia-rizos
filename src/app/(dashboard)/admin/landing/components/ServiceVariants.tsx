"use client";

import { useState } from "react";

type Variant = {
  id: string;
  name: string;
  durationMin: number;
  order: number;
  isActive: boolean;
};

const INPUT =
  "w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";

export default function ServiceVariants({
  serviceId,
  variants: initial,
  onVariantsChange,
}: {
  serviceId: string;
  variants: Variant[];
  onVariantsChange?: (variants: Variant[]) => void;
}) {
  const [variants, setVariants] = useState<Variant[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(updated: Variant[]) {
    setVariants(updated);
    onVariantsChange?.(updated);
  }

  async function handleAdd() {
    if (!newName.trim() || newDuration <= 0) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), durationMin: newDuration, order: variants.length }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al crear variante");
      update([...variants, json.data]);
      setNewName("");
      setNewDuration(60);
      setShowAdd(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(variantId: string) {
    if (!editName.trim() || editDuration <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/variants/${variantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), durationMin: editDuration }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al guardar");
      update(variants.map((v) => (v.id === variantId ? json.data : v)));
      setEditId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(variantId: string) {
    if (!confirm("¿Eliminar esta variante?")) return;
    setDeletingId(variantId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/variants/${variantId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
      update(variants.filter((v) => v.id !== variantId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
          Variantes ({variants.length})
        </p>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-xs text-ap-copper hover:underline"
          >
            + Agregar
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="grid gap-2 mb-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <input
            className={INPUT}
            placeholder="Nombre variante *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={INPUT}
            type="number"
            min={1}
            placeholder="Duración (min) *"
            value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewName(""); setNewDuration(60); }}
              className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 rounded-xl bg-ap-copper px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {adding ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </div>
      )}

      {/* Variant list */}
      {variants.map((v) => (
        <div key={v.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
          {editId === v.id ? (
            <div className="flex-1 flex gap-2 items-center">
              <input
                className={INPUT + " flex-1"}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <input
                className={INPUT + " w-24"}
                type="number"
                min={1}
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value))}
              />
              <button
                type="button"
                onClick={() => handleSaveEdit(v.id)}
                disabled={saving}
                className="rounded-lg px-2 py-1 text-xs text-ap-copper hover:bg-white/10 transition disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white">{v.name}</span>
                <span className="ml-2 text-xs text-white/40">{v.durationMin} min</span>
                {!v.isActive && (
                  <span className="ml-2 text-xs text-red-400/70">Inactiva</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setEditId(v.id); setEditName(v.name); setEditDuration(v.durationMin); }}
                className="rounded-lg px-2 py-1 text-xs text-white/30 hover:text-white hover:bg-white/10 transition"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(v.id)}
                disabled={deletingId === v.id}
                className="rounded-lg px-2 py-1 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
              >
                {deletingId === v.id ? "..." : "Eliminar"}
              </button>
            </>
          )}
        </div>
      ))}

      {variants.length === 0 && !showAdd && (
        <p className="text-xs text-white/30">Sin variantes. Cada variante define su propia duración.</p>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
