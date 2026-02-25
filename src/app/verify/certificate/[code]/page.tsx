import { db } from "@/lib/db";
import Link from "next/link";
import { CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const certificate = await db.certificate.findUnique({
    where: { code },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true } },
    },
  });

  return (
    <div className="min-h-screen bg-[#181716] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="font-serif text-xl font-bold text-[#B16E34]">Apoteósicas</span>
            <span className="block text-xs text-[#FAF4EA]/40 tracking-widest uppercase mt-0.5">
              by Elizabeth Rizos
            </span>
          </Link>
        </div>

        {/* Card */}
        {!certificate ? (
          <NotFoundCard code={code} />
        ) : !certificate.valid ? (
          <RevokedCard certificate={certificate} />
        ) : (
          <ValidCard certificate={certificate} />
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[#FAF4EA]/20">
          Verificación de certificado — Apoteósicas Academia
        </p>
      </div>
    </div>
  );
}

function NotFoundCard({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <h1 className="text-lg font-semibold text-white">Certificado no encontrado</h1>
      <p className="mt-2 text-sm text-white/50">
        No existe ningún certificado con el código:
      </p>
      <p className="mt-1 font-mono text-sm text-[#B16E34]">{code}</p>
      <p className="mt-4 text-xs text-white/30">
        Si crees que esto es un error, contactá a soporte.
      </p>
    </div>
  );
}

function RevokedCard({
  certificate,
}: {
  certificate: { user: { name: string | null }; course: { title: string }; code: string; issuedAt: Date };
}) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
        <XCircle className="h-7 w-7 text-red-400" />
      </div>
      <h1 className="text-lg font-semibold text-white">Certificado revocado</h1>
      <p className="mt-2 text-sm text-white/50">
        Este certificado fue emitido pero ya no es válido.
      </p>
      <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 text-left space-y-1">
        <Row label="Estudiante" value={certificate.user.name ?? "—"} />
        <Row label="Curso" value={certificate.course.title} />
        <Row label="Código" value={certificate.code} mono />
      </div>
    </div>
  );
}

function ValidCard({
  certificate,
}: {
  certificate: {
    user: { name: string | null };
    course: { title: string };
    code: string;
    issuedAt: Date;
    pdfUrl: string | null;
  };
}) {
  const dateStr = certificate.issuedAt.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-2xl border border-[#B16E34]/30 bg-[#B16E34]/5 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#B16E34]/15 border border-[#B16E34]/30 shrink-0">
          <CheckCircle className="h-6 w-6 text-[#B16E34]" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#FAF4EA]">Certificado válido</h1>
          <p className="text-xs text-[#FAF4EA]/50">Este certificado es auténtico y está vigente.</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="text-center pb-3 border-b border-white/10">
          <p className="text-xs text-[#FAF4EA]/40 uppercase tracking-widest mb-1">Certificado de Finalización</p>
          <p className="text-xl font-serif font-bold text-[#B16E34]">
            {certificate.user.name ?? "Estudiante"}
          </p>
        </div>
        <Row label="Curso" value={certificate.course.title} />
        <Row label="Emitido" value={dateStr} />
        <Row label="Código" value={certificate.code} mono />
      </div>

      {certificate.pdfUrl && (
        <a
          href={certificate.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B16E34] px-4 py-3 text-sm font-semibold text-[#FAF4EA] hover:bg-[#9d6230] transition"
        >
          <Download className="h-4 w-4" />
          Descargar certificado PDF
        </a>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[#FAF4EA]/40 shrink-0">{label}</span>
      <span
        className={`text-right text-[#FAF4EA]/80 ${mono ? "font-mono text-xs text-[#B16E34]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
