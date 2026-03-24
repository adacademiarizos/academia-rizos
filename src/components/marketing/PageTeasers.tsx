"use client";

import { useRef } from "react";
import Link from "next/link";
import SectionHead from "./SectionHead";

const MAX_TILT = 8;

function useTilt() {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    card.style.transform = `perspective(1200px) rotateX(${-y * MAX_TILT}deg) rotateY(${x * MAX_TILT}deg) scale3d(1.015,1.015,1.015)`;
  }

  function onMouseEnter() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 0.15s ease";
    setTimeout(() => {
      if (card) card.style.transition = "";
    }, 150);
  }

  function onMouseLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition =
      "transform 0.55s cubic-bezier(0.23,1,0.32,1)";
    card.style.transform =
      "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
    setTimeout(() => {
      if (card) card.style.transition = "";
    }, 550);
  }

  return { cardRef, onMouseMove, onMouseEnter, onMouseLeave };
}

function TeaserCard({
  kicker,
  title,
  description,
  href,
  ctaLabel,
  features,
  kickerClassName = "text-(--er-olive)",
  ctaClassName = "bg-(--er-copper)",
}: {
  kicker: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  features: string[];
  kickerClassName?: string;
  ctaClassName?: string;
}) {
  const { cardRef, onMouseMove, onMouseEnter, onMouseLeave } = useTilt();

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ willChange: "transform" }}
      className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-linear-to-br from-white/5 to-white/10 p-8 shadow-sm backdrop-blur-md md:p-10"
    >
      <p className={`text-xs font-semibold tracking-wide ${kickerClassName}`}>
        {kicker.toUpperCase()}
      </p>
      <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white md:text-3xl">
        {title}
      </h3>
      <p className="mt-3 text-sm text-zinc-300 md:text-base">{description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
          >
            {f}
          </span>
        ))}
      </div>

      <div className="mt-6">
        <Link
          href={href}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 ${ctaClassName}`}
        >
          {ctaLabel}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function PageTeasers() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Explora"
        title="Dos caminos, un mismo objetivo"
        subtitle="Ya sea en nuestro salón o desde casa con la academia: tu rizo merece lo mejor."
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <TeaserCard
          kicker="Salón"
          title="Transformación presencial con especialistas"
          description="Diagnóstico personalizado, corte especializado y tratamientos para tu tipo de rizo. Resultado visible desde la primera cita."
          href="/salon"
          kickerClassName="text-ap-choco"
          ctaClassName="bg-ap-choco"
          ctaLabel="Conocer el salón"
          features={[
            "Diagnóstico capilar",
            "Corte rizado",
            "Tratamientos CG",
            "Equipo especializado",
          ]}
        />
        <TeaserCard
          kicker="Academia"
          title="Aprende el método desde cualquier lugar"
          description="Cursos online con video, evaluación práctica y certificado verificable. Formación profesional a tu propio ritmo."
          href="/academia"
          ctaLabel="Descubrir la academia"
          features={[
            "Videos por módulos",
            "Certificado QR",
            "Chat con IA",
            "Recursos PDF",
          ]}
        />
      </div>
    </div>
  );
}

export default PageTeasers;
