import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;
  const body = await req.json();
  const { question, answer } = body as { question?: string; answer?: string };

  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_FIELDS", message: "question y answer son requeridos" } },
      { status: 400 }
    );
  }

  const item = await db.faqItem.update({
    where: { id },
    data: { question: question.trim(), answer: answer.trim() },
  });

  return NextResponse.json({ ok: true, data: item });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;

  const item = await db.faqItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Pregunta no encontrada" } },
      { status: 404 }
    );
  }

  await db.faqItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
