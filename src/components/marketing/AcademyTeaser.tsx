"use client";

import { useRef } from "react";
import FeatureChip from "./FeatureChip";
import Link from "next/link";

const MAX_TILT = 10; // degrees

function AcademyTeaser() {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  * 2 - 1; // -1..1
    const y = (e.clientY - rect.top)  / rect.height * 2 - 1; // -1..1
    card.style.transform = `perspective(1200px) rotateX(${-y * MAX_TILT}deg) rotateY(${x * MAX_TILT}deg) scale3d(1.015,1.015,1.015)`;
  }

  function onMouseEnter() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 0.15s ease";
    setTimeout(() => { if (card) card.style.transition = ""; }, 150);
  }

  function onMouseLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1)";
    card.style.transform  = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
    setTimeout(() => { if (card) card.style.transition = ""; }, 550);
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ willChange: "transform" }}
      className="mx-auto max-w-6xl overflow-hidden rounded-[2.2rem] border border-black/10 bg-linear-to-br from-white/5 to-white/10 p-8 shadow-sm backdrop-blur-md md:p-12"
    >
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-(--er-olive)">
            ACADEMIA DE RIZOS
          </p>
          <h2 className="mt-3 text-balance text-white text-3xl font-semibold tracking-tight md:text-4xl">
            Aprende el método y cuida tu rizo a tu ritmo
          </h2>
          <p className="mt-3 text-sm text-zinc-300 md:text-base">
            Cursos por módulos, recursos descargables, evaluación final y certificado con QR verificable.
            Además, un chat con IA para dudas sobre cada módulo.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/courses"
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Explorar cursos
            </Link>
            <Link
              href="/booking"
              className="rounded-2xl bg-(--er-copper) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Reservar (recomendado)
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FeatureChip title="Videos por módulos" />
          <FeatureChip title="Recursos PDF/Imagen" />
          <FeatureChip title="Test + evidencias" />
          <FeatureChip title="Certificado + QR" />
        </div>
      </div>
    </div>
  );
}

export default AcademyTeaser;
