'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatKg } from '@/lib/agronomy/format'
import { useLocale } from '@/components/i18n/locale-provider'

export interface HarvestChartPoint {
  name: string
  kg: number
}

export interface PrePostPoint {
  name: string
  pre: number
  post: number
}

export interface TimelinePoint {
  date: string
  estimated: number
}

export interface CountChartPoint {
  name: string
  samples: number
  dardos: number
}

const UPCROP = {
  primary: '#4063ca',
  chart2: '#5b7ad6',
  chart3: '#2e4ba0',
  chart4: '#6b8de0',
  chart5: '#1f3784',
  pre: '#7c3aed',
  post: '#ea580c',
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

function KgTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatKg(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  )
}

function SimpleKgTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-0.5">{label}</p>
      <p className="font-semibold" style={{ color: UPCROP.chart4 }}>{formatKg(Number(payload[0]?.value ?? 0))}</p>
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
            <Tooltip content={<SimpleKgTooltip />} cursor={{ fill: `${UPCROP.primary}22` }} />
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

function CompareBarChart({
  title,
  subtitle,
  data,
  axisColor,
  gridColor,
  keys,
  colors,
}: {
  title: string
  subtitle: string
  data: Array<Record<string, string | number>>
  axisColor: string
  gridColor: string
  keys: Array<{ key: string; label: string; color: string }>
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
              angle={data.length > 3 ? -28 : 0}
              textAnchor={data.length > 3 ? 'end' : 'middle'}
              height={data.length > 3 ? 64 : 32}
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
            <Tooltip content={<KgTooltip />} cursor={{ fill: `${UPCROP.primary}22` }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map(({ key, label, color }) => (
              <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TimelineChart({
  title,
  subtitle,
  data,
  axisColor,
  gridColor,
  estimatedLabel,
}: {
  title: string
  subtitle: string
  data: TimelinePoint[]
  axisColor: string
  gridColor: string
  estimatedLabel: string
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
          <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="date"
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={48}
            />
            <Tooltip content={<KgTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="estimated" name={estimatedLabel} stroke={UPCROP.primary} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface HarvestEstimationChartsProps {
  byField: HarvestChartPoint[]
  byBlock: HarvestChartPoint[]
  byVariety: HarvestChartPoint[]
  prePostComparison: PrePostPoint[]
  timeline: TimelinePoint[]
}

export function HarvestEstimationCharts({
  byField,
  byBlock,
  byVariety,
  prePostComparison,
  timeline,
}: HarvestEstimationChartsProps) {
  const isDark = useIsDarkMode()
  const { t } = useLocale()
  const axisColor = isDark ? UPCROP.axisDark : UPCROP.axisLight
  const gridColor = isDark ? UPCROP.gridDark : UPCROP.gridLight
  const preKey = 'Pre-poda'
  const postKey = 'Post-poda'

  if (byField.length === 0 && byBlock.length === 0 && byVariety.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <KgBarChart
          title={t('estimacionCosecha.charts.kgByField')}
          subtitle={t('estimacionCosecha.charts.kgByFieldSub')}
          data={byField}
          axisColor={axisColor}
          gridColor={gridColor}
        />
        <KgBarChart
          title={t('estimacionCosecha.charts.kgByBlock')}
          subtitle={t('estimacionCosecha.charts.kgByBlockSub')}
          data={byBlock}
          axisColor={axisColor}
          gridColor={gridColor}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {byVariety.length > 0 && (
          <KgBarChart
            title={t('estimacionCosecha.charts.kgByVariety')}
            subtitle={t('estimacionCosecha.charts.kgByVarietySub')}
            data={byVariety}
            axisColor={axisColor}
            gridColor={gridColor}
          />
        )}
        {prePostComparison.length > 0 && (
          <CompareBarChart
            title={t('estimacionCosecha.charts.prePostCompare')}
            subtitle={t('estimacionCosecha.charts.prePostCompareSub')}
            data={prePostComparison.map((row) => ({
              name: row.name,
              [preKey]: row.pre,
              [postKey]: row.post,
            }))}
            axisColor={axisColor}
            gridColor={gridColor}
            keys={[
              { key: preKey, label: t('estimacionCosecha.prePost.prePoda'), color: UPCROP.pre },
              { key: postKey, label: t('estimacionCosecha.prePost.postPoda'), color: UPCROP.post },
            ]}
          />
        )}
      </div>

      {timeline.length > 1 && (
        <TimelineChart
          title={t('estimacionCosecha.charts.timeline')}
          subtitle={t('estimacionCosecha.charts.timelineSub')}
          data={timeline}
          axisColor={axisColor}
          gridColor={gridColor}
          estimatedLabel={t('estimacionCosecha.charts.estimatedKg')}
        />
      )}
    </div>
  )
}

interface HarvestCountChartsProps {
  samplesByBlock: CountChartPoint[]
  prePostDardos: PrePostPoint[]
}

export function HarvestCountCharts({ samplesByBlock, prePostDardos }: HarvestCountChartsProps) {
  const isDark = useIsDarkMode()
  const { t } = useLocale()
  const axisColor = isDark ? UPCROP.axisDark : UPCROP.axisLight
  const gridColor = isDark ? UPCROP.gridDark : UPCROP.gridLight
  const preKey = 'Pre-poda'
  const postKey = 'Post-poda'

  if (samplesByBlock.length === 0 && prePostDardos.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {samplesByBlock.length > 0 && (
          <div className="rounded-xl border bg-card p-4 flex flex-col min-h-[320px]">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t('estimacionCosecha.charts.samplesByBlock')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('estimacionCosecha.charts.samplesByBlockSub')}</p>
            </div>
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={samplesByBlock} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    tick={{ fontSize: 10, fill: axisColor }}
                    angle={samplesByBlock.length > 4 ? -28 : 0}
                    textAnchor={samplesByBlock.length > 4 ? 'end' : 'middle'}
                    height={samplesByBlock.length > 4 ? 64 : 32}
                    interval={0}
                  />
                  <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: axisColor }} width={40} />
                  <Tooltip />
                  <Bar dataKey="samples" name={t('estimacionCosecha.charts.samples')} fill={UPCROP.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {prePostDardos.length > 0 && (
          <CompareBarChart
            title={t('estimacionCosecha.charts.spursPrePost')}
            subtitle={t('estimacionCosecha.charts.spursPrePostSub')}
            data={prePostDardos.map((row) => ({
              name: row.name,
              [preKey]: row.pre,
              [postKey]: row.post,
            }))}
            axisColor={axisColor}
            gridColor={gridColor}
            keys={[
              { key: preKey, label: t('estimacionCosecha.prePost.prePoda'), color: UPCROP.pre },
              { key: postKey, label: t('estimacionCosecha.prePost.postPoda'), color: UPCROP.post },
            ]}
          />
        )}
      </div>
    </div>
  )
}
