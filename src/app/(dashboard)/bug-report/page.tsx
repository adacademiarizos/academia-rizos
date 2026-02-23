"use client";

import { useState, useRef, useCallback } from "react";
import { Bug, Upload, X, CheckCircle, AlertTriangle, ImageIcon } from "lucide-react";

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 5;

type SubmitState = "idle" | "uploading" | "success" | "error";

export default function BugReportPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bugType, setBugType] = useState<"CONTENT" | "FUNCTIONALITY" | "">("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(files)) {
      if (images.length + newFiles.length >= MAX_IMAGES) break;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) continue;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) continue;
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setImages((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, [images.length]);

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !bugType) {
      setErrorMsg("Por favor completa todos los campos.");
      return;
    }
    setErrorMsg("");
    setState("uploading");

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("bugType", bugType);
    for (const img of images) formData.append("images", img);

    try {
      const res = await fetch("/api/bug-reports", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok) {
        setState("success");
        setTitle("");
        setDescription("");
        setBugType("");
        setImages([]);
        setPreviews([]);
      } else {
        setErrorMsg(data.error ?? "Error al enviar el reporte.");
        setState("error");
      }
    } catch {
      setErrorMsg("Error de conexión. Intenta de nuevo.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="h-16 w-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">¡Reporte enviado!</h2>
        <p className="text-white/60 text-sm mb-8">
          Gracias por ayudar a mejorar la plataforma. Revisaremos tu reporte a la brevedad.
        </p>
        <button
          onClick={() => setState("idle")}
          className="px-6 py-2.5 bg-ap-copper hover:bg-orange-700 text-white rounded-xl font-medium transition"
        >
          Enviar otro reporte
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Bug className="h-6 w-6 text-ap-copper" /> Reportar un Problema
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          ¿Encontraste un error o algo que no funciona bien? Cuéntanos los detalles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Bug type */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Tipo de problema *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBugType("CONTENT")}
              className={`p-4 rounded-[20px] border text-left transition ${
                bugType === "CONTENT"
                  ? "border-ap-copper/60 bg-ap-copper/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              <div className="text-base font-semibold mb-1">📝 Contenido</div>
              <div className="text-xs opacity-70">Error en información, texto, videos o recursos</div>
            </button>
            <button
              type="button"
              onClick={() => setBugType("FUNCTIONALITY")}
              className={`p-4 rounded-[20px] border text-left transition ${
                bugType === "FUNCTIONALITY"
                  ? "border-orange-500/60 bg-orange-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              <div className="text-base font-semibold mb-1">⚙️ Funcionalidad</div>
              <div className="text-xs opacity-70">Algo no funciona, error de sistema o plataforma</div>
            </button>
          </div>
          {bugType === "FUNCTIONALITY" && (
            <div className="mt-2 flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">
                Los problemas de funcionalidad se notificarán directamente al equipo técnico por correo.
              </p>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Título *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resumen breve del problema"
            maxLength={150}
            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-3 outline-none focus:border-ap-copper/50 transition text-sm"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Descripción detallada *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe paso a paso qué pasó, qué esperabas que pasara, y cualquier detalle relevante..."
            maxLength={2000}
            rows={6}
            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-3 outline-none focus:border-ap-copper/50 transition text-sm resize-y"
            required
          />
          <div className="text-right text-xs text-white/30 mt-1">{description.length}/2000</div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Capturas de pantalla (opcional, máx. {MAX_IMAGES})
          </label>

          {/* Drop zone */}
          {images.length < MAX_IMAGES && (
            <div
              className="border-2 border-dashed border-white/20 rounded-[20px] p-6 text-center cursor-pointer hover:border-ap-copper/40 hover:bg-white/5 transition"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-8 w-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm text-white/50">
                Arrastrá imágenes aquí o <span className="text-ap-copper">hacé clic para seleccionar</span>
              </p>
              <p className="text-xs text-white/30 mt-1">JPG, PNG, WEBP, GIF · Máx. {MAX_SIZE_MB}MB por imagen</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3">
              {previews.map((src, i) => (
                <div key={i} className="relative group aspect-square">
                  <img
                    src={src}
                    alt={`Screenshot ${i + 1}`}
                    className="h-full w-full object-cover rounded-xl border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-ap-copper/40 flex items-center justify-center text-white/30 hover:text-ap-copper transition"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={state === "uploading"}
          className="w-full py-3.5 bg-ap-copper hover:bg-orange-700 text-white rounded-xl font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {state === "uploading" ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Enviando reporte...
            </>
          ) : (
            <>
              <Bug className="h-4 w-4" />
              Enviar reporte
            </>
          )}
        </button>
      </form>
    </div>
  );
}
