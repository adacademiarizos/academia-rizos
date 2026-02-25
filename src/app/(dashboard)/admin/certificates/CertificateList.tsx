"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Download, Clock } from "lucide-react";

type Certificate = {
  id: string;
  code: string;
  pdfUrl: string | null;
  issuedAt: string;
  valid: boolean;
  user: { name: string | null; email: string };
  course: { title: string };
};

function isPending(cert: Certificate) {
  return !cert.valid && !cert.pdfUrl;
}

export default function CertificateList({ certificates }: { certificates: Certificate[] }) {
  const router = useRouter();

  async function toggleValid(id: string, currentValid: boolean) {
    await fetch(`/api/admin/certificates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valid: !currentValid }),
    });
    router.refresh();
  }

  async function approveCert(id: string) {
    const res = await fetch(`/api/admin/certificates/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert("Error al aprobar: " + (data.error ?? "Error desconocido"));
      return;
    }
    router.refresh();
  }

  if (certificates.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
        No hay certificados todavía.
      </div>
    );
  }

  const pending = certificates.filter(isPending);
  const issued = certificates.filter((c) => !isPending(c));

  return (
    <div className="mt-6 space-y-8">
      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ap-copper uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pendientes de aprobación ({pending.length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-ap-copper/20">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-ap-copper/5 text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Fecha solicitud</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((cert) => (
                  <PendingRow key={cert.id} cert={cert} onApprove={approveCert} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issued / revoked */}
      {issued.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Certificados emitidos ({issued.length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((cert) => (
                  <tr
                    key={cert.id}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{cert.user.name ?? "—"}</div>
                      <div className="text-xs text-white/40">{cert.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{cert.course.title}</td>
                    <td className="px-4 py-3 text-white/60">
                      {new Date(cert.issuedAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-ap-copper">{cert.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      {cert.pdfUrl ? (
                        <a
                          href={cert.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-ap-copper hover:text-ap-copper/70 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="text-xs">Descargar</span>
                        </a>
                      ) : (
                        <span className="text-white/30 text-xs">Sin PDF</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ValidToggle
                        id={cert.id}
                        valid={cert.valid}
                        onToggle={toggleValid}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRow({
  cert,
  onApprove,
}: {
  cert: Certificate;
  onApprove: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await onApprove(cert.id);
    setLoading(false);
  }

  return (
    <tr className="border-b border-white/5 hover:bg-ap-copper/[0.03] transition">
      <td className="px-4 py-3">
        <div className="font-medium text-white">{cert.user.name ?? "—"}</div>
        <div className="text-xs text-white/40">{cert.user.email}</div>
      </td>
      <td className="px-4 py-3 text-white/80">{cert.course.title}</td>
      <td className="px-4 py-3 text-white/60">
        {new Date(cert.issuedAt).toLocaleDateString("es-ES")}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-ap-copper text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-50 transition"
        >
          {loading ? "Generando..." : "✓ Aprobar y emitir"}
        </button>
      </td>
    </tr>
  );
}

function ValidToggle({
  id,
  valid,
  onToggle,
}: {
  id: string;
  valid: boolean;
  onToggle: (id: string, currentValid: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await onToggle(id, valid);
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs transition disabled:opacity-50"
      title={valid ? "Revocar certificado" : "Reactivar certificado"}
    >
      {valid ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-green-400">Válido</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-red-400" />
          <span className="text-red-400">Revocado</span>
        </>
      )}
    </button>
  );
}

