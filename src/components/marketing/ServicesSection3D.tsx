"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const CARD_W    = 240;
const GAP       = 40;
const MIN_ITEMS = 7;
const AUTO_SPEED = 0.12; // deg/frame — slow auto-rotation

type Mode = "auto" | "inertia" | "idle";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  imageUrls: string[];
};

export default function ServicesSection3D() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setServices(j.data?.services ?? []))
      .catch(() => {});
  }, []);

  const cards = useMemo<Service[]>(() => {
    if (services.length === 0) return [];
    const count = Math.max(services.length, MIN_ITEMS);
    return Array.from({ length: count }, (_, i) => services[i % services.length]);
  }, [services]);

  const randomIndexes = useMemo(
    () => cards.map((s) => (s.imageUrls.length > 0 ? Math.floor(Math.random() * s.imageUrls.length) : -1)),
    [cards]
  );

  // ── Animation state (all refs — zero re-renders) ─────────────────
  const carouselRef = useRef<HTMLDivElement>(null);
  const angleRef    = useRef(0);
  const lastXRef    = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const hoveredRef  = useRef(false);
  const dragDistRef = useRef(0);
  const modeRef     = useRef<Mode>("idle");
  const rafRef      = useRef<number | null>(null);

  const SENSITIVITY = 0.35;
  const FRICTION    = 0.93;

  function applyTransform() {
    if (carouselRef.current) {
      carouselRef.current.style.transform = `rotateY(${angleRef.current}deg)`;
    }
  }

  // Single loop that handles auto-rotate and post-drag inertia
  function tick() {
    if (modeRef.current === "auto") {
      // Pause if user is hovering or dragging
      if (hoveredRef.current || draggingRef.current) {
        modeRef.current = "idle";
        return;
      }
      angleRef.current -= AUTO_SPEED;
      applyTransform();
      rafRef.current = requestAnimationFrame(tick);

    } else if (modeRef.current === "inertia") {
      if (Math.abs(velocityRef.current) < 0.05) {
        // Inertia done — switch to auto if not hovered
        if (!hoveredRef.current) {
          modeRef.current = "auto";
          rafRef.current = requestAnimationFrame(tick);
        } else {
          modeRef.current = "idle";
        }
        return;
      }
      velocityRef.current *= FRICTION;
      angleRef.current += velocityRef.current;
      applyTransform();
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function startAuto() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    modeRef.current = "auto";
    rafRef.current = requestAnimationFrame(tick);
  }

  // Start auto-rotate once cards are ready
  useEffect(() => {
    if (cards.length === 0) return;
    startAuto();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  // ── Hover ─────────────────────────────────────────────────────────
  function onMouseEnter() {
    hoveredRef.current = true;
    // tick() will see hoveredRef and stop; also kill inertia
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    modeRef.current = "idle";
  }

  function onMouseLeave() {
    hoveredRef.current = false;
    if (!draggingRef.current) startAuto();
  }

  // ── Drag ──────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    modeRef.current = "idle";
    draggingRef.current = true;
    dragDistRef.current = 0;
    lastXRef.current = e.clientX;
    velocityRef.current = 0;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    dragDistRef.current += Math.abs(dx);
    velocityRef.current = dx * SENSITIVITY;
    angleRef.current += velocityRef.current;
    lastXRef.current = e.clientX;
    applyTransform();
  }

  function onPointerUp() {
    draggingRef.current = false;
    // Run inertia; it will transition to auto when it finishes
    modeRef.current = "inertia";
    rafRef.current = requestAnimationFrame(tick);
  }

  const quantity = cards.length;
  const radius = quantity > 1
    ? Math.round((CARD_W + GAP) / (2 * Math.tan(Math.PI / quantity)))
    : 0;

  if (quantity === 0) return null;

  return (
    <div
      className="slider-3d-banner"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        ref={carouselRef}
        className="slider-3d"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {cards.map((service, i) => {
          const imgUrl = randomIndexes[i] >= 0 ? service.imageUrls[randomIndexes[i]] : null;
          const itemAngle = (i / quantity) * 360;

          return (
            <Link
              key={`${service.id}-${i}`}
              href={`/booking?serviceId=${service.id}`}
              className="slider-3d-item"
              style={{ transform: `rotateY(${itemAngle}deg) translateZ(${quantity === 1 ? 0 : radius}px)` }}
              onClick={(e) => { if (dragDistRef.current > 8) e.preventDefault(); }}
              draggable={false}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={service.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#646a40]/60 to-[#1b1a17]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-5" style={{ fontFamily: "jost" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c8cf94] mb-1">
                  {service.durationMin} min
                </p>
                <h3 className="font-['migthy'] text-xl leading-tight text-white">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="mt-1 text-xs text-white/65 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <span className="mt-3 inline-block rounded-full bg-[#646a40] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Reservar
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
