// src/app/(marketing)/layout.tsx
'use client'
import type { ReactNode } from "react";
import Link from "next/link";
import {Calendar, LogIn, LogOut} from "lucide-react"
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Rizo1 from "@/components/marketing/svgs/Rizo";

const NAV_ITEMS = [
  { label: "Servicios", href: "/#services" },
  { label: "Academia", href: "/#academy" },
  { label: "FAQ", href: "/#faq" },
  { label: "Horarios", href: "/horarios" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen bg-ap-bg z-10 text-ap-ivory">
      <Header />
      {/* pt-16 clears the fixed navbar (~64px) on all pages except the homepage,
          which intentionally overflows under the navbar with its hero section */}
      <div className={isHome ? "" : "pt-16"}>
        {children}
      </div>
      <Footer />
    </div>
  );
}

function Header() {
  const { data: session } = useSession();

  // Determine button destination based on session and role
  const getButtonConfig = () => {
    if (!session?.user) {
      return {
        href: "/signin",
        label: "Iniciar Sesión",
        icon: LogIn,
      };
    }

    if (session.user.role === "ADMIN") {
      return {
        href: "/admin/courses",
        label: "Panel Admin",
        icon: null,
      };
    }

    return {
      href: "/student",
      label: "Mi Dashboard",
      icon: null,
    };
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  return (
    <header className="fixed w-full top-0 z-50   backdrop-blur-3xl bg-black/30 ">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="group leading-none">
          <img className="max-h-12" src="/logo.png" alt="" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="opacity-70 hover:opacity-100 transition hover:font-bold text-white text-xs"
            >
              {item.label}
            </a>
          ))}

          <div className="flex items-center gap-3">
            {/* Crear cuenta — only when logged out */}
            {!session?.user && (
              <Link
                href="/register"
                className="inline-flex text-white items-center justify-center gap-2 rounded-full px-4 py-2 border border-white/20 hover:bg-white/10 transition text-sm"
              >
                Crear cuenta
              </Link>
            )}

            {/* Primary CTA */}
            <Link
              href={buttonConfig.href}
              className="inline-flex bg-ap-copper items-center justify-center gap-2 rounded-full px-4 py-2 text-ap-ivory shadow-soft2 hover:opacity-95 transition"
            >
              {buttonConfig.label}
              {ButtonIcon && <ButtonIcon className="w-4 h-4" />}
            </Link>

            {/* Logout button - only show when authenticated */}
            {session?.user && (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex text-white items-center justify-center gap-2 rounded-full px-4 py-2 hover:bg-white/10 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>

        {/* Mobile */}
        <MobileMenu />
      </div>
    </header>
  );
}

function MobileMenu() {
  const { data: session } = useSession();

  // Determine button destination based on session and role
  const getButtonConfig = () => {
    if (!session?.user) {
      return {
        href: "/signin",
        label: "Iniciar Sesión",
      };
    }

    if (session.user.role === "ADMIN") {
      return {
        href: "/admin/courses",
        label: "Panel Admin",
      };
    }

    return {
      href: "/student",
      label: "Mi Dashboard",
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="md:hidden">
      <details className="group" >
        <summary className="list-none cursor-pointer select-none inline-flex items-center justify-center rounded-2xl px-4 py-2 bg-ap-bg/80 hover:border-ap-ink/40 transition">
          <span className="text-sm opacity-80 group-open:opacity-100">
            <Rizo1/>
          </span>
        </summary>

        <div className="flex h-dvh align-middle fixed inset-0 top-16 -z-40 border-ap-ink/10 bg-ap-bg/95 backdrop-blur supports-backdrop-filter:bg-(--background-transparent) overflow-auto">
          <div className="mx-auto max-w-6xl px-5 py-5 flex flex-col gap-4 min-h-[100vh-64px] justify-center items-center">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="py-2 text-sm opacity-80 hover:opacity-100 transition text-white "
              >
                {item.label}
              </a>
            ))}

            <div className="pt-2 flex flex-col gap-2 w-full items-center">
              <Link
                href={buttonConfig.href}
                className="inline-flex bg-(--acent) text-white items-center justify-center gap-2 rounded-full px-4 py-2 bg-ap-copper text-ap-ivory shadow-soft2 hover:opacity-95 transition"
              >
                {buttonConfig.label}
              </Link>

              {/* Crear cuenta — only when logged out */}
              {!session?.user && (
                <Link
                  href="/register"
                  className="inline-flex text-white items-center justify-center gap-2 rounded-full px-4 py-2 border border-white/20 hover:bg-white/10 transition text-sm"
                >
                  Crear cuenta
                </Link>
              )}

              {/* Logout button - only show when authenticated */}
              {session?.user && (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex text-white items-center justify-center gap-2 rounded-full px-4 py-2 hover:bg-white/10 transition"
                  title="Cerrar sesión"
                >
                  Cerrar sesión
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="pb-2">
              <Link
                href="/courses"
                className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 border border-ap-ink/20 hover:border-ap-ink/40 transition text-white"
              >
                Ver academia
              </Link>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t-white/25 bg-white/5 text-white">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="leading-tight">
            <p className="text-sm font-medium">Apoteósicas by Elizabeth Rizos</p>
            <p className="text-xs opacity-70 mt-1">
              Curly Hair · Técnica · Comunidad
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <a className="opacity-70 hover:opacity-100 transition" href="/#services">
              Servicios
            </a>
            <a className="opacity-70 hover:opacity-100 transition" href="/#results">
              Resultados
            </a>
            <a className="opacity-70 hover:opacity-100 transition" href="/#academy">
              Academia
            </a>
            <a className="opacity-70 hover:opacity-100 transition" href="/#faq">
              FAQ
            </a>
            <Link className="opacity-70 hover:opacity-100 transition" href="/contact">
              Contacto
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs opacity-65">
          <p>© {new Date().getFullYear()} Apoteósicas. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:opacity-100 transition">
              Privacidad
            </Link>
            <Link href="/terms" className="hover:opacity-100 transition">
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
