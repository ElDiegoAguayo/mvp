import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FitosanitarioPageHeader } from '@/components/dashboard/fitosanitario/fitosanitario-page-header'
import { FitosanitarioTabNav } from '@/components/dashboard/fitosanitario/fitosanitario-tab-nav'
import { userCanAccessFitosanitario } from '@/lib/dashboard/fitosanitario-access'

export default async function InventarioFitosanitarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const hasAccess = await userCanAccessFitosanitario()
  if (!hasAccess) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <FitosanitarioPageHeader />
      <FitosanitarioTabNav />
      {children}
    </div>
  )
}
