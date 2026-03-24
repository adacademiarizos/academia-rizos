import Link from "next/link";
import SectionHead from "./SectionHead";

type FaqItem = { id: string; question: string; answer: string };

function FAQ({ items, color }: { items: FaqItem[]; color?: string }) {
  const isCrema = color === "crema";
  const cremaBg = "rgba(233,214,197,0.7)"; // --color-ap-acent-crema with 70% opacity
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="FAQ"
        title="Preguntas comunes"
        subtitle="¿Tienes alguna duda? puede que la respuesta a ella este en las preguntas mas comunes que nos hacen nuestras clientas."
        color={color}
      />

      <div className="mt-10 grid grid-cols-1 gap-4">
        {items.length === 0 ? (
          <div className={`rounded-3xl p-6 text-sm ${isCrema ? "text-zinc-600" : "border border-black/10 bg-white/5 text-zinc-400"}`}>
            Próximamente — preguntas frecuentes
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className={`rounded-3xl p-6 ${isCrema ? "" : "border border-black/10 bg-white/5 shadow-sm"}`}
              style={isCrema ? ({ backgroundColor: cremaBg } as React.CSSProperties) : undefined}
            >
              <div className={`text-sm font-semibold ${isCrema ? "text-zinc-800" : "text-zinc-200"}`}>{it.question}</div>
              <p className={`mt-2 text-sm ${isCrema ? "text-zinc-600" : "text-zinc-400"}`}>{it.answer}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-10 rounded-[2.2rem] bg-ap-acent-crema/70 p-8 md:p-10">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="text-lg font-semibold text-zinc-800">¿Lista para tu transformación?</div>
            <p className="mt-2 text-sm text-zinc-600">
              Reservá ahora. Te llega confirmación y comprobante por correo.
            </p>
          </div>
          <Link
            href="/booking"
            className="rounded-2xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95 bg-ap-choco"
          >
            Reservar cita
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FAQ;
