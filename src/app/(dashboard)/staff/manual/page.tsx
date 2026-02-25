import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  CalendarDays, Link2, Users, MessageSquare, Bug,
  BookOpen, ChevronRight, Lightbulb, AlertCircle, CheckCircle2,
} from "lucide-react";

async function requireStaff() {
  const session = await getServerSession();
  if (!session?.user?.email) redirect("/signin");
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN")) redirect("/");
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
  { id: "overview",       label: "Introducción",     icon: BookOpen },
  { id: "appointments",   label: "Mis Citas",        icon: CalendarDays },
  { id: "paylinks",       label: "Links de Pago",    icon: Link2 },
  { id: "clients",        label: "Mis Clientes",     icon: Users },
  { id: "community",      label: "Comunidad",        icon: MessageSquare },
  { id: "bugreport",      label: "Reportar Bug",     icon: Bug },
];

export default async function StaffManualPage() {
  await requireStaff();

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
                <h1 className="text-2xl font-semibold text-white">Manual del Staff</h1>
                <p className="text-sm text-white/40">Guía de las herramientas disponibles para el equipo</p>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Este manual cubre todas las funciones disponibles para el rol de <strong className="text-ap-copper">Staff</strong>.
              Usá el índice de la izquierda para navegar entre secciones.
            </p>
          </div>

          {/* ══ 1. OVERVIEW ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="overview"
              icon={BookOpen}
              title="Introducción al Panel de Staff"
              subtitle="Qué podés hacer desde tu panel"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Como miembro del equipo, tenés acceso a las herramientas que necesitás para atender
              a tus clientes: gestionar tus citas asignadas, crear links de pago personalizados
              y revisar el historial de tus clientes.
            </p>
            <Card>
              <Field label="Mis Citas"      desc="Ver todas las citas que te fueron asignadas, filtrar por estado y fecha." />
              <Field label="Links de Pago"  desc="Crear links de pago para cobrar montos específicos a clientes." />
              <Field label="Mis Clientes"   desc="Historial de todos los clientes que han reservado contigo." />
              <Field label="Comunidad"      desc="Acceso al espacio de comunidad de la plataforma." />
              <Field label="Reportar Bug"   desc="Reportar problemas o errores en la plataforma." />
            </Card>
            <Tip>
              Solo podés ver las citas y clientes asignados a tu perfil. No tenés acceso
              a la información de otros profesionales del equipo.
            </Tip>
          </section>

          {/* ══ 2. MIS CITAS ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="appointments"
              icon={CalendarDays}
              title="Mis Citas"
              subtitle="Seguimiento de todas las reservas asignadas a tu perfil"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              En esta sección encontrás todas las citas que los clientes reservaron contigo.
              Podés filtrar para ver solo las próximas o explorar el historial completo.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Filtros disponibles</h3>
            <Card>
              <Field label="Próximas / Todas" desc="Alterná entre ver solo citas futuras (por defecto) o todo el historial." />
              <Field label="Estado"           desc="Filtrá por: Pendiente, Confirmada, Completada, Cancelada o No-show." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Información de cada cita</h3>
            <Card>
              <Field label="Fecha y hora"    desc="Día y horario exacto de la cita, formateado en español." />
              <Field label="Servicio"        desc="Nombre del tratamiento reservado y su duración en minutos." />
              <Field label="Cliente"         desc="Nombre y email del cliente que realizó la reserva." />
              <Field label="Pago"            desc="Monto abonado (en EUR) y estado del pago." />
              <Field label="Estado"          desc="Estado actual de la cita con badge de color." />
              <Field label="Notas"           desc="Observaciones adicionales que el cliente dejó al reservar (si las hay)." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Estados de una cita</h3>
            <Card>
              <Field label="Pendiente"   desc="La cita fue reservada pero aún no fue confirmada." />
              <Field label="Confirmada"  desc="La cita está confirmada y agendada." />
              <Field label="Completada"  desc="El servicio fue realizado exitosamente." />
              <Field label="Cancelada"   desc="La cita fue cancelada por el cliente o el equipo." />
              <Field label="No-show"     desc="El cliente no se presentó a la cita." />
            </Card>

            <Tip>
              Si necesitás cambiar el estado de una cita (confirmar, completar, cancelar),
              contactá al administrador ya que los cambios de estado son gestionados desde
              el panel de administración.
            </Tip>
          </section>

          {/* ══ 3. LINKS DE PAGO ══════════════════════════════════ */}
          <section>
            <SectionHeader
              id="paylinks"
              icon={Link2}
              title="Links de Pago"
              subtitle="Creá links de pago personalizados para tus clientes"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Los links de pago te permiten cobrar montos específicos a clientes sin necesidad de
              crear una cita. Ideal para cobrar depósitos, servicios adicionales o presupuestos especiales.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Crear un link de pago</h3>
            <Steps items={[
              "Ir a 'Links de pago' en el menú lateral.",
              "Completar el formulario: título descriptivo, email del cliente (opcional), descripción y monto base en EUR.",
              "El sistema calcula automáticamente el total incluyendo las comisiones de Stripe.",
              "Hacer clic en Crear. El link aparecerá en tu lista.",
              "Copiar el link con el ícono de copiado y enviárselo al cliente por el medio que prefieras.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Estados del pago</h3>
            <Card>
              <Field label="REQUIRES_PAYMENT" desc="El link está activo y esperando que el cliente realice el pago." />
              <Field label="PROCESSING"       desc="El pago está siendo procesado por Stripe." />
              <Field label="PAID"             desc="El pago fue completado exitosamente." />
              <Field label="FAILED"           desc="El intento de pago falló. El cliente puede intentarlo de nuevo." />
              <Field label="CANCELED"         desc="El link fue cancelado manualmente." />
              <Field label="EXPIRED"          desc="El link expiró sin que se realizara el pago." />
            </Card>

            <Tip>
              Podés ver el historial completo de todos tus links con su estado actual.
              Los links pagados quedan como registro y no pueden eliminarse.
            </Tip>

            <Warning>
              Los links que creás son de tu autoría. Si necesitás transferir o cancelar
              un link de otro miembro del equipo, contactá al administrador.
            </Warning>
          </section>

          {/* ══ 4. MIS CLIENTES ═══════════════════════════════════ */}
          <section>
            <SectionHeader
              id="clients"
              icon={Users}
              title="Mis Clientes"
              subtitle="Historial y estadísticas de los clientes que atendiste"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Esta sección centraliza toda la información de los clientes que han reservado
              contigo al menos una vez. Podés ver estadísticas generales y el historial
              detallado de cada cliente.
            </p>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Resumen de tu actividad</h3>
            <Card>
              <Field label="Total de clientes"   desc="Cantidad total de clientes únicos que han reservado contigo." />
              <Field label="Total de citas"      desc="Número total de citas (en todos los estados) asignadas a tu perfil." />
              <Field label="Total de ingresos"   desc="Suma total de pagos completados de todas tus citas (en EUR)." />
            </Card>

            <h3 className="text-sm font-semibold text-white/80 mb-2">Buscar y explorar clientes</h3>
            <Steps items={[
              "Usar el campo de búsqueda para filtrar por nombre o email del cliente.",
              "Hacer clic en un cliente para expandir su historial completo.",
              "Ver todas las citas pasadas con fechas, servicios y montos pagados.",
            ]} />

            <h3 className="text-sm font-semibold text-white/80 mb-2 mt-4">Información por cliente</h3>
            <Card>
              <Field label="Nombre y email"  desc="Datos de contacto del cliente." />
              <Field label="Total de citas"  desc="Cuántas veces ha reservado contigo." />
              <Field label="Total pagado"    desc="Suma de todos los pagos completados de ese cliente." />
              <Field label="Última cita"     desc="Fecha de la cita más reciente." />
              <Field label="Historial"       desc="Al expandir: lista de todas las citas con fecha, servicio y estado." />
            </Card>

            <Tip>
              El historial de clientes se actualiza automáticamente cuando se registran
              nuevas citas o pagos. No necesitás hacer nada manualmente.
            </Tip>
          </section>

          {/* ══ 5. COMUNIDAD ══════════════════════════════════════ */}
          <section>
            <SectionHeader
              id="community"
              icon={MessageSquare}
              title="Comunidad"
              subtitle="Espacio de interacción con estudiantes y el equipo"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              La sección de Comunidad es un espacio compartido donde podés interactuar con
              los estudiantes de la academia y otros miembros del equipo.
            </p>
            <Tip>
              La Comunidad es accesible para todos los roles: Admin, Staff y Student.
              Podés ver publicaciones, responder preguntas y participar activamente.
            </Tip>
          </section>

          {/* ══ 6. REPORTAR BUG ══════════════════════════════════ */}
          <section>
            <SectionHeader
              id="bugreport"
              icon={Bug}
              title="Reportar Bug"
              subtitle="Cómo informar errores o problemas en la plataforma"
            />
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Si encontrás algún error, comportamiento inesperado o problema en la plataforma,
              podés reportarlo directamente desde el panel.
            </p>
            <Steps items={[
              "Ir a 'Reportar Bug' en el menú lateral.",
              "Seleccionar el tipo de problema: 'Contenido' (texto incorrecto, imágenes rotas) o 'Funcionalidad' (algo no funciona como debería).",
              "Describir el problema con el mayor detalle posible: qué estabas haciendo, qué esperabas que pasara, qué pasó en realidad.",
              "Enviar el reporte. El equipo de administración lo recibirá y analizará.",
            ]} />
            <Tip>
              Cuanto más detallada sea la descripción, más fácil es reproducir y corregir el error.
              Incluir los pasos exactos para reproducirlo es muy útil.
            </Tip>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t border-white/10 text-center">
            <p className="text-xs text-white/30">
              Manual del Staff · Apoteósicas by Elizabeth Rizos
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
