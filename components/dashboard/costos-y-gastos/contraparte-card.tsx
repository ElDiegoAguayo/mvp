'use client'

import { Badge } from '@/components/ui/badge'
import type { GastoPorContraparte } from '@/app/actions/costos-gastos'
import { FileText, Clock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatCLP(amount)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ContraparteCardProps {
  data: GastoPorContraparte
  onClick?: () => void
  onVerClasificados?: () => void
}

export function ContraparteCard({ data, onClick, onVerClasificados }: ContraparteCardProps) {
  const { t } = useLocale()
  const {
    rut_contraparte,
    razon_social,
    total_monto_neto,
    total_monto_iva,
    total_monto_bruto,
    total_registros,
    pendientes,
    clasificados,
  } = data

  const hasPending = pendientes > 0

  return (
    <article
      onClick={onClick}
      className={[
        'group relative flex flex-col bg-card border border-border rounded-xl overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:shadow-black/20 hover:border-primary/30',
        onClick ? 'cursor-pointer select-none active:scale-[0.98]' : '',
      ].join(' ')}
    >
      {/* Left accent bar */}
      <div
        className={[
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl',
          hasPending ? 'bg-amber-500/70' : 'bg-primary/60',
        ].join(' ')}
      />

      <div className="pl-5 pr-5 pt-5 pb-4 flex flex-col gap-4 flex-1">
        {/* Identity block */}
        <div className="min-w-0">
          {/* Razón Social — the visual hero */}
          <h3
            className="text-base font-bold text-foreground leading-tight line-clamp-2"
            title={razon_social}
          >
            {razon_social || '—'}
          </h3>
          {/* RUT — secondary, compact */}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground tracking-wide">
            {t('costosGastos.common.rutPrefix', { rut: rut_contraparte })}
          </p>
        </div>

        {/* Total (monto bruto) */}
        <div className="space-y-0.5">
          <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
            {formatCompact(total_monto_bruto)}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('costosGastos.contraparte.totalAcumulado')}</p>
        </div>

        {/* Neto / IVA breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-secondary/60 border border-border/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
              {t('costosGastos.common.neto')}
            </p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {formatCompact(total_monto_neto)}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 border border-border/40 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
              {t('costosGastos.common.ivaPct')}
            </p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {formatCompact(total_monto_iva)}
            </p>
          </div>
        </div>

        {/* Footer: docs + status badges */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-border/50 mt-auto">
          {/* Top row: doc count + status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{t('costosGastos.contraparte.documentoCount', { count: total_registros })}</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {hasPending ? (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-semibold"
                >
                  <Clock className="w-3 h-3" />
                  {t('costosGastos.contraparte.pendienteCount', { count: pendientes })}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold"
                >
                  {t('costosGastos.contraparte.alDia')}
                </Badge>
              )}
            </div>
          </div>

          {/* Bottom row: action links */}
          <div className="flex items-center gap-3">
            {onClick && hasPending && (
              <span className="text-[11px] text-primary/70 flex items-center gap-0.5 group-hover:text-primary transition-colors font-medium">
                {t('costosGastos.contraparte.clasificarAction', { count: pendientes })} <ChevronRight className="w-3 h-3" />
              </span>
            )}
            {onVerClasificados && clasificados > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onVerClasificados() }}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline font-medium"
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                {t('costosGastos.contraparte.verClasificados', { count: clasificados })}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
