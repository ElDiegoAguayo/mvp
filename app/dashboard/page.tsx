import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { getDashboardLayoutAsync } from '@/lib/dashboard/get-layout-server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import { DashboardHomeHeader } from '@/components/dashboard/dashboard-home-header'
import { isTechInspectorProfile } from '@/lib/tech-assistance/roles'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { userId: actingUserId } = await getEffectiveUserId(supabase)
  const effectiveUserId = actingUserId ?? user.id

  const { data: actingProfile } = await supabase
    .from('profiles')
    .select('is_tech_inspector, parent_user_id')
    .eq('id', effectiveUserId)
    .single()

  if (isTechInspectorProfile(actingProfile)) {
    redirect('/dashboard/asistencia-tecnica')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', effectiveUserId)
    .single()

  const fullName =
    profile?.full_name ||
    profile?.email?.split('@')[0] ||
    'Usuario'

  const { widgets } = await getDashboardLayoutAsync(supabase, effectiveUserId)

  return (
    <>
      <DashboardHomeHeader fullName={fullName} />
      <DashboardLayout widgets={widgets} />
    </>
  )
}
