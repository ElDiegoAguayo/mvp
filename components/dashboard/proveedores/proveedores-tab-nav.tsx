'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, FileText, Receipt } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

const TABS = [
  {
    href: '/dashboard/proveedores/empresas',
    labelKey: 'proveedores.tabs.companies',
    icon: Building2,
  },
  {
    href: '/dashboard/proveedores/cotizaciones',
    labelKey: 'proveedores.tabs.quotations',
    icon: FileText,
  },
  {
    href: '/dashboard/proveedores/facturas',
    labelKey: 'proveedores.tabs.invoices',
    icon: Receipt,
  },
] as const

export function ProveedoresTabNav() {
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
