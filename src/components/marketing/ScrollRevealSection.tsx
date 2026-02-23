"use client";

import { useEffect, useRef, type ReactNode } from "react";

const NAV_H = 64; // fixed header height in px

interface Props {
  children: ReactNode;
  className?: string;
  /**
   * Fraction of the viewport height used to measure the enter progress.
   * Smaller = completes sooner. Default 0.72
   */
  enterFraction?: number;
  /**
   * Fraction of the section height used to measure the exit fade.
   * Smaller = fades faster. Default 0.38
   */
  exitFraction?: number;
}

export default function ScrollRevealSection({
  children,
  className = "",
  enterFraction = 0.72,
  exitFraction = 0.38,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function clamp(v: number) {
      return Math.min(1, Math.max(0, v));
    }

    function update() {
      const { top, height } = el.getBoundingClientRect();
      const vh = window.innerHeight;

      // 0 when section bottom is at viewport bottom → 1 when section is well into view
      const enter = clamp((vh - top) / (vh * enterFraction));

      // 0 when section top is at navbar → 1 when scrolled well past navbar
      const exit = clamp((NAV_H - top) / (height * exitFraction));

      el.style.setProperty("--sr-enter", enter.toFixed(4));
      el.style.setProperty("--sr-exit", exit.toFixed(4));
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enterFraction, exitFraction]);

  return (
    <div ref={ref} className={`scroll-reveal ${className}`}>
      {children}
    </div>
  );
}
