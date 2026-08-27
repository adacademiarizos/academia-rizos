"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type PeriodControlProps = {
  from: string;
  to: string;
};

const PRESETS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
] as const;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(days: number, toKey: string) {
  const from = new Date(`${toKey}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: formatDate(from), to: toKey };
}

export function PeriodControl({ from, to }: PeriodControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Periodo de análisis">
      {PRESETS.map((preset) => {
        const range = getPresetRange(preset.days, to);
        const active = range.from === from && range.to === to;
        return (
          <button
            key={preset.days}
            type="button"
            onClick={() => updateRange(range.from, range.to)}
            aria-pressed={active}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              active
                ? "bg-ap-copper text-white"
                : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
      <label className="sr-only" htmlFor="overview-from">
        Desde
      </label>
      <input
        id="overview-from"
        type="date"
        value={from}
        max={to}
        disabled={isPending}
        onChange={(event) => updateRange(event.target.value, to)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 [color-scheme:dark]"
      />
      <span className="text-xs text-white/35">—</span>
      <label className="sr-only" htmlFor="overview-to">
        Hasta
      </label>
      <input
        id="overview-to"
        type="date"
        value={to}
        min={from}
        disabled={isPending}
        onChange={(event) => updateRange(from, event.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 [color-scheme:dark]"
      />
    </div>
  );
}
