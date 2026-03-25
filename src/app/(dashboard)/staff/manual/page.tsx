import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  CalendarDays,
  Link2,
  Users,
  MessageSquare,
  Bug,
  BookOpen,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import { ManualPrintButton } from "@/app/(dashboard)/components/manuals/ManualPrintButton";

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN")) redirect("/");
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
      <span className="w-40 shrink-0 text-sm font-semibold text-ap-copper">{label}</span>
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
  { id: "appointments", label: "Mis citas", icon: CalendarDays },
  { id: "paylinks", label: "Links de pago", icon: Link2 },
  { id: "clients", label: "Mis clientes", icon: Users },
  { id: "community", label: "Comunidad", icon: MessageSquare },
  { id: "bugreport", label: "Reportar bug", icon: Bug },
];

export default async function StaffManualPage() {
  await requireStaff();

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
                  <h1 className="text-2xl font-semibold text-white">Manual del Staff</h1>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Guia practica para trabajar con citas, cobros, clientes y soporte desde tu panel.
                </p>
                <p className="mt-1 text-xs text-white/35">Actualizado: Marzo 2026</p>
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
              subtitle="Que herramientas tienes en rol staff"
            />
            <Card>
              <Field label="Mis citas" desc="Ver citas asignadas, filtrar por estado y revisar datos del cliente." />
              <Field label="Links de pago" desc="Crear links para cobros puntuales con total calculado." />
              <Field label="Mis clientes" desc="Historial de clientes atendidos y resumen de ingresos." />
              <Field label="Comunidad" desc="Acceso al chat general para colaborar con equipo y comunidad." />
              <Field label="Reportar bug" desc="Formulario para reportar incidencias con capturas." />
            </Card>
            <Tip>
              El panel staff solo muestra datos relacionados a tu cuenta. No ves ni editas informacion interna de otros
              profesionales.
            </Tip>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="appointments"
              icon={CalendarDays}
              title="Mis citas"
              subtitle="Gestion y seguimiento de reservas asignadas"
            />
            <Steps
              items={[
                "Entrar a Mis citas.",
                "Usar filtro de vista: Proximas o Todas.",
                "Filtrar por estado cuando necesites una lista puntual.",
                "Abrir cada tarjeta para revisar servicio, cliente, pago y notas.",
              ]}
            />
            <Card>
              <Field label="Filtros" desc="Estado + toggle de proximas/todas." />
              <Field label="Datos de cita" desc="Fecha/hora, duracion, servicio, cliente, monto y estado de pago." />
              <Field label="Notas" desc="Si el cliente dejo notas, se muestran dentro de la tarjeta." />
            </Card>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="paylinks"
              icon={Link2}
              title="Links de pago"
              subtitle="Cobros directos por enlace"
            />
            <Steps
              items={[
                "Entrar a Links de pago y hacer clic en Nuevo link.",
                "Completar titulo, email (opcional), descripcion y monto base.",
                "Confirmar vista previa del total que paga el cliente.",
                "Crear el link, copiarlo y enviarlo por tu canal habitual.",
              ]}
            />
            <Card>
              <Field label="Estados" desc="Pending/Processing/Paid/Failed/Canceled segun el avance del cobro." />
              <Field label="Copiar enlace" desc="Boton rapido para copiar URL al portapapeles." />
              <Field label="Ver pagina" desc="Abre la URL publica para validar antes de enviar." />
            </Card>
            <Warning>
              Verifica siempre monto y descripcion antes de compartir el enlace. El cliente usara exactamente esos
              datos para pagar.
            </Warning>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="clients"
              icon={Users}
              title="Mis clientes"
              subtitle="Historial y contexto de personas atendidas"
            />
            <Card>
              <Field label="KPIs visibles" desc="Total clientes, total citas e ingresos totales." />
              <Field label="Busqueda" desc="Filtro por nombre o email para encontrar rapido." />
              <Field label="Detalle expandible" desc="Cada cliente muestra historial de citas, estados y montos pagados." />
            </Card>
            <Tip>
              Usa esta vista antes de una cita para recordar frecuencia de visita y servicios previos del cliente.
            </Tip>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="community"
              icon={MessageSquare}
              title="Comunidad"
              subtitle="Chat colaborativo"
            />
            <p className="text-sm leading-relaxed text-white/70">
              Comunidad es un espacio compartido para comunicacion interna y soporte general. Mantener contexto ahi
              ayuda a resolver dudas rapido y centralizar informacion.
            </p>
          </section>

          <section className="manual-print-section">
            <SectionHeader
              id="bugreport"
              icon={Bug}
              title="Reportar bug"
              subtitle="Canal oficial de incidencias"
            />
            <Steps
              items={[
                "Entrar a Reportar bug.",
                "Seleccionar tipo: Contenido o Funcionalidad.",
                "Escribir titulo y descripcion con pasos para reproducir.",
                "Adjuntar capturas si aplica y enviar.",
              ]}
            />
            <Tip>
              Un reporte con pasos claros y evidencia visual se resuelve mucho mas rapido.
            </Tip>
          </section>

          <footer className="border-t border-white/10 pt-6 text-center text-xs text-white/35">
            Manual del Staff - Apoteosicas by Elizabeth Rizos
          </footer>
        </div>
      </div>
    </main>
  );
}
