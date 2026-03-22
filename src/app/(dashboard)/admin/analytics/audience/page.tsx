'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DeviceChart } from '../components/DeviceChart'
import { DataTable } from '../components/DataTable'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function AudiencePage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

  const [devices, setDevices] = useState<any>(null)
  const [geo, setGeo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = `from=${from}&to=${to}`
    Promise.all([
      fetch(`/api/admin/analytics/devices?${qs}`).then((r) => r.json()),
      fetch(`/api/admin/analytics/geo?${qs}`).then((r) => r.json()),
    ])
      .then(([dev, g]) => {
        setDevices(dev.data)
        setGeo(g.data || [])
      })
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 h-72 animate-pulse" />
          <div className="rounded-2xl border border-white/10 bg-white/5 h-72 animate-pulse" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device breakdown */}
        <DeviceChart data={devices?.devices || []} title="Dispositivos" />

        {/* Browser breakdown */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
            Navegadores
          </h3>
          {devices?.browsers?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={devices.browsers} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
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
                />
                <Bar dataKey="count" name="Visitas" fill="#646A40" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/40 text-center py-8">Sin datos</p>
          )}
        </div>
      </div>

      {/* OS breakdown */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
          Sistemas operativos
        </h3>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(devices?.os || []).map((item: any) => (
            <div key={item.name} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span className="text-sm text-white/70">{item.name}</span>
              <span className="text-sm font-semibold text-white">{item.count.toLocaleString('es-ES')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Geography */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
          Ubicación geográfica
        </h3>
        <DataTable
          columns={[
            { key: 'country', label: 'País' },
            { key: 'city', label: 'Ciudad', render: (r: any) => r.city || '—' },
            { key: 'views', label: 'Visitas', align: 'right', render: (r: any) => r.views.toLocaleString('es-ES') },
            { key: 'sessions', label: 'Sesiones', align: 'right', render: (r: any) => r.sessions.toLocaleString('es-ES') },
          ]}
          data={geo}
          emptyMessage="Sin datos geográficos (disponible en producción con Vercel)"
        />
      </div>
    </div>
  )
}
