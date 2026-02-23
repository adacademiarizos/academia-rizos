

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/5 p-6 shadow-sm backdrop-blur-md">
      <h4 className="text-xl tracking-wide font-semibold  text-ap-olive">{n}</h4>
      <div className="mt-2 text-base font-jost text-zinc-200 font-semibold">{title}</div>
      <p className="mt-2 text-sm text-zinc-400">{desc}</p>
    </div>
  );
}

export default Step