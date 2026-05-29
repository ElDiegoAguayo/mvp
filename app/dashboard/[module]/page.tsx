import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldAlert, ArrowLeft, AlertTriangle } from 'lucide-react'
import { getModuleIcon } from '@/lib/module-icons'
import { ModuleDataView } from '@/components/dashboard/module-data-view'
import { resolveModuleHref } from '@/lib/dashboard/module-routes'
import { userCanAccessModule } from '@/lib/dashboard/module-access'

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
      return <AccessDenied reason="missing" />
    }

    const canonicalHref = resolveModuleHref(slug, moduleRow.name)
    if (canonicalHref !== `/dashboard/${slug}`) {
      redirect(canonicalHref)
    }

    const hasAccess = await userCanAccessModule(supabase, user.id, moduleRow.id)
    if (!hasAccess) {
      return <AccessDenied reason="forbidden" moduleName={moduleRow.name} />
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
    return <AccessDenied reason="error" errorMessage="Error interno del servidor" />
  }
}

function AccessDenied({
  reason,
  moduleName,
  errorMessage,
}: {
  reason: 'missing' | 'forbidden' | 'error'
  moduleName?: string
  errorMessage?: string
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
          {reason === 'error' ? (
            <AlertTriangle className="w-7 h-7 text-destructive" />
          ) : (
            <ShieldAlert className="w-7 h-7 text-destructive" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {reason === 'error' ? 'Error' : 'Acceso Denegado'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {reason === 'missing'
            ? 'El módulo solicitado no existe o ha sido deshabilitado.'
            : reason === 'forbidden'
              ? `No tienes permisos para acceder al módulo "${moduleName}". Contacta al administrador si crees que es un error.`
              : errorMessage || 'Ocurrió un error inesperado.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
