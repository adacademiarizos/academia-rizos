import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — Apoteósicas by Elizabeth Rizos",
  description: "Política de privacidad de la plataforma Apoteósicas by Elizabeth Rizos. Información sobre el tratamiento de tus datos personales.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ap-bg">
      <section className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-ap-copper hover:underline mb-6 inline-block">
            ← Volver al inicio
          </Link>
          <p className="text-xs font-semibold tracking-wider text-ap-copper uppercase mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-ap-ivory">Política de Privacidad</h1>
          <p className="mt-3 text-white/50 text-sm">Última actualización: febrero de 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/70">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">1. Responsable del tratamiento</h2>
            <p>
              La responsable del tratamiento de tus datos es Elizabeth Rizos, titular de la plataforma
              <strong className="text-ap-ivory"> Apoteósicas by Elizabeth Rizos</strong>, con domicilio en Madrid, España.
            </p>
            <p className="mt-2">
              Para cualquier consulta sobre el tratamiento de tus datos personales, puedes contactarnos en:
              <a href="mailto:hola@apoteosicas.com" className="text-ap-copper hover:underline ml-1">hola@apoteosicas.com</a>
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">2. Datos que recopilamos</h2>
            <p>Al utilizar nuestra plataforma, podemos recopilar los siguientes datos:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong className="text-ap-ivory">Datos de registro:</strong> nombre, dirección de correo electrónico y contraseña cifrada.</li>
              <li><strong className="text-ap-ivory">Datos de reservas:</strong> nombre, correo electrónico, servicio solicitado, fecha y hora de la cita.</li>
              <li><strong className="text-ap-ivory">Datos de compra:</strong> información de pago procesada de forma segura a través de Stripe. No almacenamos datos de tarjetas de crédito.</li>
              <li><strong className="text-ap-ivory">Datos de uso académico:</strong> progreso en cursos, resultados de evaluaciones, certificados emitidos.</li>
              <li><strong className="text-ap-ivory">Datos técnicos:</strong> dirección IP, tipo de navegador, páginas visitadas y tiempo de sesión, recopilados de forma anónima con fines estadísticos.</li>
              <li><strong className="text-ap-ivory">Contenido generado:</strong> comentarios, preguntas y mensajes enviados en la plataforma.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">3. Finalidad del tratamiento</h2>
            <p>Tratamos tus datos personales con las siguientes finalidades:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Gestionar tu cuenta y acceso a la plataforma.</li>
              <li>Procesar reservas de citas y gestionar pagos.</li>
              <li>Otorgar acceso a cursos adquiridos y hacer seguimiento de tu progreso formativo.</li>
              <li>Emitir certificados de finalización de cursos.</li>
              <li>Enviarte comunicaciones relacionadas con tus compras, citas y actividad en la plataforma.</li>
              <li>Informarte sobre nuevos cursos y servicios disponibles, si has dado tu consentimiento.</li>
              <li>Cumplir con obligaciones legales y fiscales.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">4. Base legal del tratamiento</h2>
            <p>El tratamiento de tus datos se basa en:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong className="text-ap-ivory">Ejecución de un contrato:</strong> para prestarte los servicios contratados (cursos, reservas de citas).</li>
              <li><strong className="text-ap-ivory">Consentimiento:</strong> para el envío de comunicaciones comerciales y el uso de cookies no esenciales.</li>
              <li><strong className="text-ap-ivory">Interés legítimo:</strong> para mantener la seguridad de la plataforma y mejorar nuestros servicios.</li>
              <li><strong className="text-ap-ivory">Cumplimiento de obligaciones legales:</strong> para la conservación de registros contables y fiscales.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">5. Destinatarios de los datos</h2>
            <p>Tus datos podrán ser comunicados a los siguientes terceros:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong className="text-ap-ivory">Stripe:</strong> procesador de pagos. Consulta su política en <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer" className="text-ap-copper hover:underline">stripe.com/es/privacy</a>.</li>
              <li><strong className="text-ap-ivory">Google:</strong> para autenticación mediante Google OAuth y servicios de correo. Consulta su política en <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-ap-copper hover:underline">policies.google.com/privacy</a>.</li>
              <li><strong className="text-ap-ivory">Cloudflare R2:</strong> almacenamiento de archivos (recursos del curso, imágenes). Los datos se almacenan de forma segura.</li>
              <li><strong className="text-ap-ivory">Vercel:</strong> proveedor de infraestructura de alojamiento web.</li>
            </ul>
            <p className="mt-3">No vendemos tus datos a terceros. Solo compartimos los datos estrictamente necesarios para prestarte el servicio.</p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">6. Conservación de los datos</h2>
            <p>Conservamos tus datos durante el tiempo necesario para cumplir con las finalidades para las que fueron recabados:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Datos de cuenta: mientras tengas una cuenta activa y hasta 3 años después de la baja.</li>
              <li>Datos de reservas y pagos: 5 años, conforme a las obligaciones fiscales y contables.</li>
              <li>Certificados: conservados de forma permanente para permitir su verificación.</li>
              <li>Datos de comunicaciones comerciales: hasta que retires tu consentimiento.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">7. Tus derechos</h2>
            <p>De acuerdo con el Reglamento General de Protección de Datos (RGPD), tienes derecho a:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong className="text-ap-ivory">Acceso:</strong> obtener información sobre los datos personales que tratamos.</li>
              <li><strong className="text-ap-ivory">Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong className="text-ap-ivory">Supresión:</strong> solicitar la eliminación de tus datos cuando ya no sean necesarios.</li>
              <li><strong className="text-ap-ivory">Oposición:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
              <li><strong className="text-ap-ivory">Limitación:</strong> solicitar la limitación del tratamiento de tus datos.</li>
              <li><strong className="text-ap-ivory">Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
              <li><strong className="text-ap-ivory">Retirar el consentimiento:</strong> en cualquier momento, sin afectar a la licitud del tratamiento previo.</li>
            </ul>
            <p className="mt-3">
              Para ejercer tus derechos, envíanos un correo a
              <a href="mailto:hola@apoteosicas.com" className="text-ap-copper hover:underline ml-1">hola@apoteosicas.com</a>.
              También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en{" "}
              <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-ap-copper hover:underline">www.aepd.es</a>.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">8. Seguridad de los datos</h2>
            <p>
              Adoptamos medidas técnicas y organizativas adecuadas para proteger tus datos personales frente a
              accesos no autorizados, pérdida, destrucción o alteración. Las contraseñas se almacenan cifradas
              mediante algoritmos robustos (bcrypt) y los datos en tránsito se protegen mediante conexiones HTTPS.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">9. Cookies</h2>
            <p>
              Nuestra plataforma utiliza cookies técnicas estrictamente necesarias para el funcionamiento del servicio
              (gestión de sesiones de autenticación). No utilizamos cookies de seguimiento o publicidad de terceros
              sin tu consentimiento previo.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-ap-ivory mb-3">10. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política de privacidad periódicamente. Te notificaremos sobre cambios
              significativos a través del correo electrónico asociado a tu cuenta o mediante un aviso destacado
              en la plataforma. La fecha de la última actualización siempre aparecerá al inicio de este documento.
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-white/10 flex gap-6 text-sm text-white/40">
          <Link href="/" className="hover:text-ap-copper transition">Inicio</Link>
          <Link href="/terms" className="hover:text-ap-copper transition">Términos y Condiciones</Link>
          <a href="mailto:hola@apoteosicas.com" className="hover:text-ap-copper transition">Contacto</a>
        </div>
      </section>
    </main>
  );
}
