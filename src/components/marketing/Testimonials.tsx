import SectionHead from "./SectionHead";


function Testimonials() {
  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker="Testimonios"
        title="Lo que dicen (placeholder por ahora)"
        subtitle="Cuando la clienta pase testimonios reales, esto se vuelve una máquina de conversiones."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          "“Me cambió la forma en que cuido mi rizo. Ahora sé qué hacer.”",
          "“La definición me duró días y por fin entendí mi rutina.”",
          "“El corte quedó perfecto, forma + volumen real.”",
        ].map((t, i) => (
          <div key={i} className="rounded-3xl border border-black/10 bg-white/55 p-6 shadow-sm">
            <div className="text-sm text-zinc-900">{t}</div>
            <div className="mt-4 text-xs font-semibold text-[var(--er-olive)]">Clienta</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Testimonials