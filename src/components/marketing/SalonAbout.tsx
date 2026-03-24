import SectionHead from "./SectionHead";
import Link from "next/link";

const STATS = [
  { value: "500+", label: "Rizos transformados" },
  { value: "100%", label: "Productos aprobados CG" },
  { value: "5+", label: "Años de experiencia" },
  { value: "4.9★", label: "Valoración media" },
];

function SalonAbout({ color }: { color?: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Nuestro Salon"
        title="Un espacio diseñado para tu rizo"
        subtitle="No es solo un corte: es un diagnóstico, una técnica y un plan de cuidado personalizado."
        color={color}
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className={`rounded-3xl border border-white/10 ${color === "crema" ? "bg-ap-acent-crema/70" : "bg-white/5"} p-8 backdrop-blur-sm`}>
          <h3 className="text-xl font-semibold text-black">
            Filosofía Apoteósicas
          </h3>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            Creemos que cada rizo es único y merece un enfoque personalizado. No
            trabajamos con fórmulas genéricas: estudiamos tu porosidad, densidad,
            grosor y patrón de rizo para diseñar un plan de cuidado que funcione
            en tu día a día.
          </p>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            Nuestro equipo está formado en el Método Curly Girl y técnicas
            avanzadas de corte rizado (Deva Cut, Ri Ci, corte en seco). Usamos
            exclusivamente productos aprobados — sin sulfatos, sin siliconas no
            solubles.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/booking"
              className="rounded-2xl bg-ap-choco px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Reservar cita
            </Link>
            <Link
              href="#faq"
              className={`rounded-2xl border border-white/15 ${color === "crema" ? "bg-ap-crema/70" : "bg-white/10"} px-5 py-3 text-sm font-semibold ${color === "crema" ? "text-ap-choco" : "text-black"} transition hover:bg-white/15`}
            >
              Preguntas frecuentes
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className={`flex flex-col items-center justify-center rounded-2xl border border-white/10 ${color === "crema" ? "bg-ap-acent-crema/70" : "bg-white/5"} p-6 text-center backdrop-blur-sm`}
            >
              <div className="text-2xl font-bold text-ap-choco">
                {s.value}
              </div>
              <div className="mt-2 text-xs text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SalonAbout;
