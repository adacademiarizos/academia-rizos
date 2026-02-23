"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAV_H = 64; // fixed header height in px

interface Props {
  children: ReactNode;
  className?: string;
  /**
   * GSAP start/end for the enter animation.
   * Default: enters when top hits 88% of viewport, completes at 20%.
   */
  enterStart?: string;
  enterEnd?: string;
  /**
   * GSAP start/end for the exit fade (section scrolling under navbar).
   * Default: starts at navbar level, ends 45% of section height above.
   */
  exitStart?: string;
  exitEnd?: string;
  /** Scrub lag in seconds. Default 1.1 — the buttery GTA6 feel. */
  scrub?: number;
}

export default function ScrollRevealSection({
  children,
  className = "",
  enterStart = "top 88%",
  enterEnd   = "top 18%",
  exitStart  = `top ${NAV_H}px`,
  exitEnd    = "top -45%",
  scrub      = 1.1,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ── Enter: mask circle grows from 0 → full ───────────────────
    const enterTrigger = ScrollTrigger.create({
      trigger: el,
      start: enterStart,
      end: enterEnd,
      scrub,
      onUpdate: (self) => {
        el.style.setProperty("--sr-enter", self.progress.toFixed(4));
      },
    });

    // ── Exit: section fades as it scrolls under the navbar ───────
    const exitTrigger = ScrollTrigger.create({
      trigger: el,
      start: exitStart,
      end: exitEnd,
      scrub,
      onUpdate: (self) => {
        el.style.setProperty("--sr-exit", self.progress.toFixed(4));
      },
    });

    return () => {
      enterTrigger.kill();
      exitTrigger.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={`scroll-reveal ${className}`}>
      {children}
    </div>
  );
}
