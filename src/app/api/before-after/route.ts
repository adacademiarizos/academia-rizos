import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const pairs = await db.beforeAfterPair.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, data: pairs });
}
