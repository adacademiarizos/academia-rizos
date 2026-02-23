import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ServiceCard({
  title,
  desc,
  duration,
  from,
  href,
  featured,
}: {
  title: string;
  desc: string;
  duration: string;
  from: string;
  href: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-white/55 p-6 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5",
        featured ? "border-[var(--er-copper)]/40 ring-1 ring-[var(--er-copper)]/25" : "border-black/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-1 text-xs text-zinc-600">{duration} · Desde {from}</div>
        </div>
        {featured ? (
          <span className="rounded-full bg-[var(--er-copper)] px-3 py-1 text-xs font-semibold text-white">
            Popular
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-zinc-700">{desc}</p>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href={href}
          className="rounded-2xl bg-[var(--er-copper)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Ver disponibilidad
        </Link>
        <Link href="/booking" className="text-sm font-semibold text-[var(--er-olive)] hover:underline">
          Reservar →
        </Link>
      </div>
    </div>
  );
}

export default ServiceCard