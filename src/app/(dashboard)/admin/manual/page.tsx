import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  LayoutDashboard,
  LayoutTemplate,
  GraduationCap,
  FileCheck,
  ClipboardCheck,
  UserCog,
  MessageSquare,
  BarChart3,
  Settings,
  BookOpen,
  Bug,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import { ManualPrintButton } from "@/app/(dashboard)/components/manuals/ManualPrintButton";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") redirect("/");
}

function SectionHeader({
  id,
  icon: Icon,
  title,
  subtitle,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div id={id} className="scroll-mt-6 mb-5 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ap-copper/20">
        <Icon className="h-4 w-4 text-ap-copper" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="manual-print-card rounded-2xl border border-white/10 bg-white/5 p-5">{children}</div>;
}

function Field({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-2 last:border-b-0">
      <span className="w-44 shrink-0 text-sm font-semibold text-ap-copper">{label}</span>
      <span className="text-sm text-white/70">{desc}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-ap-copper/25 bg-ap-copper/10 px-4 py-3">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ap-copper" />
      <p className="text-sm text-white/75">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <p className="text-sm text-white/75">{children}</p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="my-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ap-copper/20 text-xs font-bold text-ap-copper">
            {i + 1}
          </span>
          <span className="text-sm text-white/75">{item}</span>
        </li>
      ))}
    </ol>
  );
}

const TOC = [
  { id: "quickstart", label: "Inicio rapido", icon: BookOpen },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "landing", label: "Landing", icon: LayoutTemplate },
  { id: "courses", label: "Cursos", icon: GraduationCap },
  { id: "certificates", label: "Certificados", icon: FileCheck },
  { id: "review", label: "Revision examenes", icon: ClipboardCheck },
  { id: "users", label: "Usuarios", icon: UserCog },
  { id: "community", label: "Comunidad", icon: MessageSquare },
  { id: "analytics", label: "Analiticas", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "support", label: "Manuales y reportes", icon: Bug },
];

