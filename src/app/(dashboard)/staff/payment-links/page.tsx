"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Check, ExternalLink, Plus } from "lucide-react";

type PaymentLink = {
  id: string;
  title: string;
  description: string | null;
  customerEmail: string | null;
  currency: string;
  baseAmountCents: number;
  totalAmountCents: number;
  status: string;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  payments: { amountCents: number; status: string; payerEmail: string | null }[];
};

const STATUS_MAP: Record<string, string> = {
  REQUIRES_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-green-500/20 text-green-400",
  PROCESSING: "bg-blue-500/20 text-blue-400",
  FAILED: "bg-red-500/20 text-red-400",
  CANCELED: "bg-gray-500/20 text-gray-400",
};

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs font-medium transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}

export default function StaffPaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", customerEmail: "", baseAmount: "" });
  const [feeInfo, setFeeInfo] = useState({ feePercent: 2.5, feeFixedCents: 25 });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch("/api/staff/payment-links")
      .then((r) => r.json())
      .then((d) => setLinks(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { if (d.success) setFeeInfo({ feePercent: d.data.feePercent, feeFixedCents: d.data.feeFixedCents }); })
      .catch(() => {});
  }, []);

  const previewTotal = form.baseAmount
    ? ((Number(form.baseAmount) * 100 * (1 + feeInfo.feePercent / 100) + feeInfo.feeFixedCents) / 100).toFixed(2)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.baseAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setLinks((prev) => [data.data, ...prev]);
        setForm({ title: "", description: "", customerEmail: "", baseAmount: "" });
        setShowForm(false);
      } else {
        alert("Error al crear el link");
      }
    } catch {
      alert("Error al crear el link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Link2 className="h-6 w-6 text-ap-copper" /> Links de Pago
          </h1>
          <p className="text-white/60 mt-1 text-sm">Genera links de pago para tus clientes</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-ap-copper hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-medium transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nuevo link
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-[28px] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Crear link de pago</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Título *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Reserva de cita, Servicio especial"
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Email del cliente</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                placeholder="cliente@ejemplo.com"
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles del servicio o producto..."
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
              rows={2}
            />
          </div>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-white/60 mb-1.5">Monto base (€ EUR) *</label>
            <input
              type="number"
              value={form.baseAmount}
              onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 text-sm"
              required
            />
            {previewTotal && (
              <p className="text-xs text-white/40 mt-1.5">
                El cliente pagará: <span className="text-ap-copper font-semibold">€{previewTotal}</span> (incluye fee Stripe)
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 bg-white/10 text-white/70 hover:text-white rounded-xl text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-ap-copper hover:bg-orange-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {submitting ? "Creando..." : "Crear link"}
            </button>
          </div>
        </form>
      )}

      {/* Links list */}
      {loading ? (
        <div className="text-white/60 text-center py-12">Cargando links...</div>
      ) : links.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-[28px] p-12 text-center text-white/50">
          No has creado ningún link de pago aún.
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-[28px] overflow-hidden">
          <div className="divide-y divide-white/10">
            {links.map((link) => {
              const payUrl = `${baseUrl}/pay/${link.id}`;
              const statusCls = STATUS_MAP[link.status] ?? "bg-white/10 text-white/60";

              return (
                <div key={link.id} className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{link.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCls}`}>
                          {link.status === "REQUIRES_PAYMENT" ? "Pendiente" : link.status === "PAID" ? "Pagado" : link.status}
                        </span>
                      </div>
                      {link.description && (
                        <p className="text-xs text-white/50 mt-0.5">{link.description}</p>
                      )}
                      {link.customerEmail && (
                        <p className="text-xs text-white/40 mt-0.5">→ {link.customerEmail}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-white">
                        €{(link.totalAmountCents / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-white/40">
                        base €{(link.baseAmountCents / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <CopyButton url={payUrl} />
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Ver página
                    </a>
                    <span className="text-xs text-white/30 ml-auto">
                      {new Date(link.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
