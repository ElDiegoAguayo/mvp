import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ViewAsProvider } from '@/components/dashboard/view-as-provider'
import { SupportModeBanner } from '@/components/dashboard/support-mode-banner'
import { getViewAsContext, VIEW_AS_COOKIE } from '@/lib/impersonation'
import { compareModulesByAreaThenName } from '@/lib/modules/areas'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.is_active === false) {
    await supabase.auth.signOut()
    const cookieStore = await cookies()
    cookieStore.delete(VIEW_AS_COOKIE)
    redirect('/auth/login?blocked=1')
  }

  const viewAs = await getViewAsContext()
  const isSupportMode = !!viewAs.viewAsUserId

  const moduleAccessUserId = viewAs.viewAsUserId ?? user.id

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('parent_user_id')
    .eq('id', moduleAccessUserId)
    .maybeSingle()

  const { data: userAccessData } = await supabase
    .from('user_module_access')
    .select('module_id, enabled, display_order')
    .eq('user_id', moduleAccessUserId)
    .eq('enabled', true)

  let enabledModuleIds = (userAccessData ?? []).map((a) => a.module_id)

  // Subusers only see modules enabled for them AND active on the parent account.
  if (viewerProfile?.parent_user_id) {
    const { data: parentAccessData } = await supabase
      .from('user_module_access')
      .select('module_id')
      .eq('user_id', viewerProfile.parent_user_id)
      .eq('enabled', true)

    const parentModuleIds = new Set((parentAccessData ?? []).map((a) => a.module_id))
    enabledModuleIds = enabledModuleIds.filter((id) => parentModuleIds.has(id))
  }
  const moduleOrderMap = new Map(
    (userAccessData ?? []).map((row) => [row.module_id, row.display_order ?? 0]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allowedModules: any[] = []

  if (enabledModuleIds.length > 0) {
    let modulesData: unknown[] | null = null

    const { data: d1, error: e1 } = await supabase
      .from('modules')
      .select('id, slug, name, icon, color, text_color, icon_shape, description, area_id, area:module_areas(id, name, display_order)')
      .eq('is_active', true)
      .in('id', enabledModuleIds)
      .order('created_at', { ascending: true })

    if (!e1) {
      modulesData = d1
    } else {
      const { data: d2, error: e2 } = await supabase
        .from('modules')
        .select('id, slug, name, icon, color, text_color, icon_shape, description, area_id')
        .eq('is_active', true)
        .in('id', enabledModuleIds)
        .order('created_at', { ascending: true })
      if (!e2) {
        modulesData = d2
      } else {
        const { data: d3 } = await supabase
          .from('modules')
          .select('id, slug, name, icon, description')
          .eq('is_active', true)
          .in('id', enabledModuleIds)
          .order('created_at', { ascending: true })
        modulesData = d3
      }
    }

    allowedModules = (modulesData ?? [])
      .filter((m: { slug?: string }) => m.slug !== 'inicio')
      .sort((a: any, b: any) => compareModulesByAreaThenName(a, b, moduleOrderMap))
  }

  // In support mode, show target client identity in the shell sidebar
  let shellUser = {
    id: profile?.id ?? user.id,
    email: profile?.email ?? user.email ?? null,
    full_name:
      profile?.full_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Usuario',
    role: profile?.role ?? 'user',
    avatar_url: profile?.avatar_url ?? null,
  }

  if (isSupportMode && viewAs.viewAsUserId) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', viewAs.viewAsUserId)
      .single()

    if (targetProfile) {
      shellUser = {
        id: targetProfile.id,
        email: targetProfile.email,
        full_name: targetProfile.full_name || targetProfile.email?.split('@')[0] || 'Cliente',
        role: 'user',
        avatar_url: targetProfile.avatar_url ?? null,
      }
    }
  }

  return (
    <ViewAsProvider viewAsUserId={viewAs.viewAsUserId}>
      <DashboardShell
        user={shellUser}
        modules={allowedModules}
        isSupportMode={isSupportMode}
        adminRole={profile?.role === 'admin'}
        supportBanner={
          isSupportMode ? (
            <SupportModeBanner
              targetName={viewAs.viewAsName || shellUser.full_name}
              targetEmail={viewAs.viewAsEmail}
            />
          ) : null
        }
      >
        {children}
      </DashboardShell>
    </ViewAsProvider>
  )
}
