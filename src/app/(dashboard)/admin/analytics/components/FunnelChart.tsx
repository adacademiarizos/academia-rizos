'use client'

interface FunnelStep {
  label: string
  value: number
}

interface FunnelChartProps {
  steps: FunnelStep[]
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const max = Math.max(...steps.map((s) => s.value), 1)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
        Funnel de conversión
      </h3>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const pct = Math.round((step.value / max) * 100)
          const dropoff =
            i > 0 && steps[i - 1].value > 0
              ? Math.round(((steps[i - 1].value - step.value) / steps[i - 1].value) * 100)
              : 0

          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/70">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {step.value.toLocaleString('es-ES')}
                  </span>
                  {i > 0 && dropoff > 0 && (
                    <span className="text-xs text-red-400/70">-{dropoff}%</span>
                  )}
                </div>
              </div>
              <div className="h-6 rounded-lg bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, #646A40 0%, #7a8050 100%)`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
