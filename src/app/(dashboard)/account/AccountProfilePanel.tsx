"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const cardClass =
  "rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl";
const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm text-white outline-none transition focus:border-ap-copper/60";
const labelClass = "block text-sm font-medium text-white/70 mb-2";

export function AccountProfilePanel({
  initialName,
  initialPhone,
  initialImage,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialImage: string | null;
  email: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage);
  const [preview, setPreview] = useState<string | null>(initialImage);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const initials = (name.trim()[0] ?? "U").toUpperCase();

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen no puede superar 3 MB");
      return;
    }

    setError("");
    setSaved(false);
    setUploading(true);
    // Show the local file straight away so the picker feels instant; the
    // uploaded URL replaces it once storage answers.
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/me/avatar", { method: "POST", body: formData });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "No se pudo subir la imagen");
      }

      setImageUrl(payload.data.url);
      setPreview(payload.data.url);
    } catch (uploadError) {
      setPreview(imageUrl);
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (name.trim().length < 2) {
      setError("Escribe tu nombre completo");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          image: imageUrl,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "No se pudieron guardar los cambios");
      }

      // The sidebar and the navbar read the name and the avatar straight from
      // the session, so refreshing it is what makes the change visible without
      // a full reload.
      await update({ name: name.trim(), image: imageUrl });
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <h2 className="text-base font-semibold text-white">Datos personales</h2>
      <p className="mt-1 text-sm text-white/55">
        Tu nombre es el que se imprime en los certificados que emitimos.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        {preview ? (
          <img
            src={preview}
            alt=""
            className="h-20 w-20 rounded-3xl border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-ap-copper/30 bg-ap-copper/15 text-2xl font-bold text-ap-copper">
            {initials}
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Cambiar foto"}
          </button>
          <p className="mt-2 text-xs text-white/40">JPG, PNG, GIF o WebP · máx. 3 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handlePickImage}
          className="hidden"
        />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="account-name" className={labelClass}>
            Nombre completo
          </label>
          <input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="account-phone" className={labelClass}>
            Teléfono (opcional)
          </label>
          <input
            id="account-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
            maxLength={40}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className={labelClass}>Correo electrónico</label>
        <input value={email} readOnly disabled className={`${inputClass} opacity-60`} />
        <p className="mt-2 text-xs text-white/40">
          El correo identifica tu cuenta y tus compras. Escríbenos si necesitas cambiarlo.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-5 rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          Cambios guardados.
        </p>
      )}

      <button
        type="submit"
        disabled={saving || uploading}
        className="mt-6 rounded-full bg-ap-copper px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
