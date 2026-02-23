import SectionHead from "./SectionHead";
import Link from "next/link";
import Step from "./Step";

function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Como funciona"
        title="Reservar es simple: 3 pasos"
        subtitle="Simple y rapido, confirma horarios en segundos."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Step
          n="01"
          title="Elije el servicio"
          desc="Selecciona el tipo de atención según tu objetivo."
        />
        <Step
          n="02"
          title="Elije profesional y horario"
          desc="Ves el equipo, precios por persona y la disponibilidad real."
        />
        <Step
          n="03"
          title="Confirmacion con tarjeta"
          desc="Según el servicio, se cobra total, la mitad o se registra método para autorizar."
        />
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-black/10 bg-white/5 p-6 md:flex-row md:items-center">
        <div>
          <div className="text-sm text-zinc-200 font-semibold">¿Lista para tu cita?</div>
          <p className="mt-1 text-sm text-zinc-400">
            Reservá ahora y recibís confirmación + comprobante por email.
          </p>
        </div>
        <Link
          href="/booking"
          className="rounded-2xl bg-[var(--er-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Reservar cita
        </Link>
      </div>
    </div>
  );
}

export default HowItWorks