"use client";

import MiniStat from "./Ministat";
import { motion } from "framer-motion";
import Link from "next/link";

function AcademyHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background with Ken Burns effect */}
      <motion.div
        className="absolute inset-0 z-10 bg-center"
        style={{
          backgroundImage: "url(/Elizabeth.webp)",
          backgroundSize: "cover",
          backgroundPosition: "top center",
        }}
        animate={{
          scale: [1, 1.08, 1],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />

      <div className="relative z-30 mx-auto max-w-6xl px-6 pb-18 pt-32 md:pb-22 md:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-(--er-olive)" />
            Academia de Rizos · Formación Online
          </p>

          <h1 className="mt-6 text-balance font-semibold tracking-tight text-white text-4xl md:text-6xl">
            Domina el método.
            <span className="block text-white/90">
              Certifica tu{" "}
              <div className="own_animated">
                <div className="scroll_container">
                  <span className="font-main">conocimiento.</span>
                  <span className="font-main">técnica.</span>
                  <span className="font-main">confianza.</span>
                  <span className="font-main">conocimiento.</span>
                </div>
              </div>
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-white/85 md:text-lg">
            Cursos online con módulos en video, recursos descargables, evaluación
            práctica y certificado verificable con QR. Aprende a tu ritmo, con
            soporte de IA para resolver tus dudas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-flex"
            >
              <Link
                href="/courses"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-(--er-copper) px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:opacity-95"
              >
                Explorar cursos
              </Link>
            </motion.div>

            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
            >
              Saber más
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Contenido profesional" value="Módulos en video" />
            <MiniStat label="Verificable con QR" value="Certificado" />
            <MiniStat label="Resuelve tus dudas" value="Chat con IA" />
            <MiniStat label="Material descargable" value="Recursos PDF" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default AcademyHero;
