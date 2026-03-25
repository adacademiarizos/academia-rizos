"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { AboutFounderContent } from "@/lib/about-founder-content";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function AboutFounderEditor({ initial }: { initial: AboutFounderContent }) {
  const [form, setForm] = useState<AboutFounderContent>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof AboutFounderContent>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/admin/landing/about-founder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? "No se pudo guardar");
      }
      setForm(json.data ?? form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30";
  const textareaClass = `${inputClass} resize-y min-h-[96px]`;

  async function handleImageFile(file: File) {
    setUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Solo JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError("Maximo 5MB.");
      return;
    }

    setUploadingImage(true);
    const data = new FormData();
    data.set("image", file);

    try {
      const res = await fetch("/api/admin/uploads/image", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Error al subir imagen");
      }
      setField("imageUrl", json.data.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir imagen");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white">Encabezado de seccion</h2>
        <p className="mt-1 text-xs text-white/50">Contenido que aparece arriba de la foto y el texto principal.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-white/60">Kicker</label>
            <input
              className={inputClass}
              value={form.kicker}
              onChange={(e) => setField("kicker", e.target.value)}
              placeholder="Sobre Elizabeth"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Titulo</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Experiencia, tecnica y una comunidad..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Subtitulo</label>
            <textarea
              className={textareaClass}
              value={form.subtitle}
              onChange={(e) => setField("subtitle", e.target.value)}
              placeholder="Texto corto descriptivo..."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white">Imagen</h2>
        <p className="mt-1 text-xs text-white/50">Sube una imagen para esta seccion.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Imagen actual</label>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt={form.imageAlt || "Preview de imagen"}
                    className="h-20 w-20 rounded-xl border border-white/15 object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-white/30">
                  <Upload className="h-5 w-5" />
                </div>
              )}

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-40"
              >
                {uploadingImage ? "Subiendo..." : form.imageUrl ? "Cambiar imagen" : "Subir imagen"}
              </button>
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Alt de imagen</label>
            <input
              className={inputClass}
              value={form.imageAlt}
              onChange={(e) => setField("imageAlt", e.target.value)}
              placeholder="Descripcion de la imagen"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white">Bloque de texto principal</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Frase destacada</label>
            <textarea
              className={textareaClass}
              value={form.quoteTitle}
              onChange={(e) => setField("quoteTitle", e.target.value)}
              placeholder='Tu rizo no es "dificil"...'
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Parrafo</label>
            <textarea
              className={textareaClass}
              value={form.quoteBody}
              onChange={(e) => setField("quoteBody", e.target.value)}
              placeholder="Texto explicativo"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white">Botones (CTA)</h2>
        <p className="mt-1 text-xs text-white/50">
          Si un boton no debe mostrarse, deja vacio su texto o su enlace.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Boton principal</p>
            <div>
              <label className="mb-1 block text-xs text-white/60">Texto</label>
              <input
                className={inputClass}
                value={form.primaryCtaLabel}
                onChange={(e) => setField("primaryCtaLabel", e.target.value)}
                placeholder="Conocer el salon"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Enlace</label>
              <input
                className={inputClass}
                value={form.primaryCtaHref}
                onChange={(e) => setField("primaryCtaHref", e.target.value)}
                placeholder="/salon"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Boton secundario</p>
            <div>
              <label className="mb-1 block text-xs text-white/60">Texto</label>
              <input
                className={inputClass}
                value={form.secondaryCtaLabel}
                onChange={(e) => setField("secondaryCtaLabel", e.target.value)}
                placeholder="Ver academia"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Enlace</label>
              <input
                className={inputClass}
                value={form.secondaryCtaHref}
                onChange={(e) => setField("secondaryCtaHref", e.target.value)}
                placeholder="/academia"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingImage}
          className="rounded-xl bg-ap-copper px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <span className="text-sm text-green-400">Guardado correctamente.</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
