function FeatureChip({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/5 p-6 text-sm font-semibold text-zinc-300 shadow-sm backdrop-blur-md">
      {title}
      <div className="mt-2 text-xs font-normal text-zinc-300">
        (MVP listo · escalable)
      </div>
    </div>
  );
}


export default FeatureChip