import Hero from "@/components/marketing/Hero";
import Testimonials from "@/components/marketing/Testimonials";
import AboutFounder from "@/components/marketing/AboutFounder";
import TrustBar from "@/components/marketing/TrustBar";
import StyleTokens from "@/components/marketing/StyleTokens";
import ContactSection from "@/components/marketing/ContactSection";
import PageTeasers from "@/components/marketing/PageTeasers";
import { db } from "@/lib/db";
import ResultsGallery from "@/components/marketing/ResultsGallery";

export const dynamic = "force-dynamic";

export default async function MarketingHomePage() {
  const [resultImages, faqItems] = await Promise.all([
      db.resultImage
        .findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
        .catch(() => []),
      db.faqItem
        .findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] })
        .catch(() => []),
    ]);


  return (
    <main className="min-h-screen">
      {/* <Hero /> */}

      <section className="px-6 py-28">
        <PageTeasers />
      </section>


      <section className="px-6 py-14 md:py-24">
        <TrustBar />
      </section>

      <section className="px-6 py-16">
        <AboutFounder />
      </section>

       <section className="px-6 py-16">
          <ResultsGallery images={resultImages} />
        </section>

      <section className="px-6 py-16">
        <Testimonials scope="home" />
      </section>

      <ContactSection scope="ACADEMIA" />

      <StyleTokens />
    </main>
  );
}
