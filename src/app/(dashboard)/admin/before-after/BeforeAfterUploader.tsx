"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Trash2 } from "lucide-react";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Pair = { id: string; beforeUrl: string; afterUrl: string; label: string | null };

export default function BeforeAfterUploader({ initial }: { initial: Pair[] }) {
  const router = useRouter();
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef  = useRef<HTMLInputElement>(null);

  const [pairs, setPairs]         = useState<Pair[]>(initial);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile,  setAfterFile]  = useState<File | null>(null);
  const [label, setLabel]           = useState("");
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    if (!ALLOWED.includes(file.type)) return "Solo JPEG, PNG o WebP.";
    if (file.size > MAX_SIZE) return "Máx. 10MB por imagen.";
    return null;
  }

  function handleSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setter(f);
  }

  async function handleUpload() {
    if (!beforeFile || !afterFile) {
      setError("Seleccioná ambas imágenes (antes y después).");
      return;
    }
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.set("before", beforeFile);
    form.set("after",  afterFile);
    if (label.trim()) form.set("label", label.trim());

    try {
      const res  = await fetch("/api/admin/before-after", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al subir");
      setPairs((p) => [...p, json.data]);
      setBeforeFile(null);
      setAfterFile(null);
      setLabel("");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res  = await fetch(`/api/admin/before-after/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al eliminar");
      setPairs((p) => p.filter((x) => x.id !== id));
      router.refresh();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Upload form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 max-w-xl">
        <p className="text-sm font-semibold text-white/70 mb-4">Agregar nuevo par</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Before */}
          <FileSlot
            label="ANTES"
            file={beforeFile}
            inputRef={beforeRef}
            onSelect={(e) => handleSelect(e, setBeforeFile)}
            onClear={() => setBeforeFile(null)}
          />
          {/* After */}
          <FileSlot
            label="DESPUÉS"
            file={afterFile}
            inputRef={afterRef}
            onSelect={(e) => handleSelect(e, setAfterFile)}
            onClear={() => setAfterFile(null)}
          />
        </div>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiqueta (opcional, ej: Resultado 1)"
          className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 mb-3"
        />

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !beforeFile || !afterFile}
          className="w-full rounded-xl bg-ap-copper px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-40"
        >
          {uploading ? "Subiendo…" : "Agregar par"}
        </button>
      </div>

      {/* Existing pairs */}
      {pairs.length === 0 ? (
        <p className="text-sm text-white/40">Sin pares cargados aún.</p>
      ) : (
        <div className="grid gap-3">
          {pairs.map((pair) => (
            <div
              key={pair.id}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex gap-2 shrink-0">
                <img src={pair.beforeUrl} alt="Antes"   className="h-16 w-24 rounded-xl object-cover" />
                <img src={pair.afterUrl}  alt="Después" className="h-16 w-24 rounded-xl object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/50 uppercase tracking-wide">Antes / Después</p>
                {pair.label && <p className="text-sm font-semibold text-white mt-0.5">{pair.label}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(pair.id)}
                disabled={deletingId === pair.id}
                className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                aria-label="Eliminar"
              >
                {deletingId === pair.id ? (
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

function FileSlot({
  label,
  file,
  inputRef,
  onSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1">{label}</p>
      {file ? (
        <div className="relative">
          <img
            src={URL.createObjectURL(file)}
            alt={label}
            className="h-28 w-full rounded-xl object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-28 w-full rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1.5 text-white/40 hover:border-white/40 hover:text-white/60 transition"
        >
          <Upload className="h-4 w-4" />
          <span className="text-[10px]">Seleccionar</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onSelect}
      />
    </div>
  );
}
