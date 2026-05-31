import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Database, ChevronRight } from 'lucide-react'
import { DataEditor } from '@/components/admin/data-editor'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ tableId: string }>
}

export default async function TableDataPage({ params }: Props) {
  const { tableId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get table info with module and client info for breadcrumb
  const { data: table } = await supabase
    .from('dynamic_tables')
    .select(`
      name, 
      module_id,
      user_id,
      modules:module_id(name),
      profiles:user_id(full_name, email)
    `)
    .eq('id', tableId)
    .single()

  const moduleName = (table?.modules as { name: string } | null)?.name || 'Módulo'
  const clientName = (table?.profiles as { full_name: string | null; email: string } | null)?.full_name || 
                     (table?.profiles as { full_name: string | null; email: string } | null)?.email || 
                     'Cliente'

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-9 h-9 rounded-lg bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center overflow-hidden">
                <Image 
                  src="/logo-upcrop.png" 
                  alt="Up Crop" 
                  width={24} 
                  height={24}
                  className="object-contain"
                />
              </div>
              <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors hidden sm:inline">
                Admin
              </Link>
              <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:inline" />
              <span className="text-muted-foreground hidden md:inline">{clientName}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground hidden md:inline" />
              <span className="text-muted-foreground hidden lg:inline">{moduleName}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground hidden lg:inline" />
              <span className="text-foreground font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                {table?.name || 'Tabla'}
              </span>
            </div>
            <Link
              href={`/admin?tab=clientes&clientId=${table?.user_id || ''}&moduleId=${table?.module_id || ''}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al Módulo</span>
              <span className="sm:hidden">Volver</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DataEditor tableId={tableId} />
      </main>
    </div>
  )
}
