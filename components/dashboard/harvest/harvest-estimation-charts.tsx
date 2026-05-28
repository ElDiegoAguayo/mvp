'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatKg } from '@/lib/agronomy/format'

export interface HarvestChartPoint {
  name: string
  kg: number
}

/** Paleta corporativa UpCrop (ver globals.css --chart-*) */
const UPCROP = {
  primary: '#4063ca',
  chart2: '#5b7ad6',
  chart3: '#2e4ba0',
  chart4: '#6b8de0',
  chart5: '#1f3784',
  axisDark: '#9eb5ef',
  axisLight: '#2e4ba0',
  gridDark: '#3d3834',
  gridLight: '#d6d3d1',
}

const BAR_COLORS = [
  UPCROP.primary,
  UPCROP.chart2,
  UPCROP.chart4,
  UPCROP.chart3,
  '#7a9ae8',
  '#5272d0',
  UPCROP.chart5,
  '#8eb0ef',
  '#3558b8',
  '#6889dc',
]

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const kg = Number(payload[0]?.value ?? 0)
  return (
    <div className="rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-0.5">{label}</p>
      <p className="font-semibold" style={{ color: UPCROP.chart4 }}>{formatKg(kg)}</p>
    </div>
  )
}

function KgBarChart({
  title,
  subtitle,
  data,
  axisColor,
  gridColor,
}: {
  title: string
  subtitle: string
  data: HarvestChartPoint[]
  axisColor: string
  gridColor: string
}) {
  if (data.length === 0) return null

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col min-h-[360px]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              angle={data.length > 4 ? -32 : 0}
              textAnchor={data.length > 4 ? 'end' : 'middle'}
              height={data.length > 4 ? 72 : 32}
              interval={0}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: `${UPCROP.primary}22` }} />
            <Bar dataKey="kg" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface HarvestEstimationChartsProps {
  totalKg: number
  byField: HarvestChartPoint[]
  byBlock: HarvestChartPoint[]
}

export function HarvestEstimationCharts({ totalKg, byField, byBlock }: HarvestEstimationChartsProps) {
  const isDark = useIsDarkMode()
  const axisColor = isDark ? UPCROP.axisDark : UPCROP.axisLight
  const gridColor = isDark ? UPCROP.gridDark : UPCROP.gridLight

  if (byField.length === 0 && byBlock.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5">
        <p className="text-sm text-muted-foreground mb-1">Kg totales estimados (filtros actuales)</p>
        <p className="text-3xl font-bold tracking-tight" style={{ color: isDark ? UPCROP.chart4 : UPCROP.primary }}>
          {formatKg(totalKg)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {byBlock.length} cuartel{byBlock.length === 1 ? '' : 'es'}
          {' · '}
          {byField.length} campo{byField.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <KgBarChart
          title="Kg por campo"
          subtitle="Suma de estimaciones por campo"
          data={byField}
          axisColor={axisColor}
          gridColor={gridColor}
        />
        <KgBarChart
          title="Kg por cuartel"
          subtitle="Detalle por cuartel (campo · cuartel)"
          data={byBlock}
          axisColor={axisColor}
          gridColor={gridColor}
        />
      </div>
    </div>
  )
}
