import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  LayoutDashboard, Scissors, Users, CalendarDays, Clock,
  GraduationCap, FileCheck, ClipboardCheck, Link2, Images,
  HelpCircle, UserCog, Settings, BookOpen, ChevronRight,
  AlertCircle, Lightbulb, CheckCircle2,
} from "lucide-react";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.email) redirect("/signin");
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") redirect("/");
}

// ── Shared UI components ───────────────────────────────────────────

function SectionHeader({ id, icon: Icon, title, subtitle }: {
  id: string; icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div id={id} className="flex items-start gap-4 mb-6 scroll-mt-6">
      <div className="w-10 h-10 rounded-xl bg-ap-copper/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-5 h-5 text-ap-copper" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-ap-copper/8 border border-ap-copper/20 px-4 py-3 my-4">
      <Lightbulb className="w-4 h-4 text-ap-copper shrink-0 mt-0.5" />
      <p className="text-sm text-white/70">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 my-4">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-white/70">{children}</p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 my-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="w-5 h-5 rounded-full bg-ap-copper/20 text-ap-copper text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-white/70">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Field({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm font-medium text-ap-copper w-36 shrink-0">{label}</span>
      <span className="text-sm text-white/60">{desc}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 mb-6 space-y-1">
      {children}
    </div>
  );
}

const TOC = [
  { id: "overview",      label: "Overview",           icon: LayoutDashboard },
  { id: "services",      label: "Servicios",           icon: Scissors },
  { id: "staff",         label: "Staff y Precios",     icon: Users },
  { id: "appointments",  label: "Citas",               icon: CalendarDays },
  { id: "schedule",      label: "Horarios",            icon: Clock },
  { id: "courses",       label: "Cursos",              icon: GraduationCap },
  { id: "certificates",  label: "Certificados",        icon: FileCheck },
  { id: "review",        label: "Revisar Exámenes",    icon: ClipboardCheck },
  { id: "paylinks",      label: "Links de Pago",       icon: Link2 },
  { id: "beforeafter",   label: "Antes y Después",     icon: Images },
  { id: "faq",           label: "FAQ",                 icon: HelpCircle },
  { id: "users",         label: "Usuarios",            icon: UserCog },
  { id: "settings",      label: "Settings",            icon: Settings },
];

export default async function AdminManualPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#181716] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-8">

        {/* ── Sticky TOC ───────────────────────────────────────── */}
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-6 rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Contenido
            </p>
            <nav className="space-y-0.5">
              {TOC.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition group"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-ap-copper/60 group-hover:text-ap-copper transition" />
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Content ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Header */}
          <div className="pb-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-ap-copper/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-ap-copper" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">Manual del Administrador</h1>
                <p className="text-sm text-white/40">Guía completa de la plataforma Apoteósicas</p>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Este manual cubre todas las funciones disponibles para el rol de <strong className="text-ap-copper">Administrador</strong>.
              Usá el índice de la izquierda para navegar entre secciones.
            </p>
          </div>

          {/* ══ 1. OVERVIEW ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="overview"
              icon={LayoutDashboard}
              title="Overview — Panel Principal"
              subtitle="Vista rápida de toda la actividad de la plataforma"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              El Overview es la primera pantalla al ingresar como administrador. Muestra métricas clave
              organizadas en tarjetas para que puedas tomar decisiones rápidas sin navegar a cada sección.
            </p>
            <Card>
              <Field label="Usuarios"          desc="Total de usuarios registrados y nuevos ingresos del mes actual." />
              <Field label="Ingresos"          desc="Recaudación total histórica y del mes en curso. Desglosado por citas, cursos y links de pago." />
              <Field label="Citas"             desc="Citas de hoy, confirmadas del mes, pendientes, y resumen de estados (completadas, canceladas, no-show)." />
              <Field label="Academia"          desc="Cursos activos, inscripciones totales, activas, certificados emitidos y exámenes pendientes de revisión." />
              <Field label="Reportes de bugs"  desc="Cantidad total de reportes y desglose por tipo (contenido vs funcionalidad)." />
            </Card>
            <Tip>
              Si aparece un ícono de advertencia naranja junto a &quot;Exámenes pendientes&quot;, hay estudiantes esperando revisión.
              Hacé clic en &quot;Revisar Exámenes&quot; en el menú lateral para atenderlos.
            </Tip>
          </section>

          {/* ══ 2. SERVICIOS ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="services"
              icon={Scissors}
              title="Servicios"
              subtitle="Creá y administrá los servicios ofrecidos en el negocio"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Los servicios son los tratamientos o actividades que los clientes pueden reservar. Cada servicio
              define su duración y regla de cobro, que luego se combina con los precios por profesional.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Crear un servicio</h3>
            <Steps items={[
              "Ir a Servicios en el menú lateral.",
              "Completar el formulario: nombre, descripción, duración en minutos y regla de facturación.",
              "Elegir la regla de cobro: FULL (pago completo al reservar), DEPOSIT (cobro parcial) o AUTHORIZE (no cobra, solo autoriza).",
              "Si elegiste DEPOSIT, ingresar el porcentaje a cobrar como anticipo.",
              "Guardar. El servicio queda disponible para asignar precios al staff.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Reglas de cobro</h3>
            <Card>
              <Field label="FULL"      desc="El cliente paga el 100% al momento de reservar." />
              <Field label="DEPOSIT"   desc="El cliente paga solo el porcentaje configurado como anticipo." />
              <Field label="AUTHORIZE" desc="No se cobra nada al reservar. Solo se registra la cita." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Editar o eliminar</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Haz clic en el ícono de edición sobre cualquier servicio para modificar sus datos. Para eliminar,
              usar el botón correspondiente. Si el servicio tiene citas asociadas, asegurate de gestionarlas antes.
            </p>
          </section>

          {/* ══ 3. STAFF ══════════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="staff"
              icon={Users}
              title="Staff y Precios"
              subtitle="Gestioná el equipo y sus tarifas por servicio"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              En esta sección ves todos los usuarios con rol Staff o Admin, y podés asignarles precios
              individuales por servicio. El precio del servicio varía según el profesional.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Asignar precio a un profesional</h3>
            <Steps items={[
              "Ir a Staff en el menú lateral.",
              "Buscar al profesional en la lista.",
              "En el formulario de precios, seleccionar el servicio y el monto.",
              "Elegir la moneda (EUR/USD) y hacer clic en Guardar.",
              "El precio aparecerá en el perfil del profesional y será utilizado en el flujo de reservas.",
            ]} />

            <Tip>
              Podés asignar precios distintos al mismo servicio para diferentes profesionales.
              Si un profesional no tiene precio asignado para un servicio, ese servicio no aparecerá disponible
              para ese profesional en el proceso de reserva.
            </Tip>

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Eliminar un precio</h3>
            <p className="text-sm text-white/60">
              Cada fila de precio tiene un botón de eliminar. Al quitarlo, el profesional deja de aparecer
              disponible para ese servicio específico.
            </p>
          </section>

          {/* ══ 4. CITAS ══════════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="appointments"
              icon={CalendarDays}
              title="Citas"
              subtitle="Seguimiento y gestión de todas las reservas"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              La sección de Citas muestra todas las reservas del negocio. Por defecto se filtran las citas
              del día actual, pero podés navegar por cualquier fecha.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Filtros disponibles</h3>
            <Card>
              <Field label="Nombre del cliente" desc="Busca por nombre o email del cliente reservante." />
              <Field label="Fecha"              desc="Navegá día a día con las flechas o abrí el selector de fecha." />
              <Field label="Estado"             desc="Filtrá por: Pendiente, Confirmada, Completada, Cancelada o No-show." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Estados de una cita</h3>
            <Card>
              <Field label="Pendiente"   desc="La cita fue reservada pero aún no confirmada por el equipo." />
              <Field label="Confirmada"  desc="El equipo confirmó la asistencia del cliente." />
              <Field label="Completada"  desc="El servicio fue realizado exitosamente." />
              <Field label="Cancelada"   desc="La cita fue cancelada (por cliente o equipo)." />
              <Field label="No-show"     desc="El cliente no se presentó." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Cambiar estado</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Cada tarjeta de cita muestra botones de acción según el estado actual.
              Los cambios disponibles siguen una lógica progresiva: no se puede volver de &quot;Completada&quot;
              a estados anteriores.
            </p>
            <Tip>
              Las citas creadas desde la web de reservas incluyen el cliente, servicio, profesional y
              datos de pago. Las citas pueden tener pago registrado con estado PAID o pendiente.
            </Tip>
          </section>

          {/* ══ 5. HORARIOS ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="schedule"
              icon={Clock}
              title="Horarios"
              subtitle="Configurá los horarios de atención y días libres"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Los horarios configurados aquí determinan cuándo los clientes pueden hacer reservas
              y también se muestran en la página pública de la plataforma.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Horarios de atención</h3>
            <Steps items={[
              "Ir a Horarios en el menú lateral.",
              "Para cada día de la semana, activar o desactivar el toggle de apertura.",
              "Configurar la hora de apertura y cierre para los días activos.",
              "Los cambios se guardan automáticamente.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Días libres / excepciones</h3>
            <Steps items={[
              "En la sección de Días Libres, hacer clic en el selector de fecha.",
              "Elegir una fecha futura en la que el negocio estará cerrado (feriado, vacaciones, etc.).",
              "Agregar. Ese día quedará bloqueado para nuevas reservas.",
              "Para eliminar un día libre, hacer clic en el botón de eliminar junto a la fecha.",
            ]} />

            <Warning>
              Solo se pueden agregar días libres en fechas futuras. Las fechas pasadas no son editables.
            </Warning>
          </section>

          {/* ══ 6. CURSOS ════════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="courses"
              icon={GraduationCap}
              title="Cursos y Academia"
              subtitle="Creá, editá y estructurá los cursos de la plataforma"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              El módulo de Cursos es la parte central de la academia. Permite crear cursos completos
              con módulos, lecciones, tests, recursos y exámenes finales.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Crear un curso</h3>
            <Steps items={[
              "Ir a Cursos en el menú lateral y hacer clic en 'Nuevo Curso'.",
              "Completar: título, descripción, precio base, días de acceso (vacío = acceso permanente).",
              "Subir una imagen de portada (JPG/PNG/WebP, máx. 5MB).",
              "Activar el toggle para publicar. Los cursos inactivos no son visibles para estudiantes.",
              "El precio final incluye comisiones de Stripe, visibles en tiempo real.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Estructura de un curso</h3>
            <Card>
              <Field label="Módulos"   desc="Bloques de contenido principales. Cada módulo puede tener lecciones, tests y recursos." />
              <Field label="Lecciones" desc="Videos individuales dentro de un módulo. Incluyen descripción y transcripción." />
              <Field label="Tests de módulo" desc="Evaluaciones dentro de un módulo específico. No son el examen final." />
              <Field label="Tests globales"  desc="Evaluaciones a nivel de curso. Pueden marcarse como examen final." />
              <Field label="Recursos"        desc="Archivos descargables (PDFs, imágenes, documentos) adjuntos a un módulo." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Agregar módulos y lecciones</h3>
            <Steps items={[
              "Entrar al curso y hacer clic en 'Editar'.",
              "En la sección Módulos, hacer clic en '+ Agregar módulo' y completar el título.",
              "Dentro del módulo, hacer clic en '+ Agregar lección', completar título y subir el video.",
              "Opcionalmente, transcribir el video con IA haciendo clic en 'Transcribir'.",
              "Generar la sinopsis de la lección con el botón '✨ Generar con IA' (requiere transcripción).",
              "Reordenar módulos arrastrando desde el ícono de arrastre.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Crear un examen final</h3>
            <Steps items={[
              "En el editor del curso, ir a la sección 'Tests del curso'.",
              "Crear un test nuevo y activar el toggle 'Es examen final'.",
              "Agregar preguntas: opción múltiple (corrección automática), escrita o subida de archivo (revisión manual).",
              "Para preguntas de opción múltiple, configurar las opciones y marcar la respuesta correcta.",
              "El estudiante solo puede enviar el examen final una vez (o las veces que configures).",
            ]} />

            <Tip>
              Las preguntas de tipo &quot;Escrita&quot; y &quot;Subida de archivo&quot; requieren revisión manual desde
              la sección &quot;Revisar Exámenes&quot;. El certificado se emite automáticamente al aprobar.
            </Tip>

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Notificar estudiantes</h3>
            <p className="text-sm text-white/60">
              En la lista de cursos, el ícono de campana envía un email a todos los estudiantes inscriptos
              en ese curso. Útil para anunciar nuevo contenido o avisos importantes.
            </p>
          </section>

          {/* ══ 7. CERTIFICADOS ═══════════════════════════════════ */}
          <section>
            <SectionHeader
              id="certificates"
              icon={FileCheck}
              title="Certificados"
              subtitle="Registro de certificados emitidos y pendientes de aprobación"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              La sección de Certificados muestra todos los certificados generados por la plataforma.
              Están divididos en dos categorías.
            </p>
            <Card>
              <Field label="Pendientes de aprobación" desc="Cursos sin examen final donde el estudiante completó todos los módulos. Requieren aprobación manual del admin para emitir el certificado." />
              <Field label="Certificados emitidos"     desc="Certificados ya generados, con PDF disponible para descarga. Pueden ser revocados si es necesario." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Aprobar un certificado pendiente</h3>
            <Steps items={[
              "En la tabla 'Pendientes de aprobación', identificar al estudiante.",
              "Hacer clic en '✓ Aprobar y emitir'.",
              "El sistema generará el PDF del certificado automáticamente y lo enviará al estudiante por email.",
              "El certificado pasará a la tabla de 'Certificados emitidos'.",
            ]} />

            <Tip>
              Los certificados emitidos tienen un código único de verificación pública. Los estudiantes
              pueden compartir el link de verificación para demostrar la acreditación.
            </Tip>

            <Warning>
              Revocar un certificado no lo elimina del sistema, solo lo marca como inválido.
              El estudiante recibirá un estado &quot;Revocado&quot; si intenta verificarlo.
            </Warning>
          </section>

          {/* ══ 8. REVISAR EXÁMENES ══════════════════════════════ */}
          <section>
            <SectionHeader
              id="review"
              icon={ClipboardCheck}
              title="Revisar Exámenes"
              subtitle="Revisión manual de exámenes finales enviados por estudiantes"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Cuando un estudiante envía un examen final que contiene preguntas escritas o de subida de
              archivo, aparecerá aquí para revisión. Los exámenes de opción múltiple con corrección
              automática también pasan por aquí si están marcados como &quot;Final&quot;.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Proceso de revisión</h3>
            <Steps items={[
              "Ir a 'Revisar Exámenes' en el menú lateral.",
              "Cada tarjeta muestra el nombre del estudiante, curso, test y fecha de entrega.",
              "Hacer clic en 'Ver respuestas' para expandir todas las preguntas y respuestas.",
              "Revisar los textos escritos y archivos adjuntos (enlaces a los archivos subidos).",
              "Si el examen aprueba: hacer clic en 'Aprobar'. El certificado se genera y envía automáticamente.",
              "Si requiere corrección: hacer clic en 'Solicitar revisión' para devolverlo al estudiante.",
            ]} />

            <Warning>
              Al aprobar un examen, el certificado se genera con Puppeteer y se sube a R2. Si hay
              un error de conexión o configuración, recibirás un mensaje de error. En ese caso,
              podés intentarlo de nuevo desde la sección Certificados.
            </Warning>
          </section>

          {/* ══ 9. LINKS DE PAGO ══════════════════════════════════ */}
          <section>
            <SectionHeader
              id="paylinks"
              icon={Link2}
              title="Links de Pago"
              subtitle="Creá links de pago personalizados para cobros fuera de la agenda"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Los links de pago permiten cobrar montos específicos a clientes sin necesidad de crear
              un servicio o cita. Ideal para depósitos, presupuestos especiales o ventas puntuales.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Crear un link de pago</h3>
            <Steps items={[
              "Ir a 'Links de pago' en el menú lateral.",
              "Completar: título descriptivo, email del cliente (opcional), descripción y monto base en EUR.",
              "El sistema calcula automáticamente el total con comisiones incluidas.",
              "Hacer clic en Crear. El link aparecerá en la lista.",
              "Copiar el link con el ícono de copiado y enviárselo al cliente.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Estados del pago</h3>
            <Card>
              <Field label="REQUIRES_PAYMENT" desc="El link está activo y esperando que el cliente pague." />
              <Field label="PROCESSING"       desc="El pago está siendo procesado por Stripe." />
              <Field label="PAID"             desc="El pago fue completado exitosamente." />
              <Field label="FAILED"           desc="El intento de pago falló." />
              <Field label="CANCELED"         desc="El link fue cancelado manualmente." />
              <Field label="EXPIRED"          desc="El link expiró sin que se realizara el pago." />
            </Card>

            <Warning>
              Solo se pueden eliminar links que no estén en estado PAID. Los links pagados quedan
              como registro histórico.
            </Warning>
          </section>

          {/* ══ 10. ANTES Y DESPUÉS ═══════════════════════════════ */}
          <section>
            <SectionHeader
              id="beforeafter"
              icon={Images}
              title="Antes y Después"
              subtitle="Gestión de la galería de transformaciones del sitio público"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Las imágenes de Antes y Después se muestran en la sección de resultados de la página
              pública del negocio. Sirven para mostrar el trabajo realizado y generar confianza.
            </p>
            <Steps items={[
              "Ir a 'Antes y Después' en el menú lateral.",
              "Subir el par de imágenes: imagen 'Antes' e imagen 'Después'.",
              "Opcionalmente agregar una descripción o título.",
              "El orden de las imágenes en la galería puede ser modificado.",
              "Eliminar pares que ya no sean relevantes con el botón de eliminar.",
            ]} />
            <Tip>
              Usá imágenes de la misma proporción (ideal 4:3 o 1:1) para que la galería se vea
              uniforme.
            </Tip>
          </section>

          {/* ══ 11. FAQ ═══════════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="faq"
              icon={HelpCircle}
              title="FAQ — Preguntas Frecuentes"
              subtitle="Administración del contenido FAQ del sitio público"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              El FAQ aparece en la página principal del sitio. Responde dudas comunes de los clientes
              sobre servicios, precios, turnos y políticas del negocio.
            </p>
            <Steps items={[
              "Ir a FAQ en el menú lateral.",
              "Hacer clic en '+ Nueva pregunta'.",
              "Ingresar la pregunta y su respuesta.",
              "Guardar. La pregunta aparecerá en el sitio público inmediatamente.",
              "Para editar, hacer clic sobre el elemento. Para eliminar, usar el ícono de papelera.",
              "Podés reordenar las preguntas arrastrando para priorizar las más importantes.",
            ]} />
          </section>

          {/* ══ 12. USUARIOS ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="users"
              icon={UserCog}
              title="Usuarios"
              subtitle="Administración de todos los usuarios registrados"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              En esta sección podés ver todos los usuarios de la plataforma, buscarlos, filtrarlos
              por rol y cambiar sus permisos.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Roles disponibles</h3>
            <Card>
              <Field label="ADMIN"   desc="Acceso total a todos los módulos de administración." />
              <Field label="STAFF"   desc="Acceso solo a sus citas, clientes y links de pago propios." />
              <Field label="STUDENT" desc="Acceso a la academia (cursos comprados) y la comunidad." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Cambiar el rol de un usuario</h3>
            <Steps items={[
              "Buscar al usuario por nombre o email.",
              "Filtrar por rol si es necesario con el selector de la parte superior.",
              "Hacer clic en el menú de rol y seleccionar el nuevo rol.",
              "Confirmar el cambio. El usuario tendrá el nuevo acceso en su próxima sesión.",
            ]} />

            <Warning>
              Cambiar a un estudiante a STAFF le otorga acceso al panel de administración (área de staff).
              Cambiar a ADMIN le da acceso completo. Hacerlo solo con personas de confianza.
            </Warning>
          </section>

          {/* ══ 13. SETTINGS ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="settings"
              icon={Settings}
              title="Settings — Comisiones de Stripe"
              subtitle="Configuración del sistema de precios y comisiones"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              En Settings configurás el porcentaje y monto fijo que Stripe cobra por cada transacción.
              Estos valores se suman automáticamente al precio base en todos los formularios de pago.
            </p>
            <Card>
              <Field label="Porcentaje (%)"   desc="Ejemplo: 2.9 para el 2,9% de comisión de Stripe." />
              <Field label="Monto fijo (¢)"   desc="Ejemplo: 30 para los 0,30 EUR/USD fijos por transacción." />
              <Field label="Moneda por defecto" desc="Moneda predeterminada para nuevas transacciones (EUR o USD)." />
            </Card>
            <p className="text-sm text-white/60">
              Fórmula aplicada: <code className="bg-white/10 px-1.5 py-0.5 rounded text-ap-copper text-xs">
                Total = Base + (Base × % / 100) + fijo
              </code>
            </p>
            <Warning>
              Cambiar estos valores afecta el precio mostrado en todos los formularios de pago activos.
              Hacerlo antes de lanzar nuevos servicios o al actualizar el contrato con Stripe.
            </Warning>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t border-white/10 text-center">
            <p className="text-xs text-white/30">
              Manual del Administrador · Apoteósicas by Elizabeth Rizos
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
