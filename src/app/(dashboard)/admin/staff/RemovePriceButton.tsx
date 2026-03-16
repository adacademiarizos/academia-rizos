"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RemovePriceButton({
  staffId,
  serviceId,
  serviceName,
  variantId,
}: {
  staffId: string;
  serviceId: string;
  serviceName: string;
  variantId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    if (!confirm(`¿Desvincular a este profesional de "${serviceName}"?`)) return;
    setLoading(true);
    try {
      await fetch("/api/admin/prices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, serviceId, ...(variantId ? { variantId } : {}) }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={loading}
      title="Desvincular de este servicio"
      className="ml-1 shrink-0 text-white/25 hover:text-red-400 transition disabled:opacity-40"
    >
      <X className="h-3 w-3" />
    </button>
  );
}
