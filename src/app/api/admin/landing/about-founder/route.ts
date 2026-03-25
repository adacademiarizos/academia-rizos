import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkAdminAuth } from "@/lib/admin-auth";
import {
  ABOUT_FOUNDER_MIGRATION_MESSAGE,
  getAboutFounderContent,
  normalizeAboutFounderContent,
  upsertAboutFounderContent,
} from "@/lib/about-founder-content";

export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const data = await getAboutFounderContent();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error loading AboutFounder content:", error);
    return NextResponse.json(
      { ok: false, error: "Error al cargar la seccion AboutFounder" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const normalized = normalizeAboutFounderContent(body ?? {});
    const data = await upsertAboutFounderContent(normalized);
    revalidatePath("/");
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al guardar la seccion AboutFounder";
    const status = message === ABOUT_FOUNDER_MIGRATION_MESSAGE ? 500 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
