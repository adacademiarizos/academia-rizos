import Link from "next/link";

function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-white/5 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-ap-ivory">Apoteósicas by Elizabeth Rizos</div>
          <div className="mt-2 text-xs text-white/50">
            Reservas · Academia · Comunidad curly
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/booking" className="font-semibold text-ap-copper hover:underline">
            Reservar
          </Link>
          <Link href="/courses" className="font-semibold text-ap-copper hover:underline">
            Academia
          </Link>
          <Link href="/contact" className="font-semibold text-ap-copper hover:underline">
            Contacto
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
