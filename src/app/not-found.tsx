import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#181716] flex flex-col items-center justify-center px-4 text-center">
      {/* Decorative number */}
      <p
        className="text-[120px] font-bold leading-none select-none"
        style={{
          fontFamily: 'Georgia, serif',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,0.08)',
        }}
      >
        404
      </p>

      {/* Symbol */}
      <div
        className="text-2xl mb-4 -mt-4"
        style={{ color: '#B16E34', fontFamily: 'Georgia, serif' }}
      >
        ✦
      </div>

      {/* Label */}
      <p className="text-xs uppercase tracking-widest text-[#c8cf94] mb-3">
        Página no encontrada
      </p>

      {/* Heading */}
      <h1
        className="text-2xl text-white/80 mb-3 max-w-xs leading-snug"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        Esta página no existe o fue movida
      </h1>

      {/* Description */}
      <p className="text-sm text-white/35 max-w-xs mb-8">
        Es posible que la URL esté mal escrita o que el contenido haya sido eliminado.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="h-11 px-8 flex items-center justify-center rounded-2xl bg-[#646a40] text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-90 active:scale-[0.99] transition"
        >
          Volver al inicio
        </Link>
        <Link
          href="/booking"
          className="h-11 px-8 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 transition"
        >
          Reservar una cita
        </Link>
      </div>

      {/* Logo watermark */}
      <div className="mt-16 opacity-20">
        <img src="/logo.png" alt="Apoteósicas" className="h-8 mx-auto" />
      </div>
    </div>
  )
}
