"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  GraduationCap,
  FileCheck,
  Link2,
  Settings,
  TrendingUp,
  Bell,
  Menu,
  LogOut,
  MessageSquare,
  Bug,
  UserCog,
  Images,
  HelpCircle,
  ClipboardCheck,
  Clock,
  BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import { MobileDrawer } from "./mobile/MobileDrawer";

const ADMIN_NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Servicios", href: "/admin/services", icon: Scissors },
  { label: "Staff", href: "/admin/staff", icon: Users },
  { label: "Citas", href: "/admin/appointments", icon: CalendarDays },
  { label: "Horarios", href: "/admin/schedule", icon: Clock },
  { label: "Cursos", href: "/admin/courses", icon: GraduationCap },
  { label: "Certificados", href: "/admin/certificates", icon: FileCheck },
  { label: "Revisar Exámenes", href: "/admin/certificates/review", icon: ClipboardCheck },
  { label: "Links de pago", href: "/admin/payment-links", icon: Link2 },
  { label: "Antes y Después", href: "/admin/before-after", icon: Images },
  { label: "FAQ", href: "/admin/faq", icon: HelpCircle },
  { label: "Usuarios", href: "/admin/users", icon: UserCog },
  { label: "Comunidad", href: "/community", icon: MessageSquare },
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Reportar Bug", href: "/bug-report", icon: Bug },
  { label: "Manuales", href: "/admin/manuales", icon: BookOpen },
];

const STAFF_NAV = [
  { label: "Mis Citas", href: "/staff/appointments", icon: CalendarDays },
  { label: "Links de pago", href: "/staff/payment-links", icon: Link2 },
  { label: "Mis Clientes", href: "/staff/clients", icon: Users },
  { label: "Comunidad", href: "/community", icon: MessageSquare },
  { label: "Reportar Bug", href: "/bug-report", icon: Bug },
  { label: "Manual", href: "/staff/manual", icon: BookOpen },
];

const STUDENT_NAV = [
  { label: "Mi Dashboard", href: "/student", icon: TrendingUp },
  { label: "Comunidad", href: "/community", icon: MessageSquare },
  { label: "Reportar Bug", href: "/bug-report", icon: Bug },
];

const NAV = [
  ...ADMIN_NAV,
  ...STAFF_NAV,
  ...STUDENT_NAV,
];

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function NotificationsNavItem() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const active = pathname === "/notifications";

  useEffect(() => {
    const load = () =>
      fetch("/api/notifications?limit=1")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.unreadCount || 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link
      href="/notifications"
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200",
        active
          ? "bg-white/15 text-white shadow-lg border border-white/20"
          : "text-white/60 hover:text-white/90 hover:bg-white/8 border border-transparent"
      )}
    >
      <Bell
        className={cn(
          "h-4 w-4 transition",
          active ? "text-white" : "text-white/50 group-hover:text-white/70"
        )}
      />
      <span className="flex-1 font-semibold">Notificaciones</span>
      {unreadCount > 0 && (
        <span className="text-xs bg-ap-copper text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { data: session } = useSession();

  const userRole = (session?.user as any)?.role || "STUDENT";
  const navItems =
    userRole === "ADMIN" ? ADMIN_NAV : userRole === "STAFF" ? STAFF_NAV : STUDENT_NAV;

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image || null;
  const initials = userName[0]?.toUpperCase() ?? "U";

  useEffect(() => { setImgError(false); }, [userImage]);

  return (
    <>
      {/* Mobile hamburger button — fixed top-left, hidden on desktop */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-2.5 text-white hover:bg-white/10 transition"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      <MobileDrawer open={open} setOpen={setOpen} nav={navItems} session={session} />

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-[280px] md:flex-col border-r border-white/5 bg-gradient-to-b from-ap-bg to-black/40 backdrop-blur-3xl">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Dashboard</div>
              <div className="text-xs text-white/50">Apoteósicas</div>
            </div>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="px-3 py-4 flex-1 overflow-y-auto min-h-0 nav-scroll">
          <div className="grid gap-1">
            <NavLinks navItems={navItems} />
            <NotificationsNavItem />
          </div>
        </nav>

        {/* User account section */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            {userImage && !imgError ? (
              <img
                src={userImage}
                alt={userName}
                onError={() => setImgError(true)}
                className="h-9 w-9 rounded-2xl object-cover border border-white/10"
              />
            ) : (
              <div className="h-9 w-9 rounded-2xl bg-ap-copper/20 border border-ap-copper/30 flex items-center justify-center text-sm font-bold text-ap-copper shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{userName}</div>
              <div className="text-xs text-white/50 truncate">{userEmail}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/50 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>

        {/* Version footer */}
        <div className="px-5 py-3 border-t border-white/5 text-xs text-white/30">
          v0.1 · {userRole === "ADMIN" ? "Admin" : userRole === "STAFF" ? "Staff" : "Student"}
        </div>
      </aside>
    </>
  );
}

function NavLinks({ navItems }: { navItems: typeof ADMIN_NAV }) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" &&
            item.href !== "/student" &&
            item.href !== "/admin/certificates" &&
            pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200",
              active
                ? "bg-white/15 text-white shadow-lg border border-white/20"
                : "text-white/60 hover:text-white/90 hover:bg-white/8 border border-transparent"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition",
                active ? "text-white" : "text-white/50 group-hover:text-white/70"
              )}
            />
            <span className="font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export { NAV as DASH_NAV };
