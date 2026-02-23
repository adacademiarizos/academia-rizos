"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Bell, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

type NavItem = { label: string; href: string; icon: any };

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function MobileDrawer({
  open,
  setOpen,
  nav,
  session,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  nav: NavItem[];
  session?: any;
}) {
  const pathname = usePathname();
  const [imgError, setImgError] = useState(false);

  if (!open) return null;

  const userName = session?.user?.name ?? "Usuario";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image || null;
  const initials = userName[0]?.toUpperCase() ?? "U";

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] flex flex-col border-r border-white/5 bg-gradient-to-b from-ap-bg via-ap-bg to-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-9 w-auto" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Dashboard</div>
              <div className="text-xs text-white/50">Apoteósicas</div>
            </div>
          </div>

          <button
            className="rounded-2xl border border-white/10 bg-white/8 p-2.5 text-white hover:bg-white/15 transition"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="px-3 py-4 flex-1 overflow-y-auto min-h-0 nav-scroll">
          <div className="grid gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/student" &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200",
                    active
                      ? "bg-white/15 text-white shadow-lg border border-white/20"
                      : "text-white/60 hover:text-white/90 hover:bg-white/8 border border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition",
                      active ? "text-white" : "text-white/50"
                    )}
                  />
                  <span className="font-semibold">{item.label}</span>
                </Link>
              );
            })}

            {/* Notifications link */}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200",
                pathname === "/notifications"
                  ? "bg-white/15 text-white shadow-lg border border-white/20"
                  : "text-white/60 hover:text-white/90 hover:bg-white/8 border border-transparent"
              )}
            >
              <Bell
                className={cn(
                  "h-4 w-4 transition",
                  pathname === "/notifications" ? "text-white" : "text-white/50"
                )}
              />
              <span className="font-semibold">Notificaciones</span>
            </Link>
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

        {/* Footer */}
        <div className="border-t border-white/5 px-5 py-4 text-xs text-white/30">
          © {new Date().getFullYear()} Apoteósicas
        </div>
      </div>
    </div>
  );
}
