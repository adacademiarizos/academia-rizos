import AcademyHero from "@/components/marketing/AcademyHero";
import AcademyFeatures from "@/components/marketing/AcademyFeatures";
import AcademyMethod from "@/components/marketing/AcademyMethod";
import LatestCourses from "@/components/marketing/LatestCourses";
import Testimonials from "@/components/marketing/Testimonials";
import Link from "next/link";

export default function AcademiaPage() {
  return (
    <main className="min-h-screen">
      <AcademyHero />

      <section className="px-6 py-16">
        <AcademyFeatures />
      </section>

      <section className="px-6 py-16">
        <AcademyMethod />
      </section>

      <LatestCourses />

      <section className="px-6 py-16">
        <Testimonials scope="academia" />
      </section>

      {/* CTA Final */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center gap-6 rounded-[2.2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-md md:p-14">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">
              Empieza tu formación hoy
            </h2>
            <p className="max-w-lg text-zinc-300">
              Explora nuestros cursos, aprende a tu ritmo y obtén un certificado
              profesional verificable.
            </p>
            <Link
              href="/courses"
              className="rounded-2xl bg-(--er-copper) px-8 py-4 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
            >
              Explorar cursos
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
