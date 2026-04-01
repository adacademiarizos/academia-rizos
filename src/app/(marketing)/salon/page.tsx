import { db } from "@/lib/db";
import SalonHero from "@/components/marketing/SalonHero";
import SectionHead from "@/components/marketing/SectionHead";
import ServicesSection3D from "@/components/marketing/ServicesSection3D";
import HowItWorks from "@/components/marketing/HowItWorks";
import ResultsGallery from "@/components/marketing/ResultsGallery";
import SalonAbout from "@/components/marketing/SalonAbout";
import FAQ from "@/components/marketing/Faq";
import Schedule from "@/components/marketing/Schedule";
import Testimonials from "@/components/marketing/Testimonials";
import ContactSection from "@/components/marketing/ContactSection";
import Link from "next/link";

const BOOKSY_URL =
  "https://booksy.com/es-es/115013_apoteosicas-by-elizabeth-rizos-salon_peluqueria_69069_palma-de-mallorca";

export default async function SalonPage() {
  const [resultImages, faqItems] = await Promise.all([
    db.resultImage
      .findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
      .catch(() => []),
    db.faqItem
      .findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
      .catch(() => []),
  ]);

  return (
    <main className="min-h-screen bg-ap-crema ">
      <SalonHero />

      <section id="services">
        <div className="px-6 pt-16">
          <SectionHead
            kicker="Servicios"
            title="Elige tu servicio y reserva en Booksy"
            subtitle="Version temporal: los servicios se gestionan mediante enlaces externos."
            color="crema"
          />
        </div>
        <ServicesSection3D />
      </section>

      <section className="px-6 py-16">
        <HowItWorks color="crema" />
      </section>

      <section className="px-6 py-16">
        <ResultsGallery images={resultImages} color="crema" />
      </section>

      <section className="px-6 py-16">
        <SalonAbout color="crema" />
      </section>

      <section className="px-6 py-16">
        <Testimonials scope="salon" color="crema" />
      </section>

      <section id="faq" className="px-6 py-16">
        <FAQ items={faqItems} color="crema" />
      </section>

      <section id="horarios" className="py-20 px-4">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p className="font-main text-2xl font-semibold tracking-wide text-ap-choco">
            HORARIOS
          </p>
          <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-black md:text-4xl">
            Cuándo encontrarnos
          </h2>
        </div>
        <div className="mx-auto max-w-lg">
          <Schedule />
        </div>
        <div className="text-center mt-8">
          <Link
            href="/horarios"
            className="text-sm text-[#B16E34] hover:underline"
          >
            Ver página completa de horarios →
          </Link>
        </div>
      </section>

      <section className="bg-[#171614]">
        <ContactSection scope="SALON" />
      </section>

      {/* CTA Final */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center gap-6 rounded-[2.2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-md md:p-14">
            <h2 className="text-3xl font-semibold text-black md:text-4xl">
              ¿Lista para tu transformación?
            </h2>
            <p className="max-w-lg text-zinc-600">
              Reserva tu cita y descubre lo que un equipo especializado puede
              hacer por tu rizo. Confirmación inmediata por email.
            </p>
            <a
              href={BOOKSY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-ap-choco px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
            >
              Reservar en Booksy
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
