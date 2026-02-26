import Link from "next/link";

export default function ContactSection() {
  return (
    <section id="contacto" className="py-20 px-6 border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-wider text-ap-copper uppercase mb-2">
            Contacto
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-ap-ivory">
            Estamos aquí para ti
          </h2>
          <p className="mt-3 text-white/60 text-base max-w-xl mx-auto">
            Puedes contactarnos a través de nuestras redes sociales, por correo electrónico o visitar nuestro estudio físico.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Social Media */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper text-xl">
                📱
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">Redes Sociales</h3>
            </div>

            <div className="space-y-3">
              <a
                href="https://www.instagram.com/elizabeth.rizos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <span className="text-xl">📸</span>
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">Instagram</div>
                  <div className="text-xs text-white/40">@elizabeth.rizos</div>
                </div>
              </a>

              <a
                href="https://www.tiktok.com/@elizabeth.rizos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <span className="text-xl">🎵</span>
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">TikTok</div>
                  <div className="text-xs text-white/40">@elizabeth.rizos</div>
                </div>
              </a>

              <a
                href="https://www.facebook.com/elizabethrizos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <span className="text-xl">🌐</span>
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">Facebook</div>
                  <div className="text-xs text-white/40">elizabeth rizos</div>
                </div>
              </a>

              <a
                href="https://wa.me/34600000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <span className="text-xl">💬</span>
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">WhatsApp</div>
                  <div className="text-xs text-white/40">Escríbenos directamente</div>
                </div>
              </a>
            </div>
          </div>

          {/* Email */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper text-xl">
                ✉️
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">Correo Electrónico</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Consultas generales</div>
                <a
                  href="mailto:hola@apoteosicas.com"
                  className="text-sm font-medium text-ap-ivory hover:text-ap-copper transition"
                >
                  hola@apoteosicas.com
                </a>
              </div>

              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Academia y cursos</div>
                <a
                  href="mailto:academia@apoteosicas.com"
                  className="text-sm font-medium text-ap-ivory hover:text-ap-copper transition"
                >
                  academia@apoteosicas.com
                </a>
              </div>

              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Citas y reservas</div>
                <Link
                  href="/booking"
                  className="text-sm font-medium text-ap-copper hover:text-ap-copper/80 transition"
                >
                  Reservar cita online →
                </Link>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper text-xl">
                📍
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">Nuestro Estudio</h3>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Dirección</div>
                <p className="text-sm text-ap-ivory font-medium">
                  Calle Ejemplo, 123<br />
                  28001 Madrid, España
                </p>
              </div>

              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Horario</div>
                <div className="text-sm text-white/70 space-y-0.5">
                  <div>Lunes – Viernes: 10:00 – 20:00</div>
                  <div>Sábado: 10:00 – 15:00</div>
                  <div>Domingo: Cerrado</div>
                </div>
              </div>

              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-ap-copper hover:text-ap-copper/80 transition mt-2"
              >
                Ver en Google Maps →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
