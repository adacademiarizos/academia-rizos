"use client";

import { useState } from "react";

const cardClass =
  "rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl";
const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm text-white outline-none transition focus:border-ap-copper/60";
const labelClass = "block text-sm font-medium text-white/70 mb-2";

export function AccountPasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setDone(false);

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "No se pudo actualizar la contraseña");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <h2 className="text-base font-semibold text-white">
        {hasPassword ? "Cambiar contraseña" : "Crear una contraseña"}
      </h2>
      <p className="mt-1 text-sm text-white/55">
        {hasPassword
          ? "Necesitarás tu contraseña actual para confirmar el cambio."
          : "Entraste con Google, así que todavía no tienes contraseña. Crea una para poder entrar también con tu correo."}
      </p>

      <div className="mt-6 grid gap-5">
        {hasPassword && (
          <div>
            <label htmlFor="current-password" className={labelClass}>
              Contraseña actual
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="new-password" className={labelClass}>
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className={labelClass}>
              Repite la contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-5 rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          Contraseña actualizada.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {saving ? "Guardando..." : hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
      </button>
    </form>
  );
}
