"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Video, FileText, Bot, Award, ClipboardCheck, Users } from "lucide-react";
import SectionHead from "./SectionHead";

const FEATURES = [
  {
    icon: Video,
    title: "Videos por módulos",
    description:
      "Cada curso está dividido en módulos con lecciones en video de alta calidad. Aprende técnicas paso a paso, desde lo básico hasta lo avanzado.",
  },
  {
    icon: FileText,
    title: "Recursos PDF descargables",
    description:
      "Guías, fichas técnicas y resúmenes descargables para que puedas consultar el material offline cuando lo necesites.",
  },
  {
    icon: Bot,
    title: "Chat con IA",
    description:
      "Un asistente inteligente entrenado en el contenido del curso para resolver tus dudas sobre cada módulo, en cualquier momento.",
  },
  {
    icon: Award,
    title: "Certificado verificable",
    description:
      "Al completar el curso y superar la evaluación, obtienes un certificado profesional con código QR verificable.",
  },
  {
    icon: ClipboardCheck,
    title: "Tests y evidencias",
    description:
      "Evaluaciones prácticas con subida de evidencias (fotos de resultados) para demostrar que dominás la técnica.",
  },
  {
    icon: Users,
    title: "Comunidad de alumnas",
    description:
      "Acceso a una comunidad exclusiva donde compartir resultados, resolver dudas y conectar con otras profesionales del rizo.",
  },
];

function AcademyFeatures() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div id="features" className="mx-auto max-w-6xl" ref={ref}>
      <SectionHead
        kicker="¿Qué incluye?"
        title="Todo lo que necesitas para dominar el método"
        subtitle="Cada curso está diseñado con herramientas profesionales para que tu aprendizaje sea completo y práctico."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/8"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              <feature.icon size={24} />
            </div>
            <h3 className="text-base font-semibold text-white">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default AcademyFeatures;
