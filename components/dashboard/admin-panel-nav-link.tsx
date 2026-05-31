'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  getIconShape,
  getIconSize,
  resolveIconContainerStyle,
  resolveIconStyle,
} from '@/lib/module-icons'

/** Mismo azul primary de Up Crop, estilo icono igual que los módulos del menú */
const ADMIN_ICON_COLOR = '#4063ca'

interface AdminPanelNavLinkProps {
  href?: string
  collapsed?: boolean
  active?: boolean
  onClick?: () => void
}

export function AdminPanelNavLink({
  href = '/admin',
  collapsed = false,
  active = false,
  onClick,
}: AdminPanelNavLinkProps) {
  const { t } = useLocale()
  const shapeCfg = getIconShape('rounded')
  const sizeCfg = getIconSize('md')
  const iconContainer = resolveIconContainerStyle(
    ADMIN_ICON_COLOR,
    shapeCfg.className,
    'soft',
  )
  const iconStyle = resolveIconStyle(ADMIN_ICON_COLOR, 'soft')

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? t('shell.adminPanel') : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm transition-colors',
        collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2',
        active ? 'bg-secondary/60' : 'hover:bg-secondary',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          sizeCfg.container,
          iconContainer.className,
        )}
        style={iconContainer.style}
      >
        <Shield
          className={cn('shrink-0', sizeCfg.icon, iconStyle.className)}
          style={iconStyle.style}
        />
      </div>
      {!collapsed && (
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-medium',
            !active && 'text-muted-foreground',
          )}
        >
          {t('shell.adminPanel')}
        </span>
      )}
    </Link>
  )
}

export function AdminSectionLabel({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useLocale()
  if (collapsed) return <div className="pt-2" />

  return (
    <div className="px-3 pb-2 pt-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-primary/45 to-transparent" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {t('shell.adminSection')}
        </p>
        <div className="h-px flex-1 bg-gradient-to-l from-primary/45 to-transparent" />
      </div>
    </div>
  )
}
