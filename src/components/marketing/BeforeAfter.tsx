"use client";

import SectionHead from "./SectionHead";
import React, { useState } from "react";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, label, [role='button'], [data-no-drag='true']"
    )
  );
}

type Pair = { id: string; beforeUrl: string; afterUrl: string; label: string | null };

export default function BeforeAfter({ pairs }: { pairs: Pair[] }) {
  const [currentCase, setCurrentCase] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  if (pairs.length === 0) {
    return (
      <section id="results" className="mx-auto max-w-6xl">
        <SectionHead
          kicker="Resultados"
          title="Inspirate con transformaciones"
          subtitle="Arrastrá el control para comparar el antes y después"
        />
        <div className="mt-10 flex items-center justify-center h-40 rounded-xl border border-white/10 bg-white/5 text-sm text-white/40">
          Próximamente — resultados reales de nuestras clientas
        </div>
      </section>
    );
  }

  const current = pairs[currentCase];

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setSliderPosition(clamp(pct));
  };

  const handlePrevious = () => {
    setCurrentCase((prev) => (prev === 0 ? pairs.length - 1 : prev - 1));
    setSliderPosition(50);
  };

  const handleNext = () => {
    setCurrentCase((prev) => (prev === pairs.length - 1 ? 0 : prev + 1));
    setSliderPosition(50);
  };

  return (
    <section id="results" className="mx-auto max-w-6xl ">
      <SectionHead
        kicker="Resultados"
        title="Inspirate con transformaciones"
        subtitle="Arrastrá el control para comparar el antes y después"
      />

      <div className="mt-10 mx-auto max-w-6xl h-150 flex justify-center">
        <div
          ref={wrapRef}
          className={[
            "relative w-full  overflow-hidden rounded-xl",
            "border-3 border-white/25 shadow-soft2 bg-black select-none",
            "cursor-col-resize touch-none",
          ].join(" ")}
          onPointerDown={(e) => {
            // 👇 Si tocás un botón/link/etc, no arrancamos drag
            if (isInteractiveTarget(e.target)) return;

            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            setDragging(true);
            setFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setFromClientX(e.clientX);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          aria-label="Comparador antes y después"
        >
          {/* AFTER (base) */}
          <img
            src={current.afterUrl}
            alt="Después"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />

          {/* BEFORE (clip-path, no reescala) */}
          <img
            src={current.beforeUrl}
            alt="Antes"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            draggable={false}
          />

          {/* Divider line */}
          <div
            className="absolute inset-y-0 w-[2px] bg-ap-ivory"
            style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
          />

          {/* Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${sliderPosition}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="h-12 w-12 rounded-full bg-ap-copper text-ap-ivory shadow-soft flex items-center justify-center">
              <span className="text-xs font-bold">↔</span>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-4 left-4 text-xs font-semibold text-ap-ivory bg-black/50 px-3 py-1 rounded-full pointer-events-none">
            ANTES
          </div>
          <div className="absolute top-4 right-4 text-xs font-semibold text-ap-ivory bg-black/50 px-3 py-1 rounded-full pointer-events-none">
            DESPUÉS
          </div>

          {/* Navigation Buttons */}
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-4 z-10 pointer-events-none">
            <button
              type="button"
              onClick={handlePrevious}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto p-3 rounded-full bg-ap-copper text-ap-ivory hover:bg-ap-olive transition shadow-soft2"
              aria-label="Anterior"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="pointer-events-none text-center bg-black/50 px-4 py-2 rounded-full">
              <p className="text-xs font-semibold text-ap-ivory">
                {currentCase + 1}/{pairs.length}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNext}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto p-3 rounded-full bg-ap-copper text-ap-ivory hover:bg-ap-olive transition shadow-soft2"
              aria-label="Siguiente"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Hint */}
          {!dragging && (
            <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none">
              <div className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/90">
                Arrastrá para comparar
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
