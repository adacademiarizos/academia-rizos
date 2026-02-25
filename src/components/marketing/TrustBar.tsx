"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import TrustCard from "./TrustCard";

const containerVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.14, when: "beforeChildren", duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
} as const;

function TrustBar() {
  const items = [
    {
      title: "Enfoque personalizado",
      desc: "No es receta genérica: se evalúa tu textura, porosidad y objetivo.",
    },
    {
      title: "Resultados que duran",
      desc: "Rutina práctica + técnica para mantener definición e hidratación.",
    },
    {
      title: "Proceso claro",
      desc: "Elegís servicio → profesional → horario → confirmás (con pago/seña).",
    },
  ];

  const ref = useRef<HTMLDivElement | null>(null);
  // detect when the bar enters the viewport
  const inView = useInView(ref, { once: true, margin: "-20%" });

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3"
    >
      {items.map((it, idx) => (
        <motion.div key={idx} variants={itemVariants}>
          <TrustCard visible={inView} index={idx} total={items.length} title={it.title} desc={it.desc} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default TrustBar;