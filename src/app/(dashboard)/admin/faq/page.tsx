import { db } from "@/lib/db";
import FaqManager from "./FaqManager";

export default async function AdminFaqPage() {
  const items = await db.faqItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-white">Preguntas Frecuentes</h1>
      <p className="mt-1 text-sm text-white/50">
        Preguntas que se muestran en la sección FAQ de la página principal.
      </p>
      <FaqManager initial={items} />
    </main>
  );
}
