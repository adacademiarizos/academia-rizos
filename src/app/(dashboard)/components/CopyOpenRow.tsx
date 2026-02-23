"use client";

import { useMemo, useState } from "react";

export default function CopyOpenRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const short = useMemo(() => {
    try {
      const u = new URL(url);
      return `${u.host}${u.pathname}`;
    } catch {
      return url;
    }
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback viejo
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/70 flex items-center justify-between gap-3">
      <span className="truncate">{short}</span>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 transition"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 transition"
        >
          Abrir
        </a>
      </div>
    </div>
  );
}
