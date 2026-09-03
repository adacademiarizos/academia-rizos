"use client";

import { useEffect, useState } from "react";

type Category = "COURSE_UPDATES" | "COMMUNITY" | "ACHIEVEMENTS";

type Preference = { category: Category; enabled: boolean };

const CATEGORY_COPY: Record<Category, { title: string; description: string }> = {
  COURSE_UPDATES: {
    title: "Novedades de cursos",
    description: "Nuevas lecciones, materiales y avisos de los cursos en los que estás inscrita.",
  },
  COMMUNITY: {
    title: "Comunidad",
    description: "Menciones y respuestas en los chats de curso y en la comunidad.",
  },
  ACHIEVEMENTS: {
    title: "Logros y certificados",
    description: "Cuando apruebas un examen o tu certificado queda listo para descargar.",
  },
};

const cardClass =
  "rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl";

export function AccountNotificationsPanel() {
  const [preferences, setPreferences] = useState<Preference[] | null>(null);
  const [pending, setPending] = useState<Category | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/notification-preferences")
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        if (payload.success) setPreferences(payload.data);
        else setError("No pudimos cargar tus preferencias.");
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus preferencias.");
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (category: Category, enabled: boolean) => {
    setError("");
    setPending(category);
    // Move the switch first so the interaction feels immediate, and put it back
    // if the server rejects the change.
    setPreferences((current) =>
      current?.map((preference) =>
        preference.category === category ? { ...preference, enabled } : preference
      ) ?? null
    );

    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, enabled }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error();
    } catch {
      setPreferences((current) =>
        current?.map((preference) =>
          preference.category === category ? { ...preference, enabled: !enabled } : preference
        ) ?? null
      );
      setError("No se pudo guardar el cambio. Inténtalo otra vez.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className={cardClass}>
      <h2 className="text-base font-semibold text-white">Notificaciones por correo</h2>
      <p className="mt-1 text-sm text-white/55">
        Los avisos de seguridad, pagos y revisiones siempre se envían y no se pueden desactivar.
      </p>

      {!preferences ? (
        <p className="mt-6 text-sm text-white/40">Cargando preferencias...</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {preferences.map((preference) => {
            const copy = CATEGORY_COPY[preference.category];
            if (!copy) return null;
            return (
              <label
                key={preference.category}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{copy.title}</span>
                  <span className="mt-1 block text-sm text-white/50">{copy.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={preference.enabled}
                  disabled={pending === preference.category}
                  onChange={(event) => toggle(preference.category, event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#b16e34]"
                />
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
