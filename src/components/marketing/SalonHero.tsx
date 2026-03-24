"use client";

import MiniStat from "./Ministat";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";

const IMAGES = ["/f.webp", "/f2.webp", "/f3.webp"];

function SalonHero() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative isolate bg-ap-bg overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={IMAGES[currentImageIndex]}
          className="absolute inset-0 z-10 bg-center"
          style={{
            backgroundImage: `url(${IMAGES[currentImageIndex]})`,
            backgroundSize: "cover",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35, scale: 1.1, x: 20 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1 },
            scale: {
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            },
            x: {
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            },
          }}
        />
      </AnimatePresence>

      <div className="relative z-30 mx-auto max-w-6xl px-6 pb-18 pt-32 md:pb-22 md:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-(--er-choco)" />
            Apoteósicas · Salón Especializado en Rizos
          </p>

          <h1 className="mt-6 text-balance font-semibold tracking-tight text-white text-4xl md:text-6xl">
            Tu transformación empieza aquí.
            <span className="block text-white/90">
              Resultado{" "}
              <div className="own_animated">
                <div className="scroll_container">
                  <span className="font-main">definición.</span>
                  <span className="font-main">hidratación.</span>
                  <span className="font-main">confianza.</span>
                  <span className="font-main">definición.</span>
                </div>
              </div>
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-white/85 md:text-lg">
            Un salón pensado para rizos: diagnóstico personalizado, productos
            especializados y un equipo que entiende tu textura. En Madrid, tu
            rizo tiene un lugar.
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
                href="https://booksy.com/es-es/115013_apoteosicas-by-elizabeth-rizos-salon_peluqueria_69069_palma-de-mallorca?do=invite&_branch_match_id=1561311293775932014&utm_medium=profile_share_from_profile&_branch_referrer=H4sIAAAAAAAAA8soKSkottLXT07J0UvKz88urtRLzs%2FVtzBwLveOKnR2j0qyrytKTUstKsrMS49PKsovL04tsnXOKMrPTQUAWqYzwTwAAAA%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-ap-choco px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:opacity-95"
              >
                Reservar cita
              </Link>
            </motion.div>

            <Link
              href="#services"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
            >
              Ver servicios
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            <MiniStat label="Transformaciones realizadas" value="500+" />
            <MiniStat label="Equipo formado" value="Especialistas" />
            <MiniStat label="Cada clienta es única" value="Diagnóstico personal" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default SalonHero;
