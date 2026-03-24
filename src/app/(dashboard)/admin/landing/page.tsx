"use client";

import { useMemo, useState } from "react";
import booksyData from "@/data/booksy-services.json";

type BooksyCategory = {
  id: string;
  name: string;
  slug: string;
};

type BooksyOption = {
  id: string;
  priceLabel: string;
  durationLabel: string;
};

type BooksyService = {
  id: string;
  externalId: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  description: string | null;
  imageUrls: string[];
  options: BooksyOption[];
  bookingUrl: string;
  priceLabel: string | null;
  durationLabel: string | null;
};

const categories = (booksyData.categories ?? []) as BooksyCategory[];
const services = (booksyData.services ?? []) as BooksyService[];

function getDirectServiceUrl(service: Pick<BooksyService, "bookingUrl" | "externalId">) {
  return `${service.bookingUrl}#service-${service.externalId}`;
}

export default function LandingServicesPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null);

  const filtered = useMemo(() => {
    if (!activeCategory) return services;
    return services.filter((s) => s.categoryId === activeCategory);
  }, [activeCategory]);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <p className="text-xs uppercase tracking-wider text-amber-300/90">Modo temporal</p>
        <h1 className="mt-1 text-xl font-semibold text-white">Servicios externos via Booksy</h1>
        <p className="mt-2 text-sm text-white/70">
          La logica interna de reservas/servicios quedo congelada temporalmente. Esta vista usa un JSON local
          extraido desde Booksy para trabajar por enlaces.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60">
          <span>{booksyData.stats.totalCategories} categorias</span>
          <span>·</span>
          <span>{booksyData.stats.totalServices} servicios</span>
          <span>·</span>
          <a
            href={booksyData.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ap-copper hover:underline"
          >
            Abrir Booksy
          </a>
        </div>
      </header>

      <div className="flex w-full gap-2 overflow-x-auto py-1 px-0.5" style={{ msOverflowStyle: "none" } as React.CSSProperties}>
        {categories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(active ? null : cat.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-ap-copper text-white"
                  : "bg-white/5 text-zinc-300 hover:bg-black/40 hover:text-white/80"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4">
        {filtered.map((service) => (
          <article key={service.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-ap-copper uppercase tracking-wider">{service.categoryName}</div>
                <h2 className="text-lg font-semibold leading-tight">{service.name}</h2>
                {service.description && (
                  <p className="mt-1 text-sm text-white/70">{service.description}</p>
                )}
              </div>
              <a
                href={getDirectServiceUrl(service)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-xl bg-ap-copper px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Ver en Booksy
              </a>
            </div>

            {service.options.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {service.options.map((opt) => (
                  <div key={opt.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">
                    <div className="font-semibold text-white">{opt.priceLabel}</div>
                    <div className="text-white/60">{opt.durationLabel}</div>
                  </div>
                ))}
              </div>
            )}

            {service.imageUrls.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {service.imageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    <img src={url} alt={service.name} className="h-28 w-full object-cover transition group-hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
