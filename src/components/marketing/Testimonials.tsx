"use client";

import { useEffect, useState } from "react";
import SectionHead from "./SectionHead";

type Testimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  stars: number;
  avatarUrl: string | null;
};

type TestimonialsScope = "home" | "salon" | "academia";
type TestimonialsColor = "default" | "crema";

const FALLBACK_SALON: Testimonial[] = [
  {
    id: "salon-1",
    name: "Ana Garcia",
    role: "Clienta desde 2022",
    quote:
      "Llevaba anos luchando con mi rizado. Despues de mi primera cita con Elizabeth, sali con el pelo que siempre sone.",
    stars: 5,
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
  },
  {
    id: "salon-2",
    name: "Laura Fernandez",
    role: "Clienta habitual",
    quote:
      "Es la primera vez que alguien realmente entiende mi tipo de rizo y me da una rutina que puedo mantener en casa.",
    stars: 5,
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
  },
];

const FALLBACK_ACADEMIA: Testimonial[] = [
  {
    id: "academia-1",
    name: "Maria Lopez",
    role: "Alumna del curso CGM",
    quote:
      "El curso de Metodo Curly Girl cambio completamente mi rutina. Ahora entiendo mi pelo y se exactamente que productos usar.",
    stars: 5,
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
  },
  {
    id: "academia-2",
    name: "Carla Ortiz",
    role: "Alumna certificada",
    quote:
      "La academia tiene una metodologia clara y practica. Pude aplicar todo de inmediato en mis clientas.",
    stars: 5,
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face",
  },
];

const FALLBACK_HOME = [...FALLBACK_SALON, ...FALLBACK_ACADEMIA];

function getFallback(scope: TestimonialsScope): Testimonial[] {
  if (scope === "salon") return FALLBACK_SALON;
  if (scope === "academia") return FALLBACK_ACADEMIA;
  return FALLBACK_HOME;
}

function getHeading(scope: TestimonialsScope) {
  if (scope === "salon") {
    return {
      title: "Lo que dicen nuestras clientas",
      subtitle:
        "Experiencias reales de personas que confiaron en el trabajo del salon.",
    };
  }

  if (scope === "academia") {
    return {
      title: "Lo que dicen nuestras alumnas",
      subtitle:
        "Testimonios de profesionales que se formaron en nuestra academia.",
    };
  }

  return {
    title: "Lo que dicen nuestras clientas y alumnas",
    subtitle:
      "Historias reales del salon y la academia para que conozcas resultados y formacion.",
  };
}

function Stars({ count, color }: { count: number; color: TestimonialsColor }) {
  return (
    <div className="mb-4 flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={
            i < count
              ? "fill-[#B16E34]"
              : color === "crema"
                ? "fill-zinc-300"
                : "fill-zinc-700"
          }
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

function Avatar({
  name,
  src,
  color,
}: {
  name: string;
  src: string | null;
  color: TestimonialsColor;
}) {
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
        className="h-11 w-11 shrink-0 rounded-full border-2 border-[#B16E34]/30 object-cover"
      />
    );
  }

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
        color === "crema"
          ? "border-[#B16E34]/30 bg-[#B16E34]/10"
          : "border-[#B16E34]/40 bg-[#B16E34]/10"
      }`}
    >
      <span className="text-sm font-bold leading-none text-[#B16E34]">
        {initials}
      </span>
    </div>
  );
}

function Testimonials({
  scope = "home",
  color = "default",
}: {
  scope?: TestimonialsScope;
  color?: TestimonialsColor;
}) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const heading = getHeading(scope);
  const isCrema = color === "crema";

  useEffect(() => {
    fetch(`/api/testimonials?scope=${scope}`)
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? [];
        setTestimonials(data.length > 0 ? data : getFallback(scope));
      })
      .catch(() => setTestimonials(getFallback(scope)));
  }, [scope]);

  if (testimonials.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Testimonios"
        title={heading.title}
        subtitle={heading.subtitle}
        color={isCrema ? "crema" : undefined}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col rounded-2xl border p-6 backdrop-blur-sm ${
              isCrema ? "border-zinc-200 bg-white/70" : "border-white/10 bg-white/5"
            }`}
          >
            <Stars count={t.stars} color={color} />
            <blockquote
              className={`mb-6 flex-1 text-sm leading-relaxed ${
                isCrema ? "text-zinc-600" : "text-zinc-300"
              }`}
            >
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div
              className={`flex items-center gap-3 border-t pt-4 ${
                isCrema ? "border-zinc-200" : "border-white/10"
              }`}
            >
              <Avatar name={t.name} src={t.avatarUrl} color={color} />
              <div>
                <p className={`text-sm font-semibold ${isCrema ? "text-zinc-800" : "text-white"}`}>
                  {t.name}
                </p>
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