export default async function AdminManualPage() {
  await requireAdmin();

  return (
    <main className="manual-page min-h-screen bg-[#181716] text-white">
      <div className="manual-shell mx-auto flex max-w-7xl gap-8 px-6 py-10">
        <aside className="manual-print-hide hidden w-56 shrink-0 xl:block">
          <div className="sticky top-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Contenido</p>
            <nav className="space-y-1">
              {TOC.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/55 transition hover:bg-white/8 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-ap-copper/70" />
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="manual-content min-w-0 flex-1 space-y-10">
          <header className="manual-print-card rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-ap-copper" />
                  <h1 className="text-2xl font-semibold text-white">Manual del Administrador</h1>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Guia actualizada para operar el panel admin segun la estructura real del proyecto.
                </p>
                <p className="mt-1 text-xs text-white/35">Actualizado: Agosto 2026</p>
              </div>
              <div className="manual-print-hide">
                <ManualPrintButton />
              </div>
            </div>
          </header>

          <section className="manual-print-section">
            <SectionHeader
              id="quickstart"
              icon={BookOpen}
              title="Inicio rapido"
              subtitle="Que incluye hoy el panel admin y que esta fuera del menu principal"
            />
            <Card>
              <Field label="Menu principal admin" desc="Overview, Landing, Cursos, Usuarios, Analiticas y Settings." />
              <Field label="Cursos (tabs)" desc="Cursos, Certificados y Revision de examenes en una sola seccion." />
              <Field label="Usuarios (tabs)" desc="Usuarios y Comunidad dentro de la misma seccion." />
              <Field label="Settings" desc="Comisiones Stripe + accesos rapidos a Manuales y Reportes." />
              <Field label="Notificaciones" desc="Disponible en sidebar para todos los roles." />
            </Card>
            <Warning>
              En esta version, citas y pagos no estan en el menu principal admin. El enfoque activo del dashboard es
              Website + Academia.
            </Warning>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="overview"
              icon={LayoutDashboard}
              title="Overview"
              subtitle="Vista ejecutiva con KPIs de website y academia"
            />
            <p className="text-sm leading-relaxed text-white/70">
              Overview resume los resultados de Website + Academia. Es la pantalla para decidir en menos de un minuto
              si conviene profundizar en adquisición, conversión, un curso o una revisión pendiente.
            </p>
            <Card>
              <Field label="Periodo" desc="30 días por defecto; puedes usar 7, 90 días o ajustar las dos fechas. La comparación siempre usa el período anterior equivalente." />
              <Field label="Resultado" desc="Facturación de cursos por moneda, compras confirmadas, conversión a compra y alumnos activos." />
              <Field label="Recorrido" desc="Sesiones → vistas de curso → compras. Cada bloque enlaza a su vista de detalle conservando el período." />
              <Field label="Salud" desc="Retención madura, progreso, tiempo a certificación y cursos con más compras." />
            </Card>
            <Tip>
              La facturación del overview solo incluye pagos de cursos ya confirmados. Si hay más de una moneda, los
              importes se muestran separados y no se suman artificialmente.
            </Tip>
            <Warning>
              Citas, pagos de salón y links de pago no se muestran en este overview. Para fuentes, campañas,
              dispositivos o páginas, usa Analíticas.
            </Warning>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="landing"
              icon={LayoutTemplate}
              title="Landing"
              subtitle="Edicion del contenido publico por tabs"
            />
            <Card>
              <Field label="Servicios (Booksy)" desc="Vista de servicios externos consumidos desde JSON local con enlaces directos a Booksy." />
              <Field label="Sobre Fundadora" desc="Editor completo de textos, CTAs e imagen (subida directa, no URL manual)." />
              <Field label="Resultados" desc="Carga y elimina imagenes de resultados para la galeria publica." />
              <Field label="Testimonios" desc="Gestion separada para Salon y Academia: alta, edicion, orden, activacion y avatar." />
              <Field label="FAQ" desc="Alta/edicion/borrado de preguntas frecuentes publicas." />
              <Field label="Horarios" desc="Horario semanal + dias no laborables (off-days)." />
            </Card>
            <Steps
              items={[
                "Abrir Landing y seleccionar la tab correcta.",
                "Aplicar cambios de contenido.",
                "Guardar en el modulo correspondiente.",
                "Verificar en la web publica el resultado final.",
              ]}
            />
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="courses"
              icon={GraduationCap}
              title="Cursos (tab principal)"
              subtitle="Gestion del catalogo y estructura academica"
            />
            <Card>
              <Field label="Alta de curso" desc="Titulo, descripcion, precio base, acceso por dias (opcional) y miniatura obligatoria por upload." />
              <Field label="Estado" desc="Activa/desactiva visibilidad del curso para estudiantes." />
              <Field label="Edicion interna" desc="Desde cada curso puedes administrar modulos, lecciones, tests y recursos." />
              <Field label="Notificar" desc="Boton para notificar estudiantes inscritos sobre cambios del curso." />
            </Card>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="certificates"
              icon={FileCheck}
              title="Cursos - Certificados"
              subtitle="Listado de certificados emitidos y pendientes"
            />
            <Card>
              <Field label="Pendientes" desc="Casos que requieren aprobacion manual para emitir certificado." />
              <Field label="Emitidos" desc="Listado historico con descarga de PDF y estado (valido/revocado)." />
              <Field label="Accion rapida" desc="Desde aqui puedes saltar a Revision de examenes." />
            </Card>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="review"
              icon={ClipboardCheck}
              title="Cursos - Revision de examenes"
              subtitle="Aprobacion o solicitud de correccion de entregas finales"
            />
            <Steps
              items={[
                "Entrar a Cursos - Revision de examenes.",
                "Abrir respuestas y evidencias del estudiante.",
                "Elegir Aprobar o Solicitar revision.",
                "Al aprobar, el flujo de certificado se ejecuta automaticamente.",
              ]}
            />
            <Warning>
              Si la entrega incluye archivos, revisa el contenido antes de aprobar. Esta accion impacta certificacion.
            </Warning>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="users"
              icon={UserCog}
              title="Usuarios (tab Usuarios)"
              subtitle="Busqueda, filtro por rol y paginacion"
            />
            <Card>
              <Field label="Filtros" desc="Busqueda por nombre/email y filtro por rol." />
              <Field label="Paginacion" desc="Bloques de 5, 10, 25, 50 o 100 usuarios por pagina." />
              <Field label="Cambio de rol" desc="Botones para mover usuarios a STUDENT, STAFF o ADMIN." />
              <Field label="Bloqueo de seguridad" desc="No puedes cambiar tu propio rol desde el panel." />
            </Card>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="community"
              icon={MessageSquare}
              title="Usuarios - Comunidad"
              subtitle="Chat general integrado en admin"
            />
            <p className="text-sm leading-relaxed text-white/70">
              La comunidad ahora esta agrupada dentro de Usuarios. Desde esta tab accedes al chat general para dar
              soporte, responder dudas y monitorear actividad social.
            </p>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="analytics"
              icon={BarChart3}
              title="Analiticas"
              subtitle="Analisis de marketing y conversion por tabs"
            />
            <Card>
              <Field label="Tabs disponibles" desc="Overview, Trafico, Campanas, Conversiones, Cursos y Audiencia." />
              <Field label="Rango de fechas" desc="Puedes ajustar periodo para evaluar tendencias y comparar decisiones." />
              <Field label="Uso recomendado" desc="Cruzar comportamiento web con rendimiento academico para priorizar mejoras." />
            </Card>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="settings"
              icon={Settings}
              title="Settings"
              subtitle="Configuracion global de comisiones y accesos"
            />
            <Card>
              <Field label="feePercent" desc="Porcentaje de comision Stripe aplicado sobre el precio base." />
              <Field label="feeFixedCents" desc="Cargo fijo por transaccion en centavos." />
              <Field label="defaultCurrency" desc="Moneda por defecto del sistema." />
            </Card>
            <Tip>
              Formula activa: Total cliente = Base + (Base x feePercent/100) + feeFixed.
            </Tip>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="support"
              icon={Bug}
              title="Manuales y reportes"
              subtitle="Documentacion y canal de incidencias"
            />
            <Card>
              <Field label="Manuales" desc="Acceso desde Settings - Manuales para abrir manual admin y manual staff." />
              <Field label="Reportes" desc="Acceso desde Settings - Reportes para crear bug reports con imagenes." />
              <Field label="Impresion" desc="Usa el boton Imprimir manual para sacar copia fisica o guardar PDF." />
            </Card>
            <Steps
              items={[
                "Abrir el manual que necesitas.",
                "Hacer clic en Imprimir manual.",
                "Elegir impresora fisica o Guardar como PDF.",
                "Confirmar impresion.",
              ]}
            />
          </section>

          <footer className="border-t border-white/10 pt-6 text-center text-xs text-white/35">
            Manual del Administrador - Apoteosicas by Elizabeth Rizos
          </footer>
        </div>
      </div>
    </main>
  );
}
