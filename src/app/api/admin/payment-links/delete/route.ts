import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request) {
  // Check authentication
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const form = await req.formData();
  const id = String(form.get("id") ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_INPUT", message: "Missing id" } },
      { status: 400 }
    );
  }

  const link = await db.paymentLink.findUnique({
    where: { id },
    include: { payments: { select: { id: true, status: true } } },
  });

  if (!link) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Payment link not found" } },
      { status: 404 }
    );
  }

  // ❌ si está pagado, NO se borra
  if (link.status === "PAID") {
    return NextResponse.json(
      { ok: false, error: { code: "ALREADY_PAID", message: "Cannot delete a paid link" } },
      { status: 400 }
    );
  }

  // (opcional recomendado) si está processing, mejor no borrar
  if (link.status === "PROCESSING") {
    return NextResponse.json(
      { ok: false, error: { code: "IN_PROCESS", message: "Cannot delete while processing. Try again later." } },
      { status: 400 }
    );
  }

  // Si tenés pagos asociados, los borramos primero para evitar FK constraints
  await db.payment.deleteMany({ where: { paymentLinkId: id } });

  // Borrar el link
  await db.paymentLink.delete({ where: { id } });

  // Redirect al admin
  return NextResponse.redirect(new URL("/admin/payment-links", req.url));
}
