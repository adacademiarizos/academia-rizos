"use client";

import { Clock } from "lucide-react";

type Variant = {
  id: string;
  name: string;
  durationMin: number;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  currency?: string;
};

function priceLabel(v: Variant): string {
  const cur = v.currency ?? "EUR";
  if (v.minPriceCents == null && v.maxPriceCents == null) return "Consultar";
  const min = v.minPriceCents ?? v.maxPriceCents!;
  const max = v.maxPriceCents ?? v.minPriceCents!;
  if (min === max) return `${(min / 100).toFixed(2)} ${cur}`;
  return `${(min / 100).toFixed(0)} - ${(max / 100).toFixed(0)} ${cur}`;
}

export default function VariantSelector({
  variants,
  selected,
  onSelect,
}: {
  variants: Variant[];
  selected: string | null;
  onSelect: (variantId: string) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="grid gap-2 mt-3">
      <p className="text-xs text-white/40 mb-1">
        Selecciona una opción para continuar
      </p>
      {variants.map((v) => {
        const isSelected = selected === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`flex items-center justify-between w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200
              ${isSelected
                ? "border-[#646a40] bg-[#646a40]/15 ring-2 ring-[#646a40]/50"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
              }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{v.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <Clock className="h-3 w-3" />
                  {v.durationMin} min
                </span>
                <span className="text-xs font-semibold text-[#c8cf94]">
                  {priceLabel(v)}
                </span>
              </div>
            </div>
            <div
              className={`ml-3 h-5 w-5 shrink-0 rounded-full border-2 transition
                ${isSelected
                  ? "border-[#646a40] bg-[#646a40]"
                  : "border-white/20 bg-transparent"
                }`}
            >
              {isSelected && (
                <svg viewBox="0 0 20 20" className="h-full w-full text-white">
                  <path
                    fill="currentColor"
                    d="M7.629 14.566l-4.195-4.195 1.414-1.414 2.781 2.781 6.196-6.196 1.414 1.414z"
                  />
                </svg>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
