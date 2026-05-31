'use client'

import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'

export type WidgetSkeletonVariant = 'default' | 'alerts' | 'list' | 'map'

type WidgetSkeletonProps = {
  className?: string
  /** Altura mínima — útil para widgets full-width */
  minHeight?: 'md' | 'lg'
  variant?: WidgetSkeletonVariant
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-muted animate-pulse', className)} />
}

/**
 * Skeleton unificado para widgets del Inicio.
 * Usado en dynamic imports, Suspense y estados de carga internos.
 */
export function WidgetSkeleton({
  className,
  minHeight = 'md',
  variant = 'default',
}: WidgetSkeletonProps) {
  const { t } = useLocale()
  const minH = minHeight === 'lg' ? 'min-h-[18rem]' : 'min-h-[16rem]'

  if (variant === 'alerts') {
    return (
      <div
        className={cn(
          'flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5',
          minH,
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label={t('common.loading.alerts')}
      >
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
          <SkeletonBlock className="h-4 w-44" />
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-[4.5rem] w-full rounded-xl" />
          <SkeletonBlock className="h-[4.5rem] w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4',
          minH,
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label={t('common.loading.widget')}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-lg" />
            <SkeletonBlock className="h-4 w-36 max-w-[55%]" />
          </div>
          <SkeletonBlock className="h-3 w-12 shrink-0" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'map') {
    return (
      <div
        className={cn(
          'flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4',
          minH,
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label={t('common.loading.map')}
      >
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-9 w-9 rounded-lg" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
        <SkeletonBlock className="min-h-[12rem] flex-1 rounded-lg" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4',
        minH,
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label={t('common.loading.widget')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-lg" />
          <SkeletonBlock className="h-4 w-36 max-w-[55%]" />
        </div>
        <SkeletonBlock className="h-3 w-12 shrink-0 bg-muted/70" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SkeletonBlock className="h-14 rounded-lg bg-muted/80" />
        <SkeletonBlock className="h-14 rounded-lg bg-muted/80" />
        <SkeletonBlock className="hidden h-14 rounded-lg bg-muted/80 sm:block" />
      </div>

      <div className="mt-auto space-y-2">
        <SkeletonBlock className="h-3 w-full bg-muted/60" />
        <SkeletonBlock className="h-3 w-[88%] bg-muted/60" />
        <SkeletonBlock className="h-3 w-[72%] bg-muted/60" />
      </div>
    </div>
  )
}
