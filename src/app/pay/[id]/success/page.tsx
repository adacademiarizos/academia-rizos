import Link from "next/link";

export default function PaySuccessPage() {
  return (
    <main className="min-h-screen bg-[#181716] px-6 py-16 text-white flex items-center justify-center">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-3xl text-center">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#646a40]/20 ring-1 ring-[#646a40]/40">
            <svg className="h-8 w-8 text-[#c8cf94]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-normal text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Pago confirmado
        </h1>
        <p className="text-sm text-white/60 leading-relaxed">
          Recibirás un comprobante de pago y la confirmación de tu cita por correo electrónico.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#646a40] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            ← Volver al inicio
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/8 border border-white/10 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/12 transition"
          >
            Reservar otra cita
          </Link>
        </div>
      </div>
    </main>
  );
}
