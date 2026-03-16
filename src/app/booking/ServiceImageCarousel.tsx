"use client";

import { useRef, useState, useEffect } from "react";

export default function ServiceImageCarousel({
  images,
  alt,
}: {
  images: string[];
  alt?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIdx(idx);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={alt ?? ""}
        className="w-full rounded-2xl object-cover aspect-[4/3]"
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-2 rounded-2xl scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={alt ?? ""}
            className="w-full shrink-0 snap-center rounded-2xl object-cover aspect-[4/3]"
          />
        ))}
      </div>
      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {images.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all
              ${i === activeIdx ? "w-4 bg-[#c8cf94]" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
