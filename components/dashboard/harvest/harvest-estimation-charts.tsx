'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  value: number
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

function formatBarLabel(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function barLabelFontSize(count: number): number {
  if (count > 30) return 11
  if (count > 18) return 12
  if (count > 10) return 13
  return 14
}

function barChartTopMargin(count: number): number {
  if (count > 14) return 40
  if (count > 8) return 34
  return 28
}

/** Ancho mínimo por categoría para que barras y etiquetas respiren (scroll horizontal). */
function scrollChartWidth(itemCount: number, groupedSeries = 1): number {
  const slot = groupedSeries > 1 ? 116 : 88
  return Math.max(480, itemCount * slot + 64)
}

function xAxisLayout(itemCount: number, groupedSeries = 1) {
  const slot = groupedSeries > 1 ? 116 : 88
  const flatLabels = slot >= 84 && itemCount <= 18
  return {
    slot,
    angle: flatLabels ? 0 : -28,
    textAnchor: flatLabels ? ('middle' as const) : ('end' as const),
    height: flatLabels ? 52 : 72,
    maxBarSize: Math.min(52, Math.round(slot * 0.52)),
  }
}

function ChartScrollArea({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  return (
    <div className="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border/40 bg-muted/10 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
      <div style={{ width, minWidth: '100%', height }}>
        {children}
      </div>
    </div>
  )
}

function barLabelFill(isDark: boolean): string {
  return isDark ? '#f8fafc' : UPCROP.chart5
}

function NumberTooltip({
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
          {entry.name}: {Number(entry.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </p>
      ))}
    </div>
  )
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

function CountBarChart({
  title,
  subtitle,
  data,
  axisColor,
  gridColor,
  valueLabel,
}: {
  title: string
  subtitle: string
  data: CountChartPoint[]
  axisColor: string
  gridColor: string
  valueLabel: string
}) {
  if (data.length === 0) return null

  const isDark = useIsDarkMode()
  const chartHeight = data.length > 6 ? 360 : 320
  const labelSize = barLabelFontSize(data.length)
  const topMargin = barChartTopMargin(data.length)
  const chartWidth = scrollChartWidth(data.length)
  const xAxis = xAxisLayout(data.length)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <ChartScrollArea width={chartWidth} height={chartHeight}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            margin={{ top: topMargin, right: 16, left: 4, bottom: xAxis.height }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              angle={xAxis.angle}
              textAnchor={xAxis.textAnchor}
              height={xAxis.height}
              interval={0}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              width={48}
              domain={[0, (max: number) => Math.ceil(max * 1.2) || 1]}
            />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString(undefined, { maximumFractionDigits: 1 }), valueLabel]}
            />
            <Bar dataKey="value" name={valueLabel} fill={UPCROP.primary} radius={[6, 6, 0, 0]} maxBarSize={xAxis.maxBarSize}>
              <LabelList
                dataKey="value"
                position="top"
                offset={6}
                formatter={formatBarLabel}
                style={{ fontSize: labelSize, fontWeight: 700, fill: barLabelFill(isDark) }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartScrollArea>
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
  useNumberTooltip = false,
}: {
  title: string
  subtitle: string
  data: Array<Record<string, string | number>>
  axisColor: string
  gridColor: string
  keys: Array<{ key: string; label: string; color: string }>
  useNumberTooltip?: boolean
}) {
  if (data.length === 0) return null

  const isDark = useIsDarkMode()
  const chartHeight = data.length > 6 ? 360 : 320
  const labelSize = barLabelFontSize(data.length)
  const topMargin = barChartTopMargin(data.length)
  const chartWidth = scrollChartWidth(data.length, keys.length)
  const xAxis = xAxisLayout(data.length, keys.length)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <ChartScrollArea width={chartWidth} height={chartHeight}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            margin={{ top: topMargin, right: 16, left: 4, bottom: xAxis.height }}
            barCategoryGap="18%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              angle={xAxis.angle}
              textAnchor={xAxis.textAnchor}
              height={xAxis.height}
              interval={0}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 10, fill: axisColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={48}
              domain={[0, (max: number) => Math.ceil(max * 1.2) || 1]}
            />
            <Tooltip
              content={useNumberTooltip ? <NumberTooltip /> : <KgTooltip />}
              cursor={{ fill: `${UPCROP.primary}22` }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map(({ key, label, color }) => (
              <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={xAxis.maxBarSize}>
                <LabelList
                  dataKey={key}
                  position="top"
                  offset={6}
                  formatter={formatBarLabel}
                  style={{ fontSize: labelSize, fontWeight: 700, fill: barLabelFill(isDark) }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartScrollArea>
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
  avgDardosByBlock: CountChartPoint[]
  avgTwigsByBlock: CountChartPoint[]
  prePostDardos: PrePostPoint[]
}

export function HarvestCountCharts({ avgDardosByBlock, avgTwigsByBlock, prePostDardos }: HarvestCountChartsProps) {
  const isDark = useIsDarkMode()
  const { t } = useLocale()
  const axisColor = isDark ? UPCROP.axisDark : UPCROP.axisLight
  const gridColor = isDark ? UPCROP.gridDark : UPCROP.gridLight
  const preKey = 'pre'
  const postKey = 'post'

  if (avgDardosByBlock.length === 0 && avgTwigsByBlock.length === 0 && prePostDardos.length === 0) return null

  return (
    <div className="space-y-4">
      {avgDardosByBlock.length > 0 && (
        <CountBarChart
          title={t('estimacionCosecha.charts.avgDardosByBlock')}
          subtitle={t('estimacionCosecha.charts.avgDardosByBlockSub')}
          data={avgDardosByBlock}
          axisColor={axisColor}
          gridColor={gridColor}
          valueLabel={t('estimacionCosecha.table.avgSpur')}
        />
      )}
      {avgTwigsByBlock.length > 0 && (
        <CountBarChart
          title={t('estimacionCosecha.charts.avgTwigsByBlock')}
          subtitle={t('estimacionCosecha.charts.avgTwigsByBlockSub')}
          data={avgTwigsByBlock}
          axisColor={axisColor}
          gridColor={gridColor}
          valueLabel={t('estimacionCosecha.table.avgTwigs')}
        />
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
          useNumberTooltip
          keys={[
            { key: preKey, label: t('estimacionCosecha.prePost.prePoda'), color: UPCROP.pre },
            { key: postKey, label: t('estimacionCosecha.prePost.postPoda'), color: UPCROP.post },
          ]}
        />
      )}
    </div>
  )
}
