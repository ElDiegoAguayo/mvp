import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CostosTabNav } from '@/components/dashboard/costos-y-gastos/costos-tab-nav'
import { userCanAccessCostosGastos } from '@/lib/dashboard/costos-access'
import { Receipt } from 'lucide-react'

export default async function CostosYGastosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const hasAccess = await userCanAccessCostosGastos()
  if (!hasAccess) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Costos y Gastos
          </h1>
          <p className="text-sm text-muted-foreground">
            Libro de Compras SII · clasificación y análisis de costos
          </p>
        </div>
      </div>

      <CostosTabNav />

      {children}
    </div>
  )
}
