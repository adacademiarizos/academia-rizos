import SectionHead from "./SectionHead";
import Step from "./Step";
import Link from "next/link";

function AcademyMethod() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Método de aprendizaje"
        title="3 pasos para certificarte"
        subtitle="Un proceso claro y estructurado para que aprendas a tu ritmo y demuestres tu conocimiento."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Step
          n="01"
          title="Aprende con los módulos"
          desc="Accede a las lecciones en video, descarga los recursos y estudia cada técnica a tu propio ritmo."
        />
        <Step
          n="02"
          title="Practica y sube evidencias"
          desc="Aplica lo aprendido, toma fotos de tus resultados y súbelas como evidencia de cada módulo."
        />
        <Step
          n="03"
          title="Obtén tu certificado"
          desc="Completa la evaluación final y recibe tu certificado profesional con QR verificable."
        />
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:flex-row md:items-center">
        <div>
          <div className="text-sm font-semibold text-zinc-200">
            ¿Lista para empezar?
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Explora nuestros cursos y comienza tu formación profesional en el
            cuidado del rizo.
          </p>
        </div>
        <Link
          href="/courses"
          className="rounded-2xl bg-[var(--er-copper)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Ver cursos
        </Link>
      </div>
    </div>
  );
}

export default AcademyMethod;
