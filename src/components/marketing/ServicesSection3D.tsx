"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const MIN_ITEMS  = 7;
const AUTO_SPEED = 0.12;

type Mode = "auto" | "inertia" | "idle";

type CardDim = {
  w: number; h: number; gap: number;
  titleSize: string; descSize: string;
  badgeSize: string; minSize: string;
  padding: string;
};

function useCardDim(): CardDim {
  const [dim, setDim] = useState<CardDim>({
    w: 240, h: 320, gap: 40,
    titleSize: "1.25rem", descSize: "0.75rem",
    badgeSize: "0.625rem", minSize: "0.6875rem", padding: "1.25rem",
  });
  useEffect(() => {
    function update() {
      const vw = window.innerWidth;
      if (vw < 640) {
        setDim({ w: 155, h: 207, gap: 24, titleSize: "0.95rem", descSize: "0.6rem", badgeSize: "0.5rem", minSize: "0.55rem", padding: "0.75rem" });
      } else if (vw < 1024) {
        setDim({ w: 200, h: 267, gap: 32, titleSize: "1.1rem", descSize: "0.7rem", badgeSize: "0.575rem", minSize: "0.625rem", padding: "1rem" });
      } else {
        setDim({ w: 240, h: 320, gap: 40, titleSize: "1.25rem", descSize: "0.75rem", badgeSize: "0.625rem", minSize: "0.6875rem", padding: "1.25rem" });
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return dim;
}

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
};

type CategoryGroup = {
  categoryId: string;
  categoryName: string;
};

export default function ServicesSection3D() {
  const [services, setServices]     = useState<Service[]>([]);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  const cardDim = useCardDim();

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setServices(j.data?.services ?? []);
        setCategories(j.data?.groupedByCategory ?? []);
      })
      .catch(() => {});
  }, []);

  // Auto-select first category on first load
  useEffect(() => {
    if (!autoSelectedRef.current && categories.length > 0) {
      autoSelectedRef.current = true;
      setFilterCategory(categories[0].categoryId);
    }
  }, [categories]);

  const filteredServices = useMemo(() => {
    if (!filterCategory) return services;
    return services.filter((s) => s.categoryId === filterCategory);
  }, [services, filterCategory]);

  const cards = useMemo<Service[]>(() => {
    if (filteredServices.length === 0) return [];
    const count = Math.max(filteredServices.length, MIN_ITEMS);
    return Array.from({ length: count }, (_, i) => filteredServices[i % filteredServices.length]);
  }, [filteredServices]);

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

  function tick() {
    if (modeRef.current === "auto") {
      if (hoveredRef.current || draggingRef.current) {
        modeRef.current = "idle";
        return;
      }
      angleRef.current -= AUTO_SPEED;
      applyTransform();
      rafRef.current = requestAnimationFrame(tick);
    } else if (modeRef.current === "inertia") {
      if (Math.abs(velocityRef.current) < 0.05) {
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

  useEffect(() => {
    if (cards.length === 0) return;
    angleRef.current = 0;
    startAuto();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, filterCategory, cardDim.w]);

  // ── Hover ─────────────────────────────────────────────────────────
  function onMouseEnter() {
    hoveredRef.current = true;
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
    modeRef.current = "inertia";
    rafRef.current = requestAnimationFrame(tick);
  }

  const quantity = cards.length;
  const radius = quantity > 1
    ? Math.round((cardDim.w + cardDim.gap) / (2 * Math.tan(Math.PI / quantity)))
    : 0;

  if (quantity === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-6 px-3 py-6">
        {categories.length > 1 && (
          <CategoryTags
            categories={categories}
            active={filterCategory}
            onChange={setFilterCategory}
          />
        )}
        <div className="slider-3d-banner flex items-center justify-center">
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-12 text-center"
            style={{ width: cardDim.w, minHeight: cardDim.h }}
          >
            <div style={{ fontFamily: "georgia, serif", color: "#B16E34", opacity: 0.6, fontSize: "2.25rem" }}>
              ✦
            </div>
            <p className="text-xs uppercase tracking-widest text-[#c8cf94]" style={{ fontFamily: "jost" }}>
              Próximamente
            </p>
            <h3 className="leading-snug text-white/80" style={{ fontFamily: "migthy", fontSize: cardDim.titleSize }}>
              Servicios en camino
            </h3>
            <p className="text-white/40 max-w-[180px]" style={{ fontSize: cardDim.descSize }}>
              Pronto vas a poder reservar tu cita directamente desde acá.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 px-3 py-6">
      {categories.length > 1 && (
        <CategoryTags
          categories={categories}
          active={filterCategory}
          onChange={setFilterCategory}
        />
      )}
      <div
        className="slider-3d-banner"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div
          ref={carouselRef}
          className="slider-3d"
          style={{ width: cardDim.w, height: cardDim.h }}
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

                <div className="absolute bottom-0 left-0 right-0" style={{ fontFamily: "jost", padding: cardDim.padding }}>
                  <p className="font-semibold uppercase tracking-widest text-[#c8cf94] mb-1" style={{ fontSize: cardDim.minSize }}>
                    {service.durationMin} min
                  </p>
                  <h3 className="leading-tight text-white" style={{ fontFamily: "migthy", fontSize: cardDim.titleSize }}>
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="mt-1 text-white/65 line-clamp-2" style={{ fontSize: cardDim.descSize }}>
                      {service.description}
                    </p>
                  )}
                  <span
                    className="mt-2 inline-block rounded-full bg-[#646a40] px-3 py-1 font-semibold uppercase tracking-wide text-white"
                    style={{ fontSize: cardDim.badgeSize, marginTop: "0.5rem" }}
                  >
                    Reservar
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryTags({
  categories,
  active,
  onChange,
}: {
  categories: CategoryGroup[];
  active: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      className="flex w-full gap-2 overflow-x-auto py-1 px-0.5"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
    >
      {categories.map((cat) => (
        <button
          key={cat.categoryId}
          type="button"
          onClick={() => onChange(active === cat.categoryId ? null : cat.categoryId)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200
            ${active === cat.categoryId
              ? "bg-[#646a40] text-white shadow-lg shadow-[#646a40]/30"
              : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/70"
            }`}
        >
          {cat.categoryName}
        </button>
      ))}
    </div>
  );
}
