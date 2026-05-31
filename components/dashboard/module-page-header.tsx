'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModulePageHeaderProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconClassName?: string
  iconWrapperClassName?: string
  className?: string
}

export function ModulePageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  iconWrapperClassName,
  className,
}: ModulePageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      <div className="flex items-center gap-3 mb-2">
        <div
          className={cn(
            'w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center',
            iconWrapperClassName,
          )}
        >
          <Icon className={cn('w-6 h-6 text-primary', iconClassName)} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}
