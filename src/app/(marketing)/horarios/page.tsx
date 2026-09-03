import type { Metadata } from "next";
import Schedule from "@/components/marketing/Schedule";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Horarios — Apoteósicas",
  description: "Consultá los horarios de atención de Apoteósicas by Elizabeth Rizos.",
};

export default function HorariosPage() {
  return (
    <main className="bg-ap-crema" >
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
          className="text-4xl md:text-5xl font-normal text-black mb-4"
        >
          Nuestros Horarios
        </h1>
        <p className="text-zinc-600 max-w-md mx-auto text-sm leading-relaxed">
          Encuéntranos de lunes a viernes. Reserva tu cita con antelación para asegurarte el horario.
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
