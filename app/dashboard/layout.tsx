import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ViewAsProvider } from '@/components/dashboard/view-as-provider'
import { SupportModeBanner } from '@/components/dashboard/support-mode-banner'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { getViewAsContext } from '@/lib/impersonation'

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
    redirect('/auth/login?blocked=1')
  }

  const viewAs = await getViewAsContext()
  const isSupportMode = !!viewAs.viewAsUserId

  const { effectiveUserId } = await getEffectiveUserId(
    supabase,
    viewAs.viewAsUserId ?? undefined,
  )

  let accessUserIds: string[]
  if (viewAs.viewAsUserId) {
    accessUserIds =
      effectiveUserId && effectiveUserId !== viewAs.viewAsUserId
        ? [viewAs.viewAsUserId, effectiveUserId]
        : [viewAs.viewAsUserId]
  } else {
    accessUserIds =
      effectiveUserId && effectiveUserId !== user.id
        ? [user.id, effectiveUserId]
        : [user.id]
  }

  // Get modules that user has access to via user_module_access table
  const { data: userAccessData } = await supabase
    .from('user_module_access')
    .select('module_id, enabled, display_order')
    .in('user_id', accessUserIds)
    .eq('enabled', true)

  const enabledModuleIds = (userAccessData ?? []).map((a) => a.module_id)
  const moduleOrderMap = new Map(
    (userAccessData ?? []).map((row) => [row.module_id, row.display_order ?? 0]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allowedModules: any[] = []

  if (enabledModuleIds.length > 0) {
    let modulesData: unknown[] | null = null

    const { data: d1, error: e1 } = await supabase
      .from('modules')
      .select('id, slug, name, icon, color, text_color, icon_shape, description')
      .eq('is_active', true)
      .in('id', enabledModuleIds)
      .order('created_at', { ascending: true })

    if (!e1) {
      modulesData = d1
    } else {
      const { data: d2 } = await supabase
        .from('modules')
        .select('id, slug, name, icon, description')
        .eq('is_active', true)
        .in('id', enabledModuleIds)
        .order('created_at', { ascending: true })
      modulesData = d2
    }

    allowedModules = (modulesData ?? [])
      .filter((m: { slug?: string }) => m.slug !== 'inicio')
      .sort((a: any, b: any) => {
      const orderA = moduleOrderMap.get(a.id) ?? 0
      const orderB = moduleOrderMap.get(b.id) ?? 0
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
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
