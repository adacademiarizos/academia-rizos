// src/app/(marketing)/layout.tsx
'use client'
import type { ReactNode } from "react";
import Link from "next/link";
import { LogIn, LogOut} from "lucide-react"
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Rizo1 from "@/components/marketing/svgs/Rizo";

const NAV_ITEMS = [
  { label: "Salón", href: "/salon" },
  { label: "Academia", href: "/academia" },
  { label: "Cursos", href: "/courses" },
  { label: "Contacto", href: "/#contacto" },
];

/** Reglas de color para el botón CTA del navbar.
 *  Cada entrada tiene:
 *  - match: string  → prefijo exacto (ej. "/salon" cubre "/salon" y "/salon/algo")
 *  - match: RegExp  → patrón arbitrario (ej. /^\/user\/[^/]+$/)
 *  - accent: clase Tailwind a aplicar
 *  Se evalúan en orden; la primera que coincide gana.
 *  Si ninguna coincide se usa el color por defecto (bg-ap-copper). */
const ROUTE_ACCENT: { match: string | RegExp; accent: string }[] = [
  { match: "/salon",    accent: "bg-ap-choco" },  // naranja — cubre /salon, /salon/servicios, etc.
  { match: "/horarios", accent: "bg-ap-choco" },
  // { match: /^\/user\/[^/]+$/, accent: "bg-ap-choco" },  // rutas /user/:id
  // { match: "/academia",        accent: "bg-ap-copper" },
];

/** Reglas para background del footer en rutas específicas.
 *  `bg` debe ser un valor CSS válido para background-color; usamos rgba para soporte de opacidad.
 */
const ROUTE_FOOTER: { match: string | RegExp; bg: string }[] = [
  // color --color-ap-acent-crema = #e9d6c5 → rgba(233,214,197,0.7)
  { match: "/salon", bg: "#e9d6c5" },
  { match: "/horarios", bg: "#e9d6c5" },
];

function getFooterBg(pathname: string): string | null {
  for (const { match, bg } of ROUTE_FOOTER) {
    if (typeof match === "string" ? pathname.startsWith(match) : match.test(pathname)) return bg;
  }
  return null;
}

/** Reglas para clase de texto del menú según ruta */
const ROUTE_MENU_TEXT: { match: string | RegExp; className: string }[] = [
  { match: "/salon", className: "text-zinc-800" },
  { match: "/horarios", className: "text-zinc-800" },
];

function getMenuTextClass(pathname: string, fallback = "text-white") {
  for (const { match, className } of ROUTE_MENU_TEXT) {
    if (typeof match === "string" ? pathname.startsWith(match) : match.test(pathname)) return className;
  }
  return fallback;
}

function getAccent(pathname: string, fallback = "bg-ap-copper") {
  for (const { match, accent } of ROUTE_ACCENT) {
    if (typeof match === "string" ? pathname.startsWith(match) : match.test(pathname))
      return accent;
  }
  return fallback;
}

function getImage(pathname: string) {
  for (const { match } of ROUTE_ACCENT) {
    if (typeof match === "string" ? pathname.startsWith(match) : match.test(pathname))
    return "/logo-naranja.png";
  }
  return "/logo.png";
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ap-bg z-10 text-ap-ivory">
      {/* SVG filter para la textura de papel (referenciado por .textura-papel::before) */}
      <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="paper" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="linearRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.77" numOctaves="8" seed="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
            <feComponentTransfer in="gray" result="contrast">
              <feFuncR type="linear" slope="2.4" intercept="-0.7" />
              <feFuncG type="linear" slope="2.4" intercept="-0.7" />
              <feFuncB type="linear" slope="2.4" intercept="-0.7" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="contrast" mode="multiply" />
          </filter>
        </defs>
      </svg>
      <Header />
      {/* pt-16 clears the fixed navbar (~64px) on all pages except those with full-bleed heroes */}
      <div >
        {children}
      </div>
      <Footer />
    </div>
  );
}

function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const accentBg = getAccent(pathname);
  const logoSrc = getImage(pathname);
  const menuTextClass = getMenuTextClass(pathname);

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
    <header className="fixed w-full top-0 z-50 backdrop-blur-3xl ">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="group leading-none">
          <img className="max-h-12" src={logoSrc} alt="" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`opacity-70 hover:opacity-100 transition hover:font-bold ${menuTextClass} text-xs`}
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
              className={`inline-flex ${accentBg} items-center justify-center gap-2 rounded-full px-4 py-2 text-ap-ivory shadow-soft2 hover:opacity-95 transition`}
              style={{ "--accent-color-main": accentBg } as React.CSSProperties}
            >
              {buttonConfig.label}
              {ButtonIcon && <ButtonIcon className="w-4 h-4" />}
            </Link>

            {/* Logout button - only show when authenticated */}
            {session?.user && (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className={`inline-flex ${menuTextClass} items-center justify-center gap-2 rounded-full px-4 py-2 hover:bg-white/10 transition`}
                title="Cerrar sesión"
              >
                <LogOut className={`w-4 h-4 ${menuTextClass}`} />
              </button>
            )}
          </div>
        </nav>

        {/* Mobile */}
        <MobileMenu accentBg={accentBg} menuTextClass={menuTextClass} />
      </div>
    </header>
  );
}

function MobileMenu({ accentBg, menuTextClass }: { accentBg: string; menuTextClass: string }) {
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
                className={`py-2 text-sm opacity-80 hover:opacity-100 transition ${menuTextClass}`}
              >
                {item.label}
              </a>
            ))}

            <div className="pt-2 flex flex-col gap-2 w-full items-center">
              <Link
                href={buttonConfig.href}
                className={`inline-flex ${accentBg} items-center justify-center gap-2 rounded-full px-4 py-2 text-ap-ivory shadow-soft2 hover:opacity-95 transition`}
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
                  className={`inline-flex ${menuTextClass} items-center justify-center gap-2 rounded-full px-4 py-2 hover:bg-white/10 transition`}
                  title="Cerrar sesión"
                >
                  Cerrar sesión
                  <LogOut className={`w-4 h-4 ${menuTextClass}`} />
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
  const pathname = usePathname();
  const footerBg = getFooterBg(pathname);

  return (
    <footer
      className="pt-16 border-t-white/25 text-white"
      style={footerBg ? ({ backgroundColor: footerBg } as React.CSSProperties) : undefined}
    >
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="leading-tight">
            <p className={`text-sm font-medium ${footerBg ? 'text-zinc-800' : 'text-white'}`}>Apoteósicas by Elizabeth Rizos</p>
            <p className={`text-xs mt-1 ${footerBg ? 'text-zinc-800' : 'text-white'}`}>
              Curly Hair · Técnica · Comunidad
            </p>
          </div>

          <div className={`flex flex-wrap gap-x-6 gap-y-3 text-sm ${footerBg ? 'text-zinc-900' : 'text-white'}`}>
            <Link className="hover:opacity-100 transition" href="/salon">
              Salón
            </Link>
            <Link className="hover:opacity-100 transition" href="/academia">
              Academia
            </Link>
            <Link className="hover:opacity-100 transition" href="/courses">
              Cursos
            </Link>
            <Link className="hover:opacity-100 transition" href="/#contacto">
              Contacto
            </Link>
          </div>
        </div>

        <div className={`mt-8 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs ${footerBg ? 'text-zinc-900' : 'text-white'}`}>
          <p>© {new Date().getFullYear()} Apoteósicas. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:opacity-100 transition ">
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
