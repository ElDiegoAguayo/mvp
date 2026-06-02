'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  FileText,
  FlaskConical,
  Package,
  Warehouse,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

const TABS = [
  { href: '/dashboard/inventario-fitosanitario/stock', labelKey: 'fitosanitario.tabs.stock', icon: Package },
  { href: '/dashboard/inventario-fitosanitario/movimientos', labelKey: 'fitosanitario.tabs.movements', icon: ArrowLeftRight },
  { href: '/dashboard/inventario-fitosanitario/facturas', labelKey: 'fitosanitario.tabs.invoices', icon: FileText },
  { href: '/dashboard/inventario-fitosanitario/programa', labelKey: 'fitosanitario.tabs.program', icon: CalendarDays },
  { href: '/dashboard/inventario-fitosanitario/analisis', labelKey: 'fitosanitario.tabs.analytics', icon: BarChart3 },
  { href: '/dashboard/inventario-fitosanitario/comparador', labelKey: 'fitosanitario.tabs.comparator', icon: BarChart3 },
  { href: '/dashboard/inventario-fitosanitario/bodegas', labelKey: 'fitosanitario.tabs.warehouses', icon: Warehouse },
  { href: '/dashboard/inventario-fitosanitario/productos', labelKey: 'fitosanitario.tabs.products', icon: FlaskConical },
] as const

export function FitosanitarioTabNav() {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {TABS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
