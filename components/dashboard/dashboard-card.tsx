'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
  header?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

/**
 * Componente Card reutilizable para dashboard con espaciado optimizado.
 * - Padding máximo de 4 (p-4)
 * - Espacio consistente entre header y contenido (gap-3)
 * - Bordes sutiles en --border (design tokens)
 * - Background usando --card (design tokens)
 */
export function DashboardCard({
  header,
  children,
  className,
  headerClassName,
  contentClassName,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-4 flex flex-col gap-3 h-full',
        className
      )}
    >
      {header && (
        <div className={cn('flex items-center justify-between', headerClassName)}>
          {header}
        </div>
      )}
      <div className={cn('flex-1', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
