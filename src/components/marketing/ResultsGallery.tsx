"use client";

import { useState } from "react";
import SectionHead from "./SectionHead";

type ResultImage = {
  id: string;
  url: string;
  label: string | null;
  aspectRatio: number;
  width: number;
  height: number;
};

export default function ResultsGallery({ images }: { images: ResultImage[] }) {
  const [lightbox, setLightbox] = useState<ResultImage | null>(null);

  if (images.length === 0) {
    return (
      <section id="results" className="mx-auto max-w-6xl">
        <SectionHead
          kicker="Resultados"
          title="Galería de transformaciones"
          subtitle="Resultados reales de nuestras clientas"
        />
        <div className="mt-10 flex items-center justify-center h-40 rounded-xl border border-white/10 bg-white/5 text-sm text-white/40">
          Próximamente — resultados reales de nuestras clientas
        </div>
      </section>
    );
  }

  return (
    <section id="results" className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Resultados"
        title="Galería de transformaciones"
        subtitle="Resultados reales de nuestras clientas"
      />

      <div className="mt-10 masonry-results">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(img)}
            className="mb-4 w-full block rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition group cursor-pointer"
            style={{ breakInside: "avoid" }}
          >
            <img
              src={img.url}
              alt={img.label || "Resultado"}
              loading="lazy"
              className="w-full h-auto object-cover group-hover:scale-105 transition duration-500"
              style={{ aspectRatio: `${img.aspectRatio}` }}
            />
            {img.label && (
              <div className="px-3 py-2 bg-black/40">
                <p className="text-xs text-white/70">{img.label}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.label || "Resultado"}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl"
            />
            {lightbox.label && (
              <p className="mt-2 text-center text-sm text-white/70">
                {lightbox.label}
              </p>
            )}
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition"
              aria-label="Cerrar"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
