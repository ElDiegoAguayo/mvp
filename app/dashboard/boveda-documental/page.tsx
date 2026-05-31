import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentVault } from '@/components/dashboard/document-vault'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { VaultPageHeader } from '@/components/dashboard/vault-page-header'

export const dynamic = 'force-dynamic'

export default async function BovedaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Verify user has access to boveda-documental module
  const { data: access } = await supabase
    .from('user_module_access')
    .select('enabled, modules:module_id (slug)')
    .eq('user_id', user.id)
    .eq('enabled', true)

  type AccessRow = { enabled: boolean; modules: { slug: string } | null }
  const hasAccess = ((access ?? []) as unknown as AccessRow[]).some(
    (a) => a.modules?.slug === 'boveda-documental',
  )

  if (!hasAccess) {
    redirect('/dashboard')
  }

  const { data: bovedaModule } = await supabase
    .from('modules')
    .select('id, name, slug')
    .eq('slug', 'boveda-documental')
    .maybeSingle()

  return (
    <>
      {bovedaModule && (
        <ModuleViewTracker
          moduleId={bovedaModule.id}
          moduleSlug={bovedaModule.slug}
          moduleName={bovedaModule.name}
        />
      )}
      <VaultPageHeader />

      <DocumentVault />
    </>
  )
}
