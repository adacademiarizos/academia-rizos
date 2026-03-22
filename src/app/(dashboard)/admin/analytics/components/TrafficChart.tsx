'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface TrafficChartProps {
  data: Array<{ date: string; views: number; sessions: number }>
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export function TrafficChart({ data }: TrafficChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
        Sin datos de tráfico para este periodo
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
        Tráfico en el tiempo
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#646A40" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#646A40" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fff" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '13px',
            }}
            labelFormatter={(label) => formatDate(String(label))}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}
          />
          <Area
            type="monotone"
            dataKey="views"
            name="Visitas"
            stroke="#646A40"
            strokeWidth={2}
            fill="url(#viewsGradient)"
          />
          <Area
            type="monotone"
            dataKey="sessions"
            name="Sesiones"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={2}
            fill="url(#sessionsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
