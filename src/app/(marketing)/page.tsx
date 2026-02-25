import { db } from "@/lib/db";
import Hero from "@/components/marketing/Hero";
import SectionHead from "@/components/marketing/SectionHead";
import FAQ from "@/components/marketing/Faq";
import Testimonials from "@/components/marketing/Testimonials";
import AboutFounder from "@/components/marketing/AboutFounder";
import AcademyTeaser from "@/components/marketing/AcademyTeaser";
import BeforeAfter from "@/components/marketing/BeforeAfter";
import TrustBar from "@/components/marketing/TrustBar";
import HowItWorks from "@/components/marketing/HowItWorks";
import StyleTokens from "@/components/marketing/StyleTokens";
import ServicesSection3D from "@/components/marketing/ServicesSection3D";
import Schedule from "@/components/marketing/Schedule";
import Link from "next/link";

export default async function MarketingHomePage() {
  const [pairs, faqItems] = await Promise.all([
    (db as any).beforeAfterPair?.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }).catch(() => []) ?? [],
    (db as any).faqItem?.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }).catch(() => []) ?? [],
  ]);

  return (
    <main className="min-h-screen text-zinc-900">
      <Hero />

      <section className="px-6 py-14 md:py-24">
        <TrustBar />
      </section>

      <section className="px-6 py-16">
        <AboutFounder />
      </section>

      <section id="services" className="">
        <div className="px-6 pt-16" >
          <SectionHead
            kicker="Servicios"
            title="Elige tu servicio y reserva en minutos"
            subtitle="Adaptamos cada servicio a tus necesidades y tipo de rizo."
          />
        </div>
        <ServicesSection3D />
         <section className="px-6 py-16">
          <HowItWorks />
        </section>
      </section>

      <section className="px-6 py-16">
        <BeforeAfter pairs={pairs} />
      </section>

      <section id="academy" className="px-6 py-16">
        <AcademyTeaser />
      </section>

      <section className="px-6 py-16">
        <Testimonials />
      </section>

      <section className="px-6 py-16">
        <FAQ items={faqItems} />
      </section>

      <section id="horarios" className="py-20 px-4">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <p
            style={{ fontFamily: "Georgia, serif", letterSpacing: "4px" }}
            className="text-xs uppercase text-[#B16E34] mb-4"
          >
            Horarios
          </p>
          <h2
            style={{ fontFamily: "Georgia, serif" }}
            className="text-3xl md:text-4xl font-normal text-[#FAF4EA] mb-4"
          >
            Cuándo encontrarnos
          </h2>
        </div>
        <div className="mx-auto max-w-lg">
          <Schedule />
        </div>
        <div className="text-center mt-8">
          <Link href="/horarios" className="text-sm text-[#B16E34] hover:underline">
            Ver página completa de horarios →
          </Link>
        </div>
      </section>

      <StyleTokens />
    </main>
  );
}
