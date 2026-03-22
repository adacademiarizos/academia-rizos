'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface DeviceChartProps {
  data: Array<{ type: string; count: number }>
  title?: string
}

const COLORS = ['#646A40', '#8B9060', '#B0B880', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Escritorio',
  mobile: 'Móvil',
  tablet: 'Tablet',
  unknown: 'Otro',
}

export function DeviceChart({ data, title = 'Dispositivos' }: DeviceChartProps) {
  const chartData = data.map((d) => ({
    name: DEVICE_LABELS[d.type] || d.type,
    value: d.count,
  }))

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
        Sin datos
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '13px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
