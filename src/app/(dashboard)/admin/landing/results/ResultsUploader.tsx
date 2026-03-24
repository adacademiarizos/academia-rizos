"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Trash2 } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type ResultImage = {
  id: string;
  url: string;
  label: string | null;
  aspectRatio: number;
  width: number;
  height: number;
};

export default function ResultsUploader({ initial }: { initial: ResultImage[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ResultImage[]>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;

    if (!ALLOWED.includes(f.type)) {
      setError("Solo JPEG, PNG o WebP.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("Máximo 10 MB por imagen.");
      return;
    }

    setError(null);
    setFile(f);

    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);

    const img = new Image();
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = objectUrl;
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setDimensions(null);
  }

  async function handleUpload() {
    if (!file || !dimensions) {
      setError("Selecciona una imagen primero.");
      return;
    }

    setError(null);
    setUploading(true);

    const form = new FormData();
    form.set("file", file);
    form.set("width", String(dimensions.w));
    form.set("height", String(dimensions.h));
    form.set("aspectRatio", String(dimensions.w / dimensions.h));
    if (label.trim()) form.set("label", label.trim());

    try {
      const res = await fetch("/api/admin/results", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al subir");
      setImages((prev) => [...prev, json.data]);
      clearFile();
      setLabel("");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/results/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al eliminar");
      setImages((prev) => prev.filter((x) => x.id !== id));
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Upload form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 max-w-xl">
        <p className="text-sm font-semibold text-white/70 mb-4">
          Agregar imagen de resultado
        </p>

        {file && preview ? (
          <div className="relative mb-3">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-64 rounded-xl object-contain bg-black/20"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black transition"
            >
              <X className="h-3 w-3" />
            </button>
            {dimensions && (
              <p className="mt-1 text-xs text-white/40">
                {dimensions.w} &times; {dimensions.h}px &mdash; ratio:{" "}
                {(dimensions.w / dimensions.h).toFixed(2)}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-32 w-full rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1.5 text-white/40 hover:border-white/40 hover:text-white/60 transition mb-3"
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Seleccionar imagen</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleSelect}
        />

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiqueta (opcional)"
          className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 mb-3"
        />

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file || !dimensions}
          className="w-full rounded-xl bg-ap-copper px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-40"
        >
          {uploading ? "Subiendo..." : "Agregar imagen"}
        </button>
      </div>

      {/* Existing images grid */}
      {images.length === 0 ? (
        <p className="text-sm text-white/40">Sin imágenes cargadas aún.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
            >
              <img
                src={img.url}
                alt={img.label || "Resultado"}
                className="w-full aspect-square object-cover"
              />
              {img.label && (
                <p className="px-2 py-1.5 text-xs text-white/60 truncate">
                  {img.label}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                disabled={deletingId === img.id}
                className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 text-white/40 hover:text-red-400 hover:bg-red-500/20 transition opacity-0 group-hover:opacity-100 disabled:opacity-40"
                aria-label="Eliminar"
              >
                {deletingId === img.id ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
