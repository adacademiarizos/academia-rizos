"use client";

import { Printer } from "lucide-react";

export function ManualPrintButton({ label = "Imprimir manual" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
