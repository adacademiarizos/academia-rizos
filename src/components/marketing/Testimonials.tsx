import SectionHead from "./SectionHead";

// ─── Data ────────────────────────────────────────────────
// Reemplazá avatar con la ruta real cuando tengas las fotos,
// por ejemplo: avatar: "/testimonials/ana.jpg"
const TESTIMONIALS = [
  {
    name: "Ana García",
    role: "Clienta desde 2022",
    quote:
      "Llevaba años luchando con mi rizado. Después de mi primera cita con Elizabeth, salí con el pelo que siempre soñé. La técnica y el asesoramiento personalizado hacen toda la diferencia.",
    stars: 5,
    avatar: null as string | null,
  },
  {
    name: "Valentina López",
    role: "Clienta desde 2023",
    quote:
      "La definición me duró días y por fin entendí mi rutina real. Dejé de gastar en productos que no me funcionaban y ahora cuido mis rizos con confianza.",
    stars: 5,
    avatar: null as string | null,
  },
  {
    name: "Mariana Torres",
    role: "Clienta habitual",
    quote:
      "El corte quedó perfecto: forma, volumen y sin perder largo. Elizabeth explica todo con paciencia y el resultado supera siempre lo que esperaba.",
    stars: 5,
    avatar: null as string | null,
  },
];

// ─── Sub-components ───────────────────────────────────────

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={i < count ? "fill-[#B16E34]" : "fill-zinc-700"}
          width="16"
          height="16"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z" />
        </svg>
      ))}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-11 w-11 flex-shrink-0 rounded-full object-cover border-2 border-[#B16E34]/30"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#B16E34]/40 bg-[#B16E34]/10">
      <span className="text-sm font-bold leading-none text-[#B16E34]">
        {initials}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────

function Testimonials() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Testimonios"
        title="Lo que dicen nuestras clientas"
        subtitle="Experiencias reales de personas que transformaron su relación con su rizado."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          >
            {/* Stars */}
            <Stars count={t.stars} />

            {/* Quote */}
            <blockquote className="mb-6 flex-1 text-sm leading-relaxed text-zinc-300">
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            {/* Author */}
            <div className="flex items-center gap-3 border-t border-white/10 pt-4">
              <Avatar name={t.name} src={t.avatar} />
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-[#B16E34]">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Testimonials;
