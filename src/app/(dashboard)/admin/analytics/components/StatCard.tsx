interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-ap-copper' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
    </div>
  )
}
