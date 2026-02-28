import { db } from "@/lib/db";
import BeforeAfterUploader from "./BeforeAfterUploader";

export const dynamic = "force-dynamic";

export default async function AdminBeforeAfterPage() {
  const pairs = await db.beforeAfterPair.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-white">Antes y Después</h1>
      <p className="mt-1 text-sm text-white/50">
        Imágenes que se muestran en la sección de resultados de la página principal.
      </p>
      <BeforeAfterUploader initial={pairs} />
    </main>
  );
}
