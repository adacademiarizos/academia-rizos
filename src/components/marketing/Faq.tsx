import Link from "next/link";
import SectionHead from "./SectionHead";

function FAQ() {
  const items = [
    {
      q: "¿Por qué se pide tarjeta para reservar si no se realizara un debito?",
      a: "Para confirmar la cita y que verdaderamente el cliente vendra, Si no realiza una notificacion almenos con 24 horas de antelacion de que no podra asistir a la hora acordada se le realizara una reduccion del 50% de la cita.",
    },
    {
      q: "¿Puedo elegir a la profesional?",
      a: "Sí. Puedes seleccionás el servicio y luego el miembro del equipo que gustes.",
    },
    {
      q: "¿La academia es efectiva?",
      a: "!Por supuesto! con la academia de rizos puedes aprender todos los trucos de como mantener a lo largo del tiempo tus rizos y podras utilizar estas tacticas con clientes reales. tips de como mantenerlos hidratados, mejores productos. Todo lo que requieras saber se encuentra en la academia",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="FAQ"
        title="Preguntas comunes"
        subtitle="¿Tienes alguna duda? puede que la respuesta a ella este en las preguntas mas comunes que nos hacen nuestras clientas."
      />

      <div className="mt-10 grid grid-cols-1 gap-4">
        {items.map((it) => (
          <div key={it.q} className="rounded-3xl border border-black/10 bg-white/5 p-6 shadow-sm">
            <div className="text-sm text-zinc-200 font-semibold">{it.q}</div>
            <p className="mt-2 text-sm text-zinc-400">{it.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[2.2rem] border border-black/10 bg-white/55 p-8 shadow-sm md:p-10">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="text-lg font-semibold">¿Lista para tu transformación?</div>
            <p className="mt-2 text-sm text-zinc-700">
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

export default FAQ