import { db } from "@/lib/db";
import ResultsUploader from "./ResultsUploader";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const images = await db.resultImage.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-white">Resultados</h1>
      <p className="mt-1 text-sm text-white/50">
        Imágenes que se muestran en la galería de resultados de la página
        principal.
      </p>
      <ResultsUploader initial={images} />
    </main>
  );
}
