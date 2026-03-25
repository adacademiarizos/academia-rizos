import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import {
  BookOpen,
  ShieldCheck,
  Users,
  ChevronRight,
  LayoutDashboard,
  LayoutTemplate,
  GraduationCap,
  UserCog,
  BarChart3,
  Settings,
  CalendarDays,
  Link2,
  MessageSquare,
  Bug,
  Printer,
} from "lucide-react";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") redirect("/");
}

const ADMIN_SECTIONS = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: LayoutTemplate, label: "Landing" },
  { icon: GraduationCap, label: "Cursos + Certificados + Revision" },
  { icon: UserCog, label: "Usuarios + Comunidad" },
  { icon: BarChart3, label: "Analiticas" },
  { icon: Settings, label: "Settings" },
];

const STAFF_SECTIONS = [
  { icon: CalendarDays, label: "Mis Citas" },
  { icon: Link2, label: "Links de Pago" },
  { icon: Users, label: "Mis Clientes" },
  { icon: MessageSquare, label: "Comunidad" },
  { icon: Bug, label: "Reportar Bug" },
];

export default async function ManualesPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#181716] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ap-copper/20">
              <BookOpen className="h-5 w-5 text-ap-copper" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Manuales de Usuario</h1>
              <p className="text-sm text-white/50">Documentacion operativa de la plataforma</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-ap-copper/25 bg-ap-copper/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-white/80">
              <Printer className="h-4 w-4 text-ap-copper" />
              Cada manual incluye boton <strong>Imprimir manual</strong> para imprimir o guardar en PDF.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/admin/manual"
            className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-ap-copper/30 hover:bg-white/10"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ap-copper/15">
                <ShieldCheck className="h-6 w-6 text-ap-copper" />
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-ap-copper" />
            </div>

            <h2 className="text-lg font-semibold text-white">Manual del Administrador</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              Guia completa del panel admin actual: website, academia, analiticas, usuarios y configuracion.
            </p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">Secciones clave</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_SECTIONS.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60"
                  >
                    <Icon className="h-3 w-3 text-ap-copper/70" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </Link>

          <Link
            href="/staff/manual"
            className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-ap-copper/30 hover:bg-white/10"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Users className="h-6 w-6 text-white/70" />
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-ap-copper" />
            </div>

            <h2 className="text-lg font-semibold text-white">Manual del Staff</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              Guia operativa para profesionales del equipo: citas, cobros, clientes, comunidad y soporte.
            </p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">Secciones clave</p>
              <div className="flex flex-wrap gap-2">
                {STAFF_SECTIONS.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60"
                  >
                    <Icon className="h-3 w-3 text-white/45" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          Manuales en modo solo lectura - Apoteosicas by Elizabeth Rizos
        </p>
      </div>
    </main>
  );
}
