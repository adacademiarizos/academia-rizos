import MiniStat from "./Ministat";
import { motion, AnimatePresence } from "framer-motion"; // Importa AnimatePresence
import Link from "next/link";
import { useState, useEffect } from "react"; // Importa useState y useEffect

function Hero() {
  const images = [
    '/f.webp',
    '/f2.webp', // Asegúrate de tener estas rutas de imagen
    '/f3.webp', // Asegúrate de tener estas rutas de imagen
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); // Cambia la imagen cada 5000 milisegundos (5 segundos)

    return () => clearInterval(interval); // Limpia el intervalo cuando el componente se desmonte
  }, [images.length]); // El efecto se vuelve a ejecutar si la cantidad de imágenes cambia

  return (
    <section className="relative isolate overflow-hidden">
      {/* Background con imágenes rotatorias */}
      <AnimatePresence mode="popLayout"> {/* 'wait' asegura que una imagen termine de salir antes de que la otra entre */}
        <motion.div
          key={images[currentImageIndex]} // La key es crucial para que AnimatePresence detecte el cambio y anime
          className="absolute inset-0 z-10 bg-center"
          style={{ backgroundImage: `url(${images[currentImageIndex]})`, backgroundSize: 'cover' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4, scale: 1.1, x: 20 }} // Puedes ajustar la opacidad final y la animación de zoom/pan
          exit={{ opacity: 0 }}
          transition={{ 
            opacity: { duration: 1 }, // Duración de la transición de opacidad (desvanecimiento)
            scale: { duration: 10, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
            x: { duration: 10, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
          }}
        >
        </motion.div>
      </AnimatePresence>

      {/* Contenido principal */}
      <div className="relative z-30 mx-auto max-w-6xl px-6 pb-18 pt-32 md:pb-22 md:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/90 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-(--er-copper)" />
            Apoteósicas by Elizabeth Rizos · Curly Hair
          </p>

          <h1 className="mt-6 text-balance font-semibold tracking-tight text-white text-4xl md:text-6xl">
            Rizos apoteósicos.
            <span className="block text-white/90">Método {" "}

              <div className="own_animated">
                <div className="scroll_container">
                  <span className="font-main" >real.</span>
                  <span className="font-main" >duradero.</span>
                  <span className="font-main" >autentico.</span>
                  <span className="font-main" >real.</span> {/* Repetimos el primero para el loop */}
                </div>
              </div>

              <br />
              Resultados visibles.</span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-white/85 md:text-lg">
            Técnica, experiencia y una rutina pensada para ti. Reserva tu cita y
            llevate un resultado que se mantiene — no solo un “look del día”.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex"
            >
              <Link
                href="/booking"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-(--er-copper) px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:opacity-95"
              >
                Reservar cita
              </Link>
            </motion.div>

            <Link
              href="/courses"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
            >
              Ver Academia
            </Link>

          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Reservas rápidas" value="3 pasos" />
            <MiniStat label="Equipo" value="Elegí tu profe" />
            <MiniStat label="Academia" value="Cursos + Certificado" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;