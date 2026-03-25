import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import CertificateList from "@/app/(dashboard)/admin/certificates/CertificateList";

export async function CourseCertificatesView() {
  const certificates = await db.certificate.findMany({
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Certificados</h1>
          <p className="mt-1 text-sm text-white/50">
            Certificados emitidos a estudiantes que completaron sus cursos.
          </p>
        </div>
        <Link
          href="/admin/courses/review"
          className="flex items-center gap-2 rounded-xl bg-ap-copper/20 border border-ap-copper/30 px-4 py-2 text-sm font-medium text-ap-copper hover:bg-ap-copper/30 transition"
        >
          <ClipboardCheck className="h-4 w-4" />
          Revisar examenes
        </Link>
      </div>

      <CertificateList
        certificates={certificates.map((c) => ({
          ...c,
          issuedAt: c.issuedAt.toISOString(),
        }))}
      />
    </div>
  );
}
