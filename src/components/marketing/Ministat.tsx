

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md">
      <div className="text-sm font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/75">{label}</div>
    </div>
  );
}

export default MiniStat