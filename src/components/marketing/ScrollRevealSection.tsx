"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAV_H = 64;

interface Props {
  children: ReactNode;
  className?: string;
  enterStart?: string;
  enterEnd?: string;
  exitStart?: string;
  exitEnd?: string;
  /** Scrub lag in seconds. 1.2 = smooth GTA6-like lag. */
  scrub?: number;
}

export default function ScrollRevealSection({
  children,
  className = "",
  enterStart = "top 88%",
  enterEnd   = "top 15%",
  exitStart  = `top ${NAV_H}px`,
  exitEnd    = "top -40%",
  scrub      = 1.2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // gsap.context scopes all animations to this element
    // ctx.revert() on unmount kills triggers + resets all inline styles
    const ctx = gsap.context(() => {

      // ── Initial hidden state ──────────────────────────────────────
      gsap.set(el, {
        clipPath: "circle(0% at 50% 55%)",
        opacity: 0,
        y: 60,
      });

      // ── Enter: circle grows, fades in, slides up ─────────────────
      gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: enterStart,
          end: enterEnd,
          scrub,
        },
      }).to(el, {
        clipPath: "circle(120% at 50% 55%)",
        opacity: 1,
        y: 0,
        ease: "none",
      });

      // ── Exit: fades out under the navbar ─────────────────────────
      gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: exitStart,
          end: exitEnd,
          scrub,
        },
      }).to(el, {
        opacity: 0,
        ease: "none",
      });

    }, el);

    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
