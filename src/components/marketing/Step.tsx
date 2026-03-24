

function Step({ n, title, desc, color }: { n: string; title: string; desc: string; color?: string }) {
  const isCrema = color === "crema";
  return (
    <div className={`rounded-3xl ${isCrema ? "bg-ap-acent-crema/70 " : "bg-white/5 shadow-sm border border-black/10"} p-6  backdrop-blur-md`}> 
      <h4 className={`text-xl tracking-wide font-semibold ${isCrema ? "text-ap-choco" : "text-ap-olive"}`}>{n}</h4>
      <div className={`mt-2 text-base font-jost font-semibold ${isCrema ? "text-zinc-700" : "text-zinc-200"}`}>{title}</div>
      <p className={`mt-2 text-sm ${isCrema ? "text-zinc-600" : "text-zinc-400"}`}>{desc}</p>
    </div>
  );
}

export default Step;