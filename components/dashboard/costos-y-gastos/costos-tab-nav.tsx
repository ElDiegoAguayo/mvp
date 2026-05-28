'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, BarChart3 } from 'lucide-react'

const TABS = [
  {
    href: '/dashboard/costos-y-gastos/clasificacion',
    label: 'Clasificación de Gastos',
    icon: Building2,
  },
  {
    href: '/dashboard/costos-y-gastos/centro-de-costos',
    label: 'Centro de Costos',
    icon: BarChart3,
  },
]

export function CostosTabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {TABS.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
