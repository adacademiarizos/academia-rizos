"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, User, Scissors, Euro } from "lucide-react";
import { useRouter } from "next/navigation";

type StaffOption = { id: string; name: string | null; email: string };
type ServiceOption = { id: string; name: string };

// ── Generic custom select ────────────────────────────────────────────────────
function CustomSelect<T extends { id: string }>({
  options,
  value,
  onChange,
  placeholder,
  renderOption,
  renderSelected,
  icon: Icon,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder: string;
  renderOption: (item: T) => React.ReactNode;
  renderSelected: (item: T) => React.ReactNode;
  icon: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-11 flex items-center gap-3 rounded-xl px-4 text-sm ring-1 transition
          ${open
            ? "bg-white/10 ring-white/30 text-white"
            : "bg-white/5 ring-white/10 hover:ring-white/20 text-white/80"
          }`}
      >
        <Icon className="h-4 w-4 text-white/40 shrink-0" />
        <span className="flex-1 text-left truncate">
          {value ? renderSelected(value) : <span className="text-white/35">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white/40 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-white/10 bg-[#1e1c1a] shadow-2xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto nav-scroll py-1">
            {options.length === 0 ? (
              <p className="px-4 py-3 text-sm text-white/40">Sin opciones</p>
            ) : (
              options.map((opt) => {
                const active = value?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition
                      ${active
                        ? "bg-white/10 text-white"
                        : "text-white/65 hover:bg-white/6 hover:text-white"
                      }`}
                  >
                    <span className="flex-1">{renderOption(opt)}</span>
                    {active && <Check className="h-3.5 w-3.5 text-ap-copper shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function PriceForm({
  staff,
  services,
}: {
  staff: StaffOption[];
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaff || !selectedService || !price) return;

    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents <= 0) {
      setError("Ingresá un precio válido.");
      return;
    }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.set("staffId", selectedStaff.id);
    form.set("serviceId", selectedService.id);
    form.set("priceCents", String(priceCents));
    form.set("currency", "EUR");

    try {
      const res = await fetch("/api/admin/prices", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Error al guardar");
      setSuccess(true);
      setSelectedStaff(null);
      setSelectedService(null);
      setPrice("");
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      {/* Staff select */}
      <CustomSelect<StaffOption>
        options={staff}
        value={selectedStaff}
        onChange={setSelectedStaff}
        placeholder="Seleccionar staff"
        icon={User}
        renderSelected={(u) => (
          <span className="font-medium">{u.name ?? u.email}</span>
        )}
        renderOption={(u) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-white">{u.name ?? u.email}</span>
            {u.name && <span className="text-[11px] text-white/40">{u.email}</span>}
          </div>
        )}
      />

      {/* Service select */}
      <CustomSelect<ServiceOption>
        options={services}
        value={selectedService}
        onChange={setSelectedService}
        placeholder="Seleccionar servicio"
        icon={Scissors}
        renderSelected={(s) => <span className="font-medium">{s.name}</span>}
        renderOption={(s) => <span className="font-medium text-white">{s.name}</span>}
      />

      {/* Price input */}
      <div className="relative">
        <Euro className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
        <input
          type="number"
          step="0.01"
          min="0.50"
          placeholder="Precio en € (ej: 60.00)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-11 w-full rounded-xl bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/35 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/25"
          required
        />
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-400 bg-green-500/10 rounded-xl px-3 py-2">
          Precio guardado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !selectedStaff || !selectedService || !price}
        className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-ap-copper px-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {loading ? "Guardando..." : "Guardar precio"}
      </button>
    </form>
  );
}
