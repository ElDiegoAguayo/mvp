import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ScrollText, Shield } from 'lucide-react'
import { AuditLogTable } from '@/components/admin/audit-log-table'
import { SecurityDashboard } from '@/components/admin/security-dashboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AuditPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AuditLogPage({ searchParams }: AuditPageProps) {
  const params = await searchParams
  const activeTab = params.tab || 'actividad'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
                <Image src="/logo-upcrop.png" alt="UpCrop Logo" width={24} height={24} className="object-contain" />
              </div>
              <span className="text-xl font-bold text-[#4A6CF7]">UpCrop</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">Admin</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">Actividad & Seguridad</span>
            </div>
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue={activeTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="actividad" className="gap-2">
              <ScrollText className="w-4 h-4" />
              Registro de Actividad
            </TabsTrigger>
            <TabsTrigger value="seguridad" className="gap-2">
              <Shield className="w-4 h-4" />
              Seguridad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actividad" className="space-y-6">
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
                  <ScrollText className="w-5 h-5 text-[#4A6CF7]" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Registro de Actividad</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-13">
                Historial completo de acciones de administración. Se actualiza en tiempo real.
              </p>
            </div>
            <AuditLogTable />
          </TabsContent>

          <TabsContent value="seguridad" className="space-y-6">
            <SecurityDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
