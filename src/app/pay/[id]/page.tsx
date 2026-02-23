import Link from "next/link";
import { db } from "@/lib/db";

function money(cents: number, currency = "EUR") {
  const symbol = currency === "EUR" ? "€" : currency + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

// 1. Actualizamos los tipos a Promise
export default async function PayPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>; 
  searchParams: Promise<{ canceled?: string }>; 
}) {
  // 2. Esperamos a que las promesas se resuelvan
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  // 3. Usamos las variables resueltas
  const link = await db.paymentLink.findUnique({ 
    where: { id: resolvedParams.id } 
  });

  if (!link) {
    return (
      <main className="min-h-screen bg-ap-bg px-6 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-2xl font-semibold">Link no encontrado</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ap-bg px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
        <h1 className="font-(--font-display) text-4xl">{link.title}</h1>
        {link.description && <p className="mt-3 text-white/70">{link.description}</p>}

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="text-xs text-white/60">Total</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {money(link.totalAmountCents, link.currency)}
          </div>
          <div className="mt-2 text-xs text-white/55">
            (Incluye comisiones de pago)
          </div>
        </div>

        {/* Usamos resolvedSearchParams aquí */}
        {resolvedSearchParams.canceled ? (
          <div className="mt-4 text-sm text-white/70">
            Pago cancelado. Podés intentarlo de nuevo.
          </div>
        ) : null}

        <div className="mt-6">
          <form action={`/api/pay/${link.id}/checkout`} method="post">
            <button className="w-full rounded-full bg-(--copper) px-6 py-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-95 transition">
              Pagar ahora
            </button>
          </form>

          <p className="mt-3 text-xs text-white/55">
            Luego del pago, te llega un comprobante por email.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-white/50">
          <Link href="/" className="hover:text-white">Volver al sitio</Link>
        </div>
      </div>
    </main>
  );
}