import SectionHead from "./SectionHead";
import Link from "next/link";

function AboutFounder() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Sobre Elizabeth"
        title="Experiencia, técnica y una comunidad que se siente"
        subtitle="Un enfoque cálido pero profesional. Acá va una bio corta y un CTA fuerte a reservas."
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:align-middle">
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/40">
          <img
            src="/Elizabeth.webp"
            alt="Founder stock"
            className="h-full w-full max-h-125 object-top object-cover"
            loading="lazy"
          />
        </div>

        <div className="rounded-3xl p-8 shadow-sm backdrop-blur-md">
          <h3 className="text-6xl text-white font-main font-semibold">Tu rizo no es “difícil”, está mal entendido.</h3>
          <p className="mt-3 text-sm text-zinc-400 md:text-base">
            El objetivo no es solo que se vea bien hoy: es que tengas una rutina clara, productos adecuados y técnica para
            mantener definición, hidratación y forma.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/booking"
              className="rounded-2xl bg-(--er-copper) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Reservar cita
            </Link>
            <Link
              href="/services"
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Ver servicios
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


export default AboutFounder