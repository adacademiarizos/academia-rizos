"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, LayoutTemplate, Link2, Mail, MapPin, Scissors, Share2 } from "lucide-react";
import type { ContactContent } from "@/lib/contact-content";

type ContactPayload = {
  academia: ContactContent;
  salon: ContactContent;
};

type ScopeKey = keyof ContactPayload;

const SCOPE_META: Record<
  ScopeKey,
  { label: string; subtitle: string; icon: LucideIcon }
> = {
  academia: {
    label: "Academia",
    subtitle: "Home + Landing Academia",
    icon: GraduationCap,
  },
  salon: {
    label: "Salon",
    subtitle: "Landing Salon",
    icon: Scissors,
  },
};

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-white/15 bg-white/5 p-2 text-ap-copper">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function ContactContentEditor({ initial }: { initial: ContactPayload }) {
  const [form, setForm] = useState<ContactPayload>(initial);
  const [activeScope, setActiveScope] = useState<ScopeKey>("academia");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof ContactContent>(scope: ScopeKey, key: K, value: string) {
    setForm((prev) => ({
      ...prev,
      [scope]: {
        ...prev[scope],
        [key]: value,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/admin/landing/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? "No se pudo guardar");
      }
      setForm(json.data ?? form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30";
  const textareaClass = `${inputClass} resize-y min-h-[96px]`;

  const scopeData = form[activeScope];
  const scopeMeta = useMemo(() => SCOPE_META[activeScope], [activeScope]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(SCOPE_META) as ScopeKey[]).map((scope) => {
            const meta = SCOPE_META[scope];
            const Icon = meta.icon;
            const active = activeScope === scope;
            return (
              <button
                key={scope}
                type="button"
                onClick={() => setActiveScope(scope)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-ap-copper/50 bg-ap-copper/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <span
                  className={`rounded-lg border p-2 ${
                    active ? "border-ap-copper/60 bg-ap-copper/25 text-ap-copper" : "border-white/20 bg-white/10 text-white/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{meta.label}</span>
                  <span className="block truncate text-xs text-white/50">{meta.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-white/15 bg-white/5 p-2 text-ap-copper">
            <scopeMeta.icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">Editando: {scopeMeta.label}</h2>
            <p className="text-xs text-white/50">Aplicacion: {scopeMeta.subtitle}</p>
          </div>
        </div>
      </section>

      <SectionCard icon={LayoutTemplate} title="Identidad de la seccion">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Kicker</label>
            <input
              className={inputClass}
              value={scopeData.sectionKicker}
              onChange={(e) => setField(activeScope, "sectionKicker", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Titulo</label>
            <input
              className={inputClass}
              value={scopeData.sectionTitle}
              onChange={(e) => setField(activeScope, "sectionTitle", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Descripcion</label>
            <textarea
              className={textareaClass}
              value={scopeData.sectionDescription}
              onChange={(e) => setField(activeScope, "sectionDescription", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Share2} title="Redes sociales">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Instagram URL</label>
            <input
              className={inputClass}
              value={scopeData.instagramUrl}
              onChange={(e) => setField(activeScope, "instagramUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Instagram handle</label>
            <input
              className={inputClass}
              value={scopeData.instagramHandle}
              onChange={(e) => setField(activeScope, "instagramHandle", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">TikTok URL</label>
            <input
              className={inputClass}
              value={scopeData.tiktokUrl}
              onChange={(e) => setField(activeScope, "tiktokUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">TikTok handle</label>
            <input
              className={inputClass}
              value={scopeData.tiktokHandle}
              onChange={(e) => setField(activeScope, "tiktokHandle", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Facebook URL</label>
            <input
              className={inputClass}
              value={scopeData.facebookUrl}
              onChange={(e) => setField(activeScope, "facebookUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Facebook handle</label>
            <input
              className={inputClass}
              value={scopeData.facebookHandle}
              onChange={(e) => setField(activeScope, "facebookHandle", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Mail} title="Mensajeria y correos">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">WhatsApp URL</label>
            <input
              className={inputClass}
              value={scopeData.whatsappUrl}
              onChange={(e) => setField(activeScope, "whatsappUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Texto WhatsApp</label>
            <input
              className={inputClass}
              value={scopeData.whatsappLabel}
              onChange={(e) => setField(activeScope, "whatsappLabel", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Label email principal</label>
            <input
              className={inputClass}
              value={scopeData.emailPrimaryLabel}
              onChange={(e) => setField(activeScope, "emailPrimaryLabel", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Email principal</label>
            <input
              className={inputClass}
              value={scopeData.emailPrimary}
              onChange={(e) => setField(activeScope, "emailPrimary", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Label email secundario</label>
            <input
              className={inputClass}
              value={scopeData.emailSecondaryLabel}
              onChange={(e) => setField(activeScope, "emailSecondaryLabel", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Email secundario</label>
            <input
              className={inputClass}
              value={scopeData.emailSecondary}
              onChange={(e) => setField(activeScope, "emailSecondary", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Link2} title="CTA de contacto">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">CTA texto</label>
            <input
              className={inputClass}
              value={scopeData.actionLabel}
              onChange={(e) => setField(activeScope, "actionLabel", e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">CTA enlace</label>
            <input
              className={inputClass}
              value={scopeData.actionHref}
              onChange={(e) => setField(activeScope, "actionHref", e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={MapPin} title="Ubicacion y horario">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Titulo ubicacion</label>
            <input
              className={inputClass}
              value={scopeData.locationTitle}
              onChange={(e) => setField(activeScope, "locationTitle", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Google Maps URL</label>
            <input
              className={inputClass}
              value={scopeData.mapsUrl}
              onChange={(e) => setField(activeScope, "mapsUrl", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Direccion (admite saltos de linea)</label>
            <textarea
              className={textareaClass}
              value={scopeData.address}
              onChange={(e) => setField(activeScope, "address", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Horario linea 1</label>
            <input
              className={inputClass}
              value={scopeData.scheduleLine1}
              onChange={(e) => setField(activeScope, "scheduleLine1", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Horario linea 2</label>
            <input
              className={inputClass}
              value={scopeData.scheduleLine2}
              onChange={(e) => setField(activeScope, "scheduleLine2", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Horario linea 3</label>
            <input
              className={inputClass}
              value={scopeData.scheduleLine3}
              onChange={(e) => setField(activeScope, "scheduleLine3", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-ap-copper px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <span className="text-sm text-green-400">Guardado correctamente.</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
