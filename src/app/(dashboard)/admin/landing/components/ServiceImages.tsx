"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ImageIcon } from "lucide-react";

const MAX_IMAGES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function ServiceImages({
  serviceId,
  imageUrls: initial,
}: {
  serviceId: string;
  imageUrls: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError("Solo JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Máx. 5MB por imagen.");
      return;
    }
    if (imageUrls.length >= MAX_IMAGES) {
      setError(`Máximo ${MAX_IMAGES} imágenes.`);
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.set("image", file);

    try {
      const res = await fetch(`/api/admin/services/${serviceId}/images`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al subir");
      setImageUrls(json.data.imageUrls);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(url: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/services/${serviceId}/images?url=${encodeURIComponent(url)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al eliminar");
      setImageUrls(json.data.imageUrls);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error al eliminar");
    }
  }

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-2">
        Imágenes de referencia ({imageUrls.length}/{MAX_IMAGES})
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Existing images */}
        {imageUrls.map((url) => (
          <div key={url} className="relative group h-16 w-16 rounded-xl overflow-hidden">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleDelete(url)}
              className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}

        {/* Upload button */}
        {imageUrls.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-16 w-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1 text-white/40 hover:border-white/40 hover:text-white/60 transition disabled:opacity-40"
          >
            {uploading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span className="text-[9px]">Subir</span>
              </>
            )}
          </button>
        )}

        {/* Placeholder when no images */}
        {imageUrls.length === 0 && !uploading && (
          <div className="flex items-center gap-2 text-xs text-white/30">
            <ImageIcon className="h-3.5 w-3.5" />
            Sin imágenes aún
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}

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
