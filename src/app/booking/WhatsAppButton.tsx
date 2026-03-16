"use client";

import { MessageCircle } from "lucide-react";

export default function WhatsAppButton({
  serviceName,
  variantName,
  phone = "34692376669",
}: {
  serviceName: string;
  variantName?: string;
  phone?: string;
}) {
  const message = encodeURIComponent(
    `Hola! Tengo una consulta sobre el servicio "${serviceName}"${variantName ? ` - ${variantName}` : ""}.`
  );
  const href = `https://wa.me/${phone}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition"
    >
      <MessageCircle className="h-4 w-4 text-green-400" />
      Consultar por WhatsApp
    </a>
  );
}
