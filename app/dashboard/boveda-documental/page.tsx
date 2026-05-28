import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentVault } from '@/components/dashboard/document-vault'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { FolderLock } from 'lucide-react'

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FolderLock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mis documentos</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona y almacena tus documentos de forma segura.
            </p>
          </div>
        </div>
      </div>

      <DocumentVault />
    </>
  )
}
