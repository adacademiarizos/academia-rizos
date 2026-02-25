import Link from "next/link";
import SectionHead from "./SectionHead";

type FaqItem = { id: string; question: string; answer: string };

function FAQ({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="FAQ"
        title="Preguntas comunes"
        subtitle="¿Tienes alguna duda? puede que la respuesta a ella este en las preguntas mas comunes que nos hacen nuestras clientas."
      />

      <div className="mt-10 grid grid-cols-1 gap-4">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-black/10 bg-white/5 p-6 text-sm text-zinc-400">
            Próximamente — preguntas frecuentes
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="rounded-3xl border border-black/10 bg-white/5 p-6 shadow-sm">
              <div className="text-sm text-zinc-200 font-semibold">{it.question}</div>
              <p className="mt-2 text-sm text-zinc-400">{it.answer}</p>
            </div>
          ))
        )}
      </div>

      <div className="mt-10 rounded-[2.2rem] border border-black/10 bg-white/55 p-8 shadow-sm md:p-10">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="text-lg font-semibold text-zinc-900">¿Lista para tu transformación?</div>
            <p className="mt-2 text-sm text-zinc-800">
              Reservá ahora. Te llega confirmación y comprobante por correo.
            </p>
          </div>
          <Link
            href="/booking"
            className="rounded-2xl bg-(--er-copper) px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Reservar cita
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FAQ;
