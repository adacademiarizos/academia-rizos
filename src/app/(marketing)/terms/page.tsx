import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Apoteósicas by Elizabeth Rizos",
  description: "Términos y condiciones de uso de la plataforma Apoteósicas by Elizabeth Rizos.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ap-bg">
      <section className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-ap-copper hover:underline mb-6 inline-block">
            ← Volver al inicio
          </Link>
          <p className="text-xs font-semibold tracking-wider text-ap-copper uppercase mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-ap-ivory">Términos y Condiciones</h1>
          <p className="mt-3 text-white/50 text-sm">Última actualización: febrero de 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">1. Identificación del titular</h2>
            <p>
              La plataforma <strong className="text-ap-ivory">Apoteósicas by Elizabeth Rizos</strong> es titularidad
              de Elizabeth Rizos, con domicilio en Madrid, España. Para cualquier consulta, puedes contactar en
              <a href="mailto:hola@apoteosicas.com" className="text-ap-copper hover:underline ml-1">hola@apoteosicas.com</a>.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">2. Objeto y ámbito de aplicación</h2>
            <p>
              Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma Apoteósicas,
              que ofrece los siguientes servicios:
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong className="text-ap-ivory">Academia online:</strong> cursos sobre cuidado y estilismo de cabello rizado con acceso digital, evaluaciones y certificados verificables.</li>
              <li><strong className="text-ap-ivory">Reserva de citas:</strong> gestión de citas en el estudio físico para servicios de peluquería y tratamientos capilares.</li>
              <li><strong className="text-ap-ivory">Comunidad:</strong> foros, comentarios y espacios de interacción entre estudiantes y la instructora.</li>
            </ul>
            <p className="mt-3">
              El acceso a la plataforma implica la aceptación plena y sin reservas de estos términos.
              Si no estás de acuerdo, debes abstenerte de usar la plataforma.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">3. Registro y cuenta de usuario</h2>
            <p>Para acceder a la mayoría de los servicios, es necesario crear una cuenta. Al registrarte, te comprometes a:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Proporcionarnos información veraz, actualizada y completa.</li>
              <li>Mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Notificarnos de inmediato cualquier uso no autorizado de tu cuenta.</li>
              <li>Ser el único responsable de todas las actividades realizadas bajo tu cuenta.</li>
            </ul>
            <p className="mt-3">
              Nos reservamos el derecho a suspender o cancelar cuentas que incumplan estos términos,
              compartan credenciales de acceso con terceros o utilicen la plataforma de forma fraudulenta.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">4. Servicios de la academia — Cursos</h2>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">4.1 Condiciones de acceso</h3>
            <p>
              Al adquirir un curso, obtienes acceso personal, intransferible y no exclusivo al contenido
              durante el periodo indicado (acceso de por vida o temporal, según el curso).
            </p>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">4.2 Propiedad intelectual</h3>
            <p>
              Todo el contenido de los cursos (vídeos, textos, imágenes, evaluaciones y materiales descargables)
              es propiedad de Elizabeth Rizos o está bajo licencia. Queda expresamente prohibida la reproducción,
              distribución, compartición o venta del contenido a terceros, total o parcialmente, sin autorización escrita previa.
            </p>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">4.3 Uso permitido</h3>
            <p>Los materiales del curso están destinados exclusivamente a tu uso educativo personal. No está permitido:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Compartir tu acceso con otras personas.</li>
              <li>Descargar o reproducir los vídeos fuera de la plataforma.</li>
              <li>Utilizar el contenido con fines comerciales sin autorización.</li>
              <li>Crear contenido derivado para distribución pública.</li>
            </ul>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">4.4 Certificados</h3>
            <p>
              Al completar satisfactoriamente un curso y superar las evaluaciones correspondientes,
              se emitirá un certificado digital con código de verificación QR único.
              Este certificado acredita la finalización del curso y es verificable públicamente.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">5. Reserva de citas y servicios en estudio</h2>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">5.1 Proceso de reserva</h3>
            <p>
              Las citas se reservan a través de la plataforma seleccionando el servicio, el profesional
              y la franja horaria disponible. La reserva se confirma tras completar el proceso de pago.
            </p>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">5.2 Cancelaciones y modificaciones</h3>
            <p>
              Para cancelar o modificar una cita, debes hacerlo con al menos 24 horas de antelación.
              Las cancelaciones con menos de 24 horas de antelación o la no presentación sin aviso previo
              pueden dar lugar a la pérdida del importe abonado, según la política de cada servicio.
            </p>

            <h3 className="text-base font-semibold text-ap-ivory mt-4 mb-2">5.3 Responsabilidad del cliente</h3>
            <p>
              El cliente es responsable de acudir con el cabello en las condiciones indicadas para el
              servicio contratado. Elizabeth Rizos no se responsabiliza de resultados insatisfactorios
              derivados del incumplimiento de estas indicaciones.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">6. Precios y pagos</h2>
            <p>
              Todos los precios se muestran en euros (EUR) e incluyen el IVA aplicable, salvo que se
              indique expresamente lo contrario. Los pagos se procesan de forma segura a través de Stripe.
            </p>
            <p className="mt-3">
              Una vez completado el pago de un curso, no se realizan devoluciones, dado que el acceso
              al contenido digital es inmediato. En caso de problemas técnicos que impidan el acceso
              al servicio adquirido, estudiaremos cada caso de forma individual.
            </p>
            <p className="mt-3">
              Para citas, la política de devolución se especifica en el punto 5.2 de estos términos.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">7. Conducta en la comunidad</h2>
            <p>Al participar en los espacios comunitarios de la plataforma (comentarios, chat, foros), te comprometes a:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Mantener un tono respetuoso y constructivo.</li>
              <li>No publicar contenido ofensivo, discriminatorio, ilegal o que vulnere derechos de terceros.</li>
              <li>No realizar spam, publicidad no autorizada ni promoción de servicios competidores.</li>
              <li>No compartir información personal de otros usuarios.</li>
            </ul>
            <p className="mt-3">
              Nos reservamos el derecho a eliminar contenido y suspender cuentas que incumplan estas normas.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">8. Limitación de responsabilidad</h2>
            <p>
              Apoteósicas by Elizabeth Rizos no se responsabiliza de interrupciones del servicio derivadas
              de causas más allá de nuestro control (errores de terceros proveedores, desastres naturales, etc.).
              Hacemos todo lo posible por mantener la plataforma disponible y actualizada, pero no garantizamos
              la disponibilidad ininterrumpida del servicio.
            </p>
            <p className="mt-3">
              Los resultados obtenidos con la aplicación de los conocimientos impartidos en los cursos
              pueden variar según las condiciones individuales de cada estudiante. No garantizamos resultados específicos.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">9. Modificaciones</h2>
            <p>
              Podemos modificar estos Términos y Condiciones en cualquier momento. Los cambios entrarán en
              vigor desde su publicación en la plataforma. Si continúas usando la plataforma tras la
              publicación de los cambios, se entenderá que los aceptas.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">10. Legislación aplicable y jurisdicción</h2>
            <p>
              Estos Términos y Condiciones se rigen por la legislación española. Para la resolución de
              cualquier controversia, las partes se someten a los Juzgados y Tribunales de Madrid,
              salvo que la normativa aplicable establezca un fuero imperativo diferente.
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-white/10 flex gap-6 text-sm text-white/40">
          <Link href="/" className="hover:text-ap-copper transition">Inicio</Link>
          <Link href="/privacy" className="hover:text-ap-copper transition">Política de Privacidad</Link>
          <a href="mailto:hola@apoteosicas.com" className="hover:text-ap-copper transition">Contacto</a>
        </div>
      </section>
    </main>
  );
}
