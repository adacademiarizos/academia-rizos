import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await ctx.params;

  const image = await db.resultImage.findUnique({ where: { id } });
  if (!image) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Imagen no encontrada" } },
      { status: 404 }
    );
  }

  // Clean up R2 file
  try {
    const keyMatch = image.url.match(/results\/.+$/);
    if (keyMatch) {
      await deleteFile(keyMatch[0]);
    }
  } catch (e) {
    console.error("Failed to delete R2 file:", e);
  }

  await db.resultImage.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
