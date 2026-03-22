'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface SourcesChartProps {
  data: Array<{ source: string; views: number; sessions: number; conversions: number }>
}

export function SourcesChart({ data }: SourcesChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
        Sin datos de fuentes
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
        Fuentes de tráfico
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
          />
          <YAxis
            type="category"
            dataKey="source"
            width={120}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '13px',
            }}
          />
          <Bar dataKey="views" name="Visitas" fill="#646A40" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
