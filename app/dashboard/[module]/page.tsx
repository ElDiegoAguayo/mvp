import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getModuleIcon } from '@/lib/module-icons'
import { ModuleDataView } from '@/components/dashboard/module-data-view'
import { resolveModuleHref } from '@/lib/dashboard/module-routes'
import { userCanAccessModule } from '@/lib/dashboard/module-access'
import { DynamicModuleAccessDenied } from '@/components/dashboard/dynamic-module-access-denied'

export const dynamic = 'force-dynamic'

interface ModuleRow {
  id: string
  slug: string
  name: string
  icon: string
  description: string | null
  is_active: boolean
}

export default async function DynamicModulePage({
  params,
}: {
  params: Promise<{ module: string }>
}) {
  try {
    const { module: slug } = await params
    const supabase = await createClient()

    if (slug === 'inicio') {
      redirect('/dashboard')
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[v0] Auth error in dynamic module page:', authError.message)
    }

    if (!user) redirect('/auth/login')

    const { data: moduleData } = await supabase
      .from('modules')
      .select('id, slug, name, icon, description, is_active')
      .eq('slug', slug)
      .maybeSingle()

    const moduleRow = moduleData as ModuleRow | null

    if (!moduleRow || !moduleRow.is_active) {
      return <DynamicModuleAccessDenied reason="missing" />
    }

    const canonicalHref = resolveModuleHref(slug, moduleRow.name)
    if (canonicalHref !== `/dashboard/${slug}`) {
      redirect(canonicalHref)
    }

    const hasAccess = await userCanAccessModule(supabase, user.id, moduleRow.id)
    if (!hasAccess) {
      return <DynamicModuleAccessDenied reason="forbidden" moduleName={moduleRow.name} />
    }

    const Icon = getModuleIcon(moduleRow.icon)

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 mb-6 px-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{moduleRow.name}</h1>
              {moduleRow.description && (
                <p className="text-sm text-muted-foreground">{moduleRow.description}</p>
              )}
            </div>
          </div>
        </div>

        <ModuleDataView
          moduleId={moduleRow.id}
          moduleName={moduleRow.name}
          moduleSlug={slug}
          moduleDescription={moduleRow.description}
        />
      </div>
    )
  } catch (error) {
    console.error('[v0] Unexpected error in dynamic module page:', error)
    return (
      <DynamicModuleAccessDenied
        reason="error"
        errorMessage="common.errors.internalServer"
      />
    )
  }
}
