import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkAdminAuth } from "@/lib/admin-auth";
import {
  CONTACT_CONTENT_MIGRATION_MESSAGE,
  getAllContactContent,
  upsertAllContactContent,
} from "@/lib/contact-content";

export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const data = await getAllContactContent();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error loading contact content:", error);
    return NextResponse.json(
      { ok: false, error: "Error al cargar la seccion de contacto" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const data = await upsertAllContactContent(body ?? {});
    revalidatePath("/");
    revalidatePath("/salon");
    revalidatePath("/academia");
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al guardar la seccion de contacto";
    const status = message === CONTACT_CONTENT_MIGRATION_MESSAGE ? 500 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
