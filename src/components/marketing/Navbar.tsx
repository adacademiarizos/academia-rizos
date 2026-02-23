"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <nav
          className={cn(
            "flex items-center justify-between rounded-3xl px-4 py-3 transition",
            // Estado arriba (sobre video): transparente elegante
            !scrolled && "bg-transparent",
            // Estado al scrollear: glass premium
            scrolled &&
              "border border-white/15 bg-black/30 backdrop-blur-xl shadow-lg shadow-black/20"
          )}
        >
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            {/* Cambiá por tu logo real cuando lo tengas en /public/logo.svg */}
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white border border-white/15">
              <span className="text-xs font-semibold tracking-wide">ER</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">
                Apoteósicas
              </div>
              <div className="text-[11px] text-white/70">
                by Elizabeth Rizos
              </div>
            </div>
          </Link>

          {/* Links */}
          <div className="hidden items-center gap-6 md:flex">
            <NavLink href="#services">Servicios</NavLink>
            <NavLink href="#academy">Academia</NavLink>
            <NavLink href="#faq">FAQ</NavLink>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link
              href="/courses"
              className="hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 md:inline-flex"
            >
              Ver Academia
            </Link>

            <Link
              href="/booking"
              className="inline-flex rounded-2xl bg-[var(--er-copper)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:opacity-95"
            >
              Reservar
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-sm font-semibold text-white/85 transition hover:text-white"
    >
      {children}
    </Link>
  );
}
