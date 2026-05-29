import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { getDashboardLayoutAsync } from '@/lib/dashboard/get-layout-server'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  const fullName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Usuario'

  // The server-side getDashboardLayoutAsync already filters widgets based on the user's access to the "inicio" module.
  const { widgets } = await getDashboardLayoutAsync(supabase, user.id)

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">
          Bienvenido a Up <span className="text-primary">Crop</span>,{' '}
          <span className="text-primary">{fullName}</span>
        </h1>
        <p className="text-muted-foreground">
          Monitorea tus operaciones agrícolas y recibe alertas en tiempo real.
        </p>
      </div>

      {/* Dynamic Layout Renderer — "Inicio" access is already enforced server-side via module permissions */}
      <DashboardLayout widgets={widgets} />
    </>
  )
}
