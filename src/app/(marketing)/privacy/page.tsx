import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Privacidad - Apoteosicas by Elizabeth Rizos",
  description:
    "Informacion sobre el tratamiento, conservacion y eliminacion de datos personales en Apoteosicas by Elizabeth Rizos.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ap-bg">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link
            href="/"
            className="mb-6 inline-block text-sm text-ap-copper hover:underline"
          >
            {"<-"} Volver al inicio
          </Link>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ap-copper">
            Legal
          </p>
          <h1 className="text-4xl font-bold text-ap-ivory">
            Politica de Privacidad
          </h1>
          <p className="mt-3 text-sm text-white/50">
            Ultima actualizacion: julio de 2026
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              1. Responsable del tratamiento
            </h2>
            <p>
              La responsable del tratamiento de tus datos es Elizabeth Rizos,
              titular de la plataforma{" "}
              <strong className="text-ap-ivory">
                Apoteosicas by Elizabeth Rizos
              </strong>
              .
            </p>
            <p className="mt-2">
              Para consultas sobre privacidad o ejercicio de derechos puedes
              escribir a{" "}
              <a
                href="mailto:hola@apoteosicas.com"
                className="text-ap-copper hover:underline"
              >
                hola@apoteosicas.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              2. Datos que recopilamos
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                <strong className="text-ap-ivory">Datos de cuenta:</strong> nombre,
                email, avatar y contrasena cifrada cuando te registras con
                credenciales.
              </li>
              <li>
                <strong className="text-ap-ivory">Datos de reservas:</strong>{" "}
                nombre, email, telefono, servicio, fecha y notas de la cita.
              </li>
              <li>
                <strong className="text-ap-ivory">Datos de compra:</strong>{" "}
                importes, estados de pago y metadatos operativos procesados a
                traves de Stripe. No almacenamos datos completos de tarjetas.
              </li>
              <li>
                <strong className="text-ap-ivory">Datos academicos:</strong>{" "}
                progreso, evaluaciones, certificados, comentarios y mensajes en la
                plataforma.
              </li>
              <li>
                <strong className="text-ap-ivory">Datos tecnicos:</strong>{" "}
                informacion de sesion, navegador y uso de paginas para fines de
                seguridad, medicion y mejora del servicio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              3. Finalidades del tratamiento
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>Gestionar tu cuenta y autenticar tu acceso.</li>
              <li>Procesar reservas, cobros y recibos asociados.</li>
              <li>Prestar acceso a cursos, comunidad y certificaciones.</li>
              <li>Atender incidencias, soporte y comunicaciones operativas.</li>
              <li>Cumplir obligaciones legales, fiscales y contables.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              4. Base legal
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                <strong className="text-ap-ivory">Ejecucion contractual:</strong>{" "}
                para impartir cursos, gestionar citas y procesar pagos.
              </li>
              <li>
                <strong className="text-ap-ivory">Consentimiento:</strong> cuando
                aceptas comunicaciones comerciales o subes contenido opcional.
              </li>
              <li>
                <strong className="text-ap-ivory">Interes legitimo:</strong> para
                seguridad, prevencion de abuso y mejora del servicio.
              </li>
              <li>
                <strong className="text-ap-ivory">Obligacion legal:</strong> para
                conservar la informacion exigida por normativa contable o fiscal.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              5. Destinatarios y encargados
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                <strong className="text-ap-ivory">Stripe:</strong> procesamiento de
                pagos.
              </li>
              <li>
                <strong className="text-ap-ivory">Google:</strong> autenticacion y
                correo transaccional cuando aplica.
              </li>
              <li>
                <strong className="text-ap-ivory">Cloudflare R2:</strong>{" "}
                almacenamiento de archivos e imagenes subidas a la plataforma.
              </li>
              <li>
                <strong className="text-ap-ivory">Vercel:</strong> infraestructura
                de alojamiento y ejecucion de la aplicacion.
              </li>
            </ul>
            <p className="mt-3">
              No vendemos tus datos personales. Compartimos solo lo necesario para
              operar la plataforma.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              6. Conservacion de los datos
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                <strong className="text-ap-ivory">Cuenta de usuario:</strong>{" "}
                mientras tu cuenta este activa. Si solicitas borrado, anonimizamos
                el perfil y bloqueamos el acceso futuro con esas credenciales.
              </li>
              <li>
                <strong className="text-ap-ivory">Reservas de invitados:</strong>{" "}
                los datos personales de citas realizadas sin cuenta se anonimizan
                automaticamente tras 24 meses desde la ultima interaccion relevante
                del registro.
              </li>
              <li>
                <strong className="text-ap-ivory">Pagos y contabilidad:</strong>{" "}
                ciertos registros economicos pueden conservarse durante el plazo
                legal aplicable, pero con minimizacion o desvinculacion de la
                identidad cuando sea posible.
              </li>
              <li>
                <strong className="text-ap-ivory">Certificados:</strong> podemos
                conservar los identificadores necesarios para su verificacion
                publica.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              7. Derecho de supresion y gestion desde tu cuenta
            </h2>
            <p>
              Si tienes una cuenta registrada, puedes solicitar la eliminacion desde
              el area{" "}
              <strong className="text-ap-ivory">Mi cuenta</strong> dentro de la
              plataforma. El sistema te pedira una confirmacion explicita mediante
              contrasena o enlace por email, segun tu metodo de acceso.
            </p>
            <p className="mt-3">
              Cuando la solicitud se procesa, anonimimizamos los datos personales
              identificables y mantenemos solo aquellos registros que debamos
              conservar por obligacion legal o para integridad historica del
              servicio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              8. Resto de derechos RGPD
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>Acceso a los datos que tratamos.</li>
              <li>Rectificacion de datos inexactos.</li>
              <li>Oposicion o limitacion del tratamiento en ciertos supuestos.</li>
              <li>Portabilidad cuando resulte aplicable.</li>
              <li>Retirada del consentimiento en tratamientos basados en el.</li>
            </ul>
            <p className="mt-3">
              Tambien puedes presentar una reclamacion ante la AEPD en{" "}
              <a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ap-copper hover:underline"
              >
                www.aepd.es
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              9. Seguridad
            </h2>
            <p>
              Aplicamos medidas tecnicas y organizativas razonables para proteger
              la informacion personal. Entre ellas se incluyen cifrado de
              contrasenas, conexiones HTTPS, controles de acceso y eliminacion o
              anonimizado de archivos personales cuando dejan de ser necesarios.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-ap-ivory">
              10. Cambios en esta politica
            </h2>
            <p>
              Podemos actualizar esta politica para reflejar cambios legales,
              operativos o del producto. La fecha de ultima actualizacion se muestra
              al inicio de esta pagina.
            </p>
          </section>
        </div>

        <div className="mt-12 flex gap-6 border-t border-white/10 pt-8 text-sm text-white/40">
          <Link href="/" className="transition hover:text-ap-copper">
            Inicio
          </Link>
          <Link href="/terms" className="transition hover:text-ap-copper">
            Terminos y Condiciones
          </Link>
          <a
            href="mailto:hola@apoteosicas.com"
            className="transition hover:text-ap-copper"
          >
            Contacto
          </a>
        </div>
      </section>
    </main>
  );
}
