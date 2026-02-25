import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET() {
  const items = await db.faqItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { question, answer } = body as { question?: string; answer?: string };

  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_FIELDS", message: "question y answer son requeridos" } },
      { status: 400 }
    );
  }

  const maxOrder = await db.faqItem.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const item = await db.faqItem.create({
    data: { question: question.trim(), answer: answer.trim(), order },
  });

  return NextResponse.json({ ok: true, data: item }, { status: 201 });
}
