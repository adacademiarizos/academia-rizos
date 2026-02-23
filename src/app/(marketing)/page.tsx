"use client";

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
import ScrollRevealSection from "@/components/marketing/ScrollRevealSection";

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen text-zinc-900">
      {/* Hero — above fold, no reveal needed */}
      <Hero />

      <ScrollRevealSection>
        <section className="px-6 py-14 md:py-24">
          <TrustBar />
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="px-6 py-16">
          <AboutFounder />
        </section>
      </ScrollRevealSection>

      {/* Services: 100vh tall, reveal completes a bit later */}
      <ScrollRevealSection enterEnd="top 30%" exitEnd="top -20%">
        <section id="services" className="">
          <div className="px-6 pt-16">
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
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="px-6 py-16">
          <BeforeAfter />
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section id="academy" className="px-6 py-16">
          <AcademyTeaser />
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection>
        <section className="px-6 py-16">
          <Testimonials />
        </section>
      </ScrollRevealSection>

      <ScrollRevealSection exitEnd="top -15%">
        <section className="px-6 py-16">
          <FAQ />
        </section>
      </ScrollRevealSection>

      <StyleTokens />
    </main>
  );
}
