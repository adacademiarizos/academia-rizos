"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";

type FaqItem = { id: string; question: string; answer: string; order: number };

export default function FaqManager({ initial }: { initial: FaqItem[] }) {
  const router  = useRouter();
  const [items, setItems]     = useState<FaqItem[]>(initial);
  const [newQ,  setNewQ]      = useState("");
  const [newA,  setNewA]      = useState("");
  const [adding, setAdding]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  // Editing state
  const [editId,  setEditId]  = useState<string | null>(null);
  const [editQ,   setEditQ]   = useState("");
  const [editA,   setEditA]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newQ.trim() || !newA.trim()) {
      setError("Completa la pregunta y la respuesta.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const res  = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQ, answer: newA }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al guardar");
      setItems((prev) => [...prev, json.data]);
      setNewQ("");
      setNewA("");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: FaqItem) {
    setEditId(item.id);
    setEditQ(item.question);
    setEditA(item.answer);
  }

  function cancelEdit() {
    setEditId(null);
    setEditQ("");
    setEditA("");
  }

  async function handleSaveEdit(id: string) {
    if (!editQ.trim() || !editA.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/faq/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: editQ, answer: editA }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al actualizar");
      setItems((prev) => prev.map((it) => (it.id === id ? json.data : it)));
      setEditId(null);
      router.refresh();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res  = await fetch(`/api/admin/faq/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al eliminar");
      setItems((prev) => prev.filter((it) => it.id !== id));
      router.refresh();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  const inputCls = "w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30";

  return (
    <div className="mt-6 space-y-8">
      {/* Add new question */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 max-w-xl">
        <p className="text-sm font-semibold text-white/70 mb-4">Nueva pregunta</p>
        <div className="grid gap-3">
          <input
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            placeholder="Pregunta"
            className={inputCls}
          />
          <textarea
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            placeholder="Respuesta"
            rows={3}
            className={inputCls + " resize-none"}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="rounded-xl bg-ap-copper px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-40"
          >
            {adding ? "Guardando…" : "Agregar pregunta"}
          </button>
        </div>
      </div>

      {/* Existing items */}
      {items.length === 0 ? (
        <p className="text-sm text-white/40">Sin preguntas cargadas aún.</p>
      ) : (
        <div className="grid gap-3 max-w-2xl">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white"
            >
              {editId === item.id ? (
                /* ── Editing mode ── */
                <div className="grid gap-2">
                  <input
                    value={editQ}
                    onChange={(e) => setEditQ(e.target.value)}
                    className={inputCls}
                  />
                  <textarea
                    value={editA}
                    onChange={(e) => setEditA(e.target.value)}
                    rows={3}
                    className={inputCls + " resize-none"}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl bg-ap-copper px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.question}</p>
                    <p className="mt-1 text-sm text-white/60">{item.answer}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                      aria-label="Eliminar"
                    >
                      {deletingId === item.id ? (
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
