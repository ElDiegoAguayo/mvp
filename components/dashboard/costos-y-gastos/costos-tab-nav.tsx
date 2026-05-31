'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, BarChart3 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

const TABS = [
  {
    href: '/dashboard/costos-y-gastos/clasificacion',
    labelKey: 'costosGastos.tabs.clasificacion',
    icon: Building2,
  },
  {
    href: '/dashboard/costos-y-gastos/centro-de-costos',
    labelKey: 'costosGastos.tabs.centroDeCostos',
    icon: BarChart3,
  },
] as const

export function CostosTabNav() {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {TABS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
