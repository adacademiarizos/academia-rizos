"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail, ShieldAlert, Trash2 } from "lucide-react";

type Props = {
  userName: string | null;
  userEmail: string;
  role: "ADMIN" | "STAFF" | "STUDENT";
  hasPassword: boolean;
  initialDeleteToken: string | null;
};

type RequestState = {
  requestId: string;
  confirmationMethod: "password" | "email";
  expiresAt: string | null;
} | null;

export function AccountDeletionPanel({
  userName,
  userEmail,
  role,
  hasPassword,
  initialDeleteToken,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [requestState, setRequestState] = useState<RequestState>(null);
  const [deleteToken, setDeleteToken] = useState(initialDeleteToken);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  async function startDeletionRequest() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/account/delete/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "No pudimos crear la solicitud");
      }

      if (json.alreadyDeleted) {
        setCompleted(true);
        setMessage(json.message);
        return;
      }

      setRequestState(json.data);
      setMessage(json.message);

      if (json.data?.confirmationMethod === "password") {
        setShowPasswordModal(true);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos crear la solicitud"
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeletion() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestState?.requestId,
          password: hasPassword ? password : undefined,
          token: deleteToken ?? undefined,
          reason,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "No pudimos eliminar la cuenta");
      }

      setCompleted(true);
      setMessage(json.message);
      setPassword("");
      setShowPasswordModal(false);
      setDeleteToken(null);
      setTimeout(() => router.push("/signin"), 1200);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "No pudimos eliminar la cuenta"
      );
    } finally {
      setLoading(false);
    }
  }

  const needsPasswordConfirmation =
    hasPassword && requestState?.confirmationMethod === "password";
  const hasEmailConfirmationReady = Boolean(deleteToken);
  const showInlineError = Boolean(error && !showPasswordModal);

  function openPasswordModal() {
    setError(null);
    setShowPasswordModal(true);
  }

  function closePasswordModal() {
    setError(null);
    setPassword("");
    setShowPasswordModal(false);
  }

  return (
    <>
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-[#b16e34]/35 bg-[#b16e34]/10 p-3 text-[#f3d5b4]">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Eliminar mi cuenta</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Esta acción anonimiza tu perfil y elimina el acceso futuro con estas
              credenciales. Antes de continuar, revisa bien el alcance y confirma la
              solicitud de forma explícita.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Perfil"
            body={`${userName ?? "Tu cuenta"} (${role}) dejará de estar accesible.`}
          />
          <InfoCard
            icon={<Mail className="h-4 w-4" />}
            title="Email"
            body={`El email ${userEmail} se sustituirá por un identificador anónimo único.`}
          />
          <InfoCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Contenido"
            body="Mensajes, comentarios e imágenes asociadas se anonimizarán o eliminarán de R2."
          />
        </div>

        <label className="mt-6 block text-sm font-semibold text-white">
          Motivo opcional
        </label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Puedes contarnos por qué deseas eliminar tu cuenta."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#b16e34]/60"
        />

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {showInlineError && (
          <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {requestState?.confirmationMethod === "email" &&
          !deleteToken &&
          !completed && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
              Revisa tu correo y abre el enlace de confirmacion. Cuando regreses aqui
              con el token, podras completar el borrado.
            </div>
          )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!requestState && !deleteToken && !completed && (
            <button
              type="button"
              onClick={startDeletionRequest}
              disabled={loading}
              className="rounded-full bg-[#b16e34] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Preparando..." : "Solicitar eliminación"}
            </button>
          )}

          {needsPasswordConfirmation && !completed && (
            <button
              type="button"
              onClick={openPasswordModal}
              disabled={loading}
              className="rounded-full border border-red-400/25 bg-red-500/15 px-6 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar en modal
            </button>
          )}

          {hasEmailConfirmationReady && !completed && (
            <button
              type="button"
              onClick={confirmDeletion}
              disabled={loading}
              className="rounded-full border border-red-400/25 bg-red-500/15 px-6 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Eliminando..." : "Confirmar eliminación definitiva"}
            </button>
          )}
        </div>
      </section>

      {showPasswordModal && needsPasswordConfirmation && !completed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-deletion-modal-title"
          onClick={closePasswordModal}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#181716] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="account-deletion-modal-title"
              className="text-xl font-semibold text-white"
            >
              Confirma con tu contraseña
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Este último paso confirma que quieres anonimizar tu cuenta y tus datos
              personales.
            </p>

            <label className="mt-5 block text-sm font-semibold text-white">
              Contrasena actual
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Escribe tu contraseña actual"
              autoFocus
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#b16e34]/60"
            />

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={loading}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletion}
                disabled={loading || password.trim().length === 0}
                className="rounded-full border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Eliminando..." : "Confirmar eliminación definitiva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-[#f3d5b4]">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-white/55">{body}</p>
    </div>
  );
}
