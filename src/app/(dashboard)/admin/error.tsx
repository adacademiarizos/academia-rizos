"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-amber-300/30 bg-amber-300/10 p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Administración</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">No pudimos cargar este resumen</h1>
      <p className="mt-3 text-sm text-amber-100/80">Intenta actualizar. Tus datos no se han modificado.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white transition hover:bg-ap-copper/85"
      >
        Reintentar
      </button>
    </div>
  );
}
