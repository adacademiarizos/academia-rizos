"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import booksyData from "@/data/booksy-services.json";

const MIN_ITEMS = 7;
const AUTO_SPEED = 0.12;

type Mode = "auto" | "inertia" | "idle";

type CardDim = {
  w: number;
  h: number;
  gap: number;
  titleSize: string;
  descSize: string;
  badgeSize: string;
  minSize: string;
  padding: string;
};

type BooksyService = {
  id: string;
  externalId: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string;
  bookingUrl: string;
  durationLabel: string | null;
  priceLabel: string | null;
};

type Service = {
  id: string;
  externalId: string;
  name: string;
  description: string | null;
  durationMin: number;
  durationLabel: string | null;
  priceLabel: string | null;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  bookingUrl: string;
};

type CategoryGroup = {
  categoryId: string;
  categoryName: string;
};

function parseDurationToMin(label: string | null): number {
  if (!label) return 0;
  const text = label.toLowerCase();
  const hours = Number((text.match(/(\d+)\s*h/) || [])[1] || 0);
  const mins = Number((text.match(/(\d+)\s*min/) || [])[1] || 0);
  return hours * 60 + mins;
}

const SERVICES_SOURCE: Service[] = ((booksyData.services ?? []) as BooksyService[]).map((s) => ({
  id: s.id,
  externalId: s.externalId,
  name: s.name,
  description: s.description,
  durationMin: parseDurationToMin(s.durationLabel),
  durationLabel: s.durationLabel,
  priceLabel: s.priceLabel,
  imageUrls: s.imageUrls ?? [],
  categoryId: s.categoryId,
  categoryName: s.categoryName,
  bookingUrl: s.bookingUrl,
}));

function getDirectServiceUrl(service: Pick<Service, "bookingUrl" | "externalId">) {
  return `${service.bookingUrl}#service-${service.externalId}`;
}

const CATEGORY_SOURCE: CategoryGroup[] = ((booksyData.categories ?? []) as Array<{ id: string; name: string }>).map((c) => ({
  categoryId: c.id,
  categoryName: c.name,
}));

function useCardDim(): CardDim {
  const [dim, setDim] = useState<CardDim>({
    w: 240,
    h: 320,
    gap: 40,
    titleSize: "1.25rem",
    descSize: "0.75rem",
    badgeSize: "0.625rem",
    minSize: "0.6875rem",
    padding: "1.25rem",
  });

  useEffect(() => {
    function update() {
      const vw = window.innerWidth;
      if (vw < 640) {
        setDim({
          w: 155,
          h: 207,
          gap: 24,
          titleSize: "0.95rem",
          descSize: "0.6rem",
          badgeSize: "0.5rem",
          minSize: "0.55rem",
          padding: "0.75rem",
        });
      } else if (vw < 1024) {
        setDim({
          w: 200,
          h: 267,
          gap: 32,
          titleSize: "1.1rem",
          descSize: "0.7rem",
          badgeSize: "0.575rem",
          minSize: "0.625rem",
          padding: "1rem",
        });
      } else {
        setDim({
          w: 240,
          h: 320,
          gap: 40,
          titleSize: "1.25rem",
          descSize: "0.75rem",
          badgeSize: "0.625rem",
          minSize: "0.6875rem",
          padding: "1.25rem",
        });
      }
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return dim;
}

export default function ServicesSection3D() {
  const categories = CATEGORY_SOURCE;
  const services = SERVICES_SOURCE;
  const [filterCategory, setFilterCategory] = useState<string | null>(categories[0]?.categoryId ?? null);

  const cardDim = useCardDim();

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

  const carouselRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const lastXRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const hoveredRef = useRef(false);
  const dragDistRef = useRef(0);
  const modeRef = useRef<Mode>("idle");
  const rafRef = useRef<number | null>(null);

  const SENSITIVITY = 0.35;
  const FRICTION = 0.93;

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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cards.length, filterCategory, cardDim.w]);

  function onMouseEnter() {
    hoveredRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    modeRef.current = "idle";
  }

  function onMouseLeave() {
    hoveredRef.current = false;
    if (!draggingRef.current) startAuto();
  }

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
  const radius = quantity > 1 ? Math.round((cardDim.w + cardDim.gap) / (2 * Math.tan(Math.PI / quantity))) : 0;

  if (quantity === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-6 px-3 py-6">
        {categories.length > 1 && (
          <CategoryTags categories={categories} active={filterCategory} onChange={setFilterCategory} />
        )}
        <div className="slider-3d-banner flex items-center justify-center">
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-12 text-center"
            style={{ width: cardDim.w, minHeight: cardDim.h }}
          >
            <p className="text-xs uppercase tracking-widest text-[#c8cf94]" style={{ fontFamily: "jost" }}>
              Servicios externos
            </p>
            <h3 className="leading-snug text-white/80" style={{ fontFamily: "migthy", fontSize: cardDim.titleSize }}>
              Reserva via Booksy
            </h3>
            <p className="text-white/40 max-w-[180px]" style={{ fontSize: cardDim.descSize }}>
              No hay servicios para esta categoria en la carga local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 px-3 py-6">
      {categories.length > 1 && (
        <CategoryTags categories={categories} active={filterCategory} onChange={setFilterCategory} />
      )}
      <div className="slider-3d-banner" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
              <a
                key={`${service.id}-${i}`}
                href={getDirectServiceUrl(service)}
                target="_blank"
                rel="noopener noreferrer"
                className="slider-3d-item"
                style={{ transform: `rotateY(${itemAngle}deg) translateZ(${quantity === 1 ? 0 : radius}px)` }}
                onClick={(e) => {
                  if (dragDistRef.current > 8) e.preventDefault();
                }}
                draggable={false}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={service.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-linear-to-br from-ap-choco/50 to-ap-crema/20" />
                )}

                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0" style={{ fontFamily: "jost", padding: cardDim.padding }}>
                  <p className="font-semibold uppercase tracking-widest text-[#c8cf94] mb-1" style={{ fontSize: cardDim.minSize }}>
                    {service.durationLabel || `${service.durationMin} min`}
                  </p>
                  <h3 className="leading-tight text-white font-main">{service.name}</h3>
                  {service.description && (
                    <p className="mt-1 text-white/65 line-clamp-2" style={{ fontSize: cardDim.descSize }}>
                      {service.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {service.priceLabel && (
                      <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-white" style={{ fontSize: cardDim.badgeSize }}>
                        {service.priceLabel}
                      </span>
                    )}
                    <span
                      className="inline-block rounded-full bg-ap-choco px-3 py-1 font-semibold uppercase tracking-wide text-white"
                      style={{ fontSize: cardDim.badgeSize }}
                    >
                      Ver en Booksy
                    </span>
                  </div>
                </div>
              </a>
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
      className="flex w-full gap-2 overflow-x-auto py-1 px-0.5 xl:w-6xl"
      style={{ msOverflowStyle: "none", scrollbarColor: "var(--color-ap-choco) transparent" } as React.CSSProperties}
    >
      {categories.map((cat) => (
        <button
          key={cat.categoryId}
          type="button"
          onClick={() => onChange(active === cat.categoryId ? null : cat.categoryId)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
            active === cat.categoryId
              ? "bg-ap-choco text-white shadow-lg"
              : "bg-ap-acent-crema/70 text-zinc-800 hover:bg-black/40 hover:text-white/70"
          }`}
        >
          {cat.categoryName}
        </button>
      ))}
    </div>
  );
}
