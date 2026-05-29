import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, Users, ScrollText, Link2, Briefcase, Megaphone, DatabaseBackup, FolderOpen, LayoutDashboard, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { UserPermissionsTable } from '@/components/admin/user-permissions-table'
import { ModuleLinksManager } from '@/components/admin/module-links-manager'
import { RegisterClientButton } from '@/components/admin/register-client-button'
import { ClientDataManager } from '@/components/admin/client-data-manager'
import { AdminAnalytics } from '@/components/admin/admin-analytics'
import { AdminNotificationsManager } from '@/components/admin/admin-notifications-manager'
import { BackupManager } from '@/components/admin/backup-manager'
import { VaultAdminManager } from '@/components/admin/vault-admin-manager'
import { AdminTabs } from '@/components/admin/admin-tabs'
import { AdminOverview, AdminOverviewSkeleton } from '@/components/admin/admin-overview'
import { MaintenanceModePanel } from '@/components/admin/maintenance-mode-panel'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Suspense } from 'react'

interface AdminPageProps {
  searchParams: Promise<{ tab?: string; clientId?: string; moduleId?: string }>
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 h-40 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 h-48 animate-pulse" />
        <div className="bg-card border border-border rounded-2xl p-5 h-48 animate-pulse" />
      </div>
      <div className="bg-card border border-border rounded-2xl h-64 animate-pulse" />
    </div>
  )
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams
  const activeTab = params.tab === 'metricas' ? 'resumen' : (params.tab || 'usuarios')
  const clientId = params.clientId || undefined
  const moduleId = params.moduleId || undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
                <Image 
                  src="/logo-upcrop.png" 
                  alt="UpCrop Logo" 
                  width={24} 
                  height={24}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-[#4A6CF7]">UpCrop</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/auditoria"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4A6CF7]/15 border border-[#4A6CF7]/30 text-[#4A6CF7] hover:bg-[#4A6CF7] hover:text-white transition-colors"
              >
                <ScrollText className="w-4 h-4" />
                <span className="hidden sm:inline">Registro de Actividad</span>
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Suspense fallback={<div className="h-12 rounded-xl bg-secondary animate-pulse" />}>
          <AdminTabs defaultTab={activeTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-secondary h-auto gap-1 p-1">
            <TabsTrigger value="resumen" className="gap-2 text-xs sm:text-sm">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2 text-xs sm:text-sm">
              <Users className="w-4 h-4 shrink-0" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2 text-xs sm:text-sm">
              <Briefcase className="w-4 h-4 shrink-0" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="boveda" className="gap-2 text-xs sm:text-sm">
              <FolderOpen className="w-4 h-4 shrink-0" />
              Mis documentos
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-2 text-xs sm:text-sm">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Notificaciones</span>
              <span className="sm:hidden">Avisos</span>
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-2 text-xs sm:text-sm">
              <DatabaseBackup className="w-4 h-4 shrink-0" />
              Backups
            </TabsTrigger>
            <TabsTrigger value="enlaces" className="gap-2 text-xs sm:text-sm">
              <Link2 className="w-4 h-4 shrink-0" />
              Enlaces
            </TabsTrigger>
          </TabsList>

          {/* Tab: Resumen (sistema + uso) */}
          <TabsContent value="resumen" className="space-y-8">
            <MaintenanceModePanel />

            <Suspense fallback={<AdminOverviewSkeleton />}>
              <AdminOverview />
            </Suspense>

            <div className="border-t border-border pt-8 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-[#4A6CF7]" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Uso de la plataforma</h2>
                </div>
                <p className="text-sm text-muted-foreground ml-[52px]">
                  Actividad de clientes en los últimos 7 días: módulos, bóveda, exportaciones e inventario.
                </p>
              </div>
              <Suspense fallback={<AnalyticsSkeleton />}>
                <AdminAnalytics />
              </Suspense>
            </div>
          </TabsContent>

          {/* Tab: Usuarios */}
          <TabsContent value="usuarios" className="space-y-6">
            {/* Title */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
                    <Image 
                      src="/logo-upcrop.png" 
                      alt="UpCrop Logo" 
                      width={24} 
                      height={24}
                      className="object-contain"
                    />
                  </div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Gestión de Usuarios
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  Administra los permisos de acceso a módulos para cada usuario. La lista se actualiza en tiempo real.
                </p>
              </div>
              <RegisterClientButton />
            </div>

            {/* Users Table */}
            <UserPermissionsTable />
          </TabsContent>

          {/* Tab: Clientes (Datos y Gráficos) */}
          <TabsContent value="clientes" className="space-y-6">
            <ClientDataManager initialClientId={clientId} initialModuleId={moduleId} />
          </TabsContent>

          {/* Tab: Bóveda documental */}
          <TabsContent value="boveda" className="space-y-6">
            <VaultAdminManager />
          </TabsContent>

          {/* Tab: Notificaciones */}
          <TabsContent value="notificaciones" className="space-y-6">
            <AdminNotificationsManager />
          </TabsContent>

          {/* Tab: Backups */}
          <TabsContent value="backups" className="space-y-6">
            <BackupManager />
          </TabsContent>

          {/* Tab: Enlaces */}
          <TabsContent value="enlaces" className="space-y-6">
            {/* Title */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-[#4A6CF7]" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                Enlaces de Looker Studio
              </h1>
            </div>

            {/* Module Links Manager */}
            <ModuleLinksManager />
          </TabsContent>
          </AdminTabs>
        </Suspense>
      </main>
    </div>
  )
}
