"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type LandingTestimonialType = "SALON" | "ACADEMIA";

type Testimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  type: LandingTestimonialType;
  stars: number;
  avatarUrl: string | null;
  isActive: boolean;
  order: number;
};

const INPUT =
  "w-full rounded-xl bg-white/5 px-4 py-2.5 text-white outline-none ring-1 ring-white/10 focus:ring-ap-copper/50 transition text-sm";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 transition"
        >
          <Star
            className={`h-5 w-5 ${
              n <= value
                ? "fill-[#B16E34] text-[#B16E34]"
                : "fill-none text-white/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function AvatarUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Solo JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setUploadError("Maximo 5MB.");
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.set("image", file);

    try {
      const res = await fetch("/api/admin/uploads/image", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Error al subir imagen");
      }
      onUploaded(json.data.url);
    } catch (e: any) {
      setUploadError(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs text-white/50">Avatar</label>
      <div className="flex items-center gap-3">
        {currentUrl ? (
          <div className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="Avatar"
              className="h-14 w-14 rounded-full border-2 border-[#B16E34]/30 object-cover"
            />
            <button
              type="button"
              onClick={() => onUploaded(null)}
              className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5 text-white/60 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5 text-white/30">
            <Upload className="h-4 w-4" />
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          {uploading ? (
            <span className="flex items-center gap-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Subiendo...
            </span>
          ) : currentUrl ? (
            "Cambiar imagen"
          ) : (
            "Subir imagen"
          )}
        </button>
      </div>

      {uploadError && <p className="mt-1 text-xs text-red-400">{uploadError}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function LandingTestimonialsManager({
  testimonialType,
  sectionLabel,
}: {
  testimonialType: LandingTestimonialType;
  sectionLabel: string;
}) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Clienta");
  const [newQuote, setNewQuote] = useState("");
  const [newStars, setNewStars] = useState(5);
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editQuote, setEditQuote] = useState("");
  const [editStars, setEditStars] = useState(5);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editOrder, setEditOrder] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTestimonials();
  }, [testimonialType]);

  async function fetchTestimonials() {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: testimonialType });
      const res = await fetch(`/api/admin/testimonials?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? "Error al cargar testimonios");
      }
      setTestimonials(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar testimonios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newQuote.trim()) {
      setError("Nombre y testimonio son requeridos.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole.trim() || "Clienta",
          quote: newQuote.trim(),
          type: testimonialType,
          stars: newStars,
          avatarUrl: newAvatarUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Error al crear");
      setTestimonials((prev) => [...prev, json.data]);
      resetCreateForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetCreateForm() {
    setCreating(false);
    setNewName("");
    setNewRole("Clienta");
    setNewQuote("");
    setNewStars(5);
    setNewAvatarUrl(null);
  }

  function startEdit(t: Testimonial) {
    setEditId(t.id);
    setEditName(t.name);
    setEditRole(t.role);
    setEditQuote(t.quote);
    setEditStars(t.stars);
    setEditAvatarUrl(t.avatarUrl);
    setEditIsActive(t.isActive);
    setEditOrder(t.order);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editQuote.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole.trim(),
          quote: editQuote.trim(),
          type: testimonialType,
          stars: editStars,
          avatarUrl: editAvatarUrl,
          isActive: editIsActive,
          order: editOrder,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Error al actualizar");
      setTestimonials((prev) => prev.map((t) => (t.id === id ? json.data : t)));
      setEditId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este testimonio? Esta accion no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Error al eliminar");
      setTestimonials((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(t: Testimonial) {
    try {
      const res = await fetch(`/api/admin/testimonials/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Error");
      setTestimonials((prev) => prev.map((x) => (x.id === t.id ? json.data : x)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div className="text-white/50">Cargando...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-white/50">Seccion</p>
        <p className="text-sm font-semibold text-white">{sectionLabel}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 transition hover:text-white"
          >
            x
          </button>
        </div>
      )}

      <div className="flex items-center justify-end">
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nuevo testimonio
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Nuevo testimonio
          </h2>
          <input
            className={INPUT}
            placeholder="Nombre *"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={INPUT}
            placeholder="Rol (ej: Clienta desde 2023)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          />
          <textarea
            className={INPUT + " resize-none"}
            placeholder="Testimonio *"
            required
            rows={3}
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-xs text-white/50">Estrellas</label>
            <StarPicker value={newStars} onChange={setNewStars} />
          </div>
          <AvatarUpload currentUrl={newAvatarUrl} onUploaded={setNewAvatarUrl} />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={resetCreateForm}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-ap-copper px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Crear testimonio"}
            </button>
          </div>
        </form>
      )}

      {testimonials.length === 0 ? (
        <p className="text-sm text-white/40">
          No hay testimonios creados aun para {sectionLabel.toLowerCase()}.
        </p>
      ) : (
        <div className="grid gap-4">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className={`space-y-3 rounded-2xl border p-5 text-white ${
                t.isActive
                  ? "border-white/10 bg-white/5"
                  : "border-white/5 bg-white/[0.02] opacity-60"
              }`}
            >
              {editId === t.id ? (
                <div className="grid gap-3">
                  <input
                    className={INPUT}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre *"
                  />
                  <input
                    className={INPUT}
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="Rol"
                  />
                  <textarea
                    className={INPUT + " resize-none"}
                    rows={3}
                    value={editQuote}
                    onChange={(e) => setEditQuote(e.target.value)}
                    placeholder="Testimonio *"
                  />
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Estrellas</label>
                    <StarPicker value={editStars} onChange={setEditStars} />
                  </div>
                  <AvatarUpload currentUrl={editAvatarUrl} onUploaded={setEditAvatarUrl} />
                  <div className="flex items-center gap-4">
                    <label className="flex cursor-pointer select-none items-center gap-2">
                      <div
                        role="switch"
                        aria-checked={editIsActive}
                        onClick={() => setEditIsActive(!editIsActive)}
                        className={`relative h-5 w-10 rounded-full transition ${
                          editIsActive ? "bg-ap-copper" : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            editIsActive ? "left-5.5" : "left-0.5"
                          }`}
                        />
                      </div>
                      <span className="text-sm text-white/70">
                        {editIsActive ? "Activo" : "Inactivo"}
                      </span>
                    </label>
                    <input
                      className={INPUT + " w-20"}
                      type="number"
                      min={0}
                      value={editOrder}
                      onChange={(e) => setEditOrder(Number(e.target.value))}
                      placeholder="Orden"
                    />
                    <span className="text-xs text-white/40">Orden</span>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(t.id)}
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.avatarUrl}
                      alt={t.name}
                      className="h-12 w-12 shrink-0 rounded-full border-2 border-[#B16E34]/30 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#B16E34]/40 bg-[#B16E34]/10">
                      <span className="text-sm font-bold text-[#B16E34]">
                        {t.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-[#B16E34]">{t.role}</span>
                      {!t.isActive && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          Oculto
                        </span>
                      )}
                    </div>
                    <div className="mb-2 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < t.stars
                              ? "fill-[#B16E34] text-[#B16E34]"
                              : "fill-none text-white/20"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-white/30">Orden: {t.order}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="rounded-xl p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className={`rounded-xl p-2 transition ${
                        t.isActive
                          ? "text-white/40 hover:bg-yellow-500/10 hover:text-yellow-400"
                          : "text-green-400/60 hover:bg-green-500/10 hover:text-green-400"
                      }`}
                      aria-label={t.isActive ? "Ocultar" : "Mostrar"}
                      title={t.isActive ? "Ocultar" : "Mostrar"}
                    >
                      {t.isActive ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="rounded-xl p-2 text-white/40 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      aria-label="Eliminar"
                    >
                      {deletingId === t.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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

export default function LandingTestimonialsPage() {
  return (
    <LandingTestimonialsManager
      testimonialType="SALON"
      sectionLabel="Testimonios del salon"
    />
  );
}
