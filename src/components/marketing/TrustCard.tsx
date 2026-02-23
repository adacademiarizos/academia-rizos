
import { motion, useReducedMotion } from "framer-motion";

function TrustCard({
  title,
  desc,
  index = 0,
  total = 3,
  visible = false,
}: {
  title: string;
  desc: string;
  index?: number;
  total?: number;
  visible?: boolean;
}) {
  const shouldReduce = useReducedMotion();
  const totalDuration = total * 2; // total cycle duration in seconds
  const delayStart = index * 2; // each card starts its lift every 2s

  // normalize times for keyframes (0..1)
  const t0 = delayStart / totalDuration;
  // make lift take longer: start ramp slightly later and end later so the 'up' motion lasts ~1s
  const t1 = (delayStart + 0.5) / totalDuration; // start lifting (slower)
  const t2 = (delayStart + 1.5) / totalDuration; // reach full lift and hold
  const t3 = (delayStart + 2) / totalDuration;

  // add intermediate step for smoother lift
  const yKeyframes = [0, 0, -6, -12, 0, 0];
  const shadowKeyframes = [
    "0 6px 18px rgba(0,0,0,0.08)",
    "0 6px 18px rgba(0,0,0,0.08)",
    `0 30px 60px rgba(100,106,64,0.18)`,
    `0 30px 60px rgba(100,106,64,0.18)`,
    "0 6px 18px rgba(0,0,0,0.08)",
    "0 6px 18px rgba(0,0,0,0.08)",
  ];

  // Border color keyframes: tenue -> acent color -> tenue
  const borderKeyframes = [
    "rgba(255,255,255,0.06)",
    "rgba(255,255,255,0.06)",
    "rgba(100,106,64,0.95)",
    "rgba(100,106,64,0.95)",
    "rgba(255,255,255,0.06)",
    "rgba(255,255,255,0.06)",
  ];

  const haloOpacity = [0, 0, 1, 1, 0, 0];
  const opacityKeyframes = [0, 1, 1, 1, 1, 1];

  // halo should peak when the card is fully lifted (around t2)
  const haloOffset = 0.02;
  const haloTimes = [0, 0, Math.max(0, t2 - haloOffset), Math.min(1, t2 + haloOffset), t3, 1];

  const transition = shouldReduce
    ? { duration: 0 }
    : {
        duration: totalDuration,
        times: [0, t0, t1, t2, t3, 1],
        repeat: Infinity,
      };

  // When not visible we keep a static/hidden state; when visible we run the looping transition
  const animateWhenVisible = visible
    ? { y: yKeyframes, boxShadow: shadowKeyframes, borderColor: borderKeyframes, opacity: opacityKeyframes }
    : { y: 0, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", borderColor: "rgba(255,255,255,0.06)", opacity: 0 };

  const transitionWhenVisible = shouldReduce
    ? { duration: 0 }
    : visible
    ? transition
    : { duration: 300 };

  return (
    <motion.div
      className="relative rounded-3xl border-[3px] border-solid bg-white/5 p-6 overflow-visible"
      animate={
        shouldReduce
          ? { y: 0, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", borderColor: "rgba(255,255,255,0.06)" }
          : { y: yKeyframes, boxShadow: shadowKeyframes, borderColor: borderKeyframes }
      }
      transition={transition}
    >
      {/* Halo background */}
      <motion.div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl"
        aria-hidden
        style={{
          background:
          "radial-gradient(ellipse at center, rgba(100,106,64,0.16) 0%, rgba(100,106,64,0.08) 40%, transparent 60%)",
          filter: "blur(24px)",
        }}
        animate={shouldReduce ? { opacity: 0 } : { opacity: haloOpacity }}
        transition={shouldReduce ? { duration: 0 } : { duration: totalDuration, times: haloTimes, repeat: Infinity }}
      />

      <h3 className="font-main text-xl md:text-2xl text-white font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-white">{desc}</p>
    </motion.div>
  );
}

export default TrustCard;