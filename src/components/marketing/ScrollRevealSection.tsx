"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const NAV_H = 64;

interface Props {
  children: ReactNode;
  className?: string;
  /**
   * When the reveal starts/ends.
   * "bottom 100%" = the instant the section enters the viewport from the bottom.
   * "top 20%"     = completes once the section top is 20% from the top.
   */
  enterStart?: string;
  enterEnd?: string;
  /**
   * When the exit fade starts/ends.
   * "top 8%"    = just before reaching the navbar.
   * "top -50%"  = halfway above the viewport — section is mostly gone.
   */
  exitStart?: string;
  exitEnd?: string;
  /** Scrub lag in seconds. 1.2 = smooth GTA6-like feel. */
  scrub?: number;
}

export default function ScrollRevealSection({
  children,
  className = "",
  enterStart = "bottom 100%",
  enterEnd   = "top 20%",
  exitStart  = `top 8%`,
  exitEnd    = "top -50%",
  scrub      = 1.2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {

      // ── Initial hidden state ──────────────────────────────────────
      gsap.set(el, {
        clipPath: "circle(0% at 50% 55%)",
        opacity: 0,
        y: 50,
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

      // ── Exit: fades out as section passes under the navbar ────────
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
