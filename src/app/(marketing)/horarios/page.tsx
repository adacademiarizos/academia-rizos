import type { Metadata } from "next";
import Schedule from "@/components/marketing/Schedule";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Horarios — Apoteósicas",
  description: "Consultá los horarios de atención de Apoteósicas by Elizabeth Rizos.",
};

export default function HorariosPage() {
  return (
    <main>
      {/* Hero */}
      <section className="py-16 text-center px-4">
        <p
          style={{ fontFamily: "Georgia, serif", letterSpacing: "4px" }}
          className="text-xs uppercase text-[#B16E34] mb-4"
        >
          Apoteósicas
        </p>
        <h1
          style={{ fontFamily: "Georgia, serif" }}
          className="text-4xl md:text-5xl font-normal text-[#FAF4EA] mb-4"
        >
          Nuestros Horarios
        </h1>
        <p className="text-[#C4B49A] max-w-md mx-auto text-sm leading-relaxed">
          Encontranos de lunes a viernes. Reservá tu turno con anticipación para asegurarte el horario.
        </p>
      </section>

      {/* Schedule cards */}
      <section className="pb-20 px-4">
        <div className="mx-auto max-w-lg">
          <Schedule />
        </div>
      </section>
    </main>
  );
}
