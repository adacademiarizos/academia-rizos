import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import {
  BookOpen, ShieldCheck, Users, ChevronRight,
  LayoutDashboard, Scissors, CalendarDays, GraduationCap,
  FileCheck, Link2, Images, HelpCircle, Clock,
  CalendarRange, ClipboardCheck,
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

const ADMIN_SECTIONS = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Scissors,        label: "Servicios" },
  { icon: Users,           label: "Staff y Precios" },
  { icon: CalendarDays,    label: "Citas" },
  { icon: Clock,           label: "Horarios" },
  { icon: GraduationCap,   label: "Cursos y Academia" },
  { icon: FileCheck,       label: "Certificados" },
  { icon: ClipboardCheck,  label: "Revisar Exámenes" },
  { icon: Link2,           label: "Links de Pago" },
  { icon: Images,          label: "Antes y Después" },
  { icon: HelpCircle,      label: "FAQ" },
];

const STAFF_SECTIONS = [
  { icon: CalendarDays,  label: "Mis Citas" },
  { icon: Link2,         label: "Links de Pago" },
  { icon: Users,         label: "Mis Clientes" },
];

export default async function ManualesPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#181716] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-ap-copper/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-ap-copper" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Manuales de Usuario</h1>
              <p className="text-sm text-white/40">Documentación completa de la plataforma</p>
            </div>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Accedé a los manuales detallados para cada rol. Como administrador podés
            consultar ambos documentos.
          </p>
        </div>

        {/* Manual cards */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Admin manual card */}
          <Link
            href="/admin/manual"
            className="group rounded-2xl border border-white/10 bg-white/3 hover:bg-white/6 hover:border-ap-copper/30 transition-all duration-200 p-6 flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-ap-copper/15 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-ap-copper" />
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-ap-copper group-hover:translate-x-0.5 transition-all mt-1" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-1">Manual del Administrador</h2>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
              Guía completa de todos los módulos de administración: servicios, citas,
              cursos, certificados, usuarios y configuración del sistema.
            </p>

            <div className="mt-auto">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
                Secciones incluidas
              </p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECTIONS.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs text-white/50 bg-white/5 border border-white/8 rounded-lg px-2 py-1"
                  >
                    <Icon className="w-3 h-3 text-ap-copper/70 shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/8">
              <span className="text-xs font-semibold text-ap-copper group-hover:underline">
                Ver manual completo →
              </span>
            </div>
          </Link>

          {/* Staff manual card */}
          <Link
            href="/staff/manual"
            className="group rounded-2xl border border-white/10 bg-white/3 hover:bg-white/6 hover:border-ap-copper/30 transition-all duration-200 p-6 flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center">
                <Users className="w-6 h-6 text-white/60" />
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-ap-copper group-hover:translate-x-0.5 transition-all mt-1" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-1">Manual del Staff</h2>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
              Guía para los profesionales del equipo: gestión de citas asignadas,
              links de pago personalizados e historial de clientes.
            </p>

            <div className="mt-auto">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
                Secciones incluidas
              </p>
              <div className="flex flex-wrap gap-2">
                {STAFF_SECTIONS.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs text-white/50 bg-white/5 border border-white/8 rounded-lg px-2 py-1"
                  >
                    <Icon className="w-3 h-3 text-white/40 shrink-0" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/8">
              <span className="text-xs font-semibold text-ap-copper group-hover:underline">
                Ver manual completo →
              </span>
            </div>
          </Link>

        </div>

        {/* Footer note */}
        <p className="text-xs text-white/25 text-center mt-10">
          Los manuales son de solo lectura · Apoteósicas by Elizabeth Rizos
        </p>
      </div>
    </main>
  );
}
