import SectionHead from "./SectionHead";
import Link from "next/link";
import Step from "./Step";

function HowItWorks({ color }: { color?: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Como funciona"
        title="Reservar es simple: 3 pasos"
        color={color}
        subtitle="Simple y rapido, confirma horarios en segundos."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Step
          n="01"
          title="Elije el servicio"
          desc="Selecciona el tipo de atención según tu objetivo."
          color={color}
        />
        <Step
          n="02"
          title="Elije profesional y horario"
          desc="Ves el equipo, precios por persona y la disponibilidad real."
          color={color}
        />
        <Step
          n="03"
          title="Confirmacion con tarjeta"
          desc="Según el servicio, se cobra total, la mitad o se registra método para autorizar."
          color={color}
        />
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-ap-acent-crema/70 p-6 md:flex-row md:items-center">
        <div>
          <div className="text-sm text-zinc-800 font-semibold">¿Lista para tu cita?</div>
          <p className="mt-1 text-sm text-zinc-600">
            Reservá ahora y recibís confirmación + comprobante por email.
          </p>
        </div>
        <Link
          href="/booking"
          className="rounded-2xl bg-ap-choco px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Reservar cita
        </Link>
      </div>
    </div>
  );
}

export default HowItWorks