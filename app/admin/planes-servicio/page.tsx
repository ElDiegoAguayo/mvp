import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { listClientServicePlansAction } from '@/app/admin/actions'
import { ServicePlansClientsManager } from '@/components/admin/service-plans-clients-manager'
import { BrandWordmark, brandLogoImageClass } from '@/components/brand/brand-wordmark'
import { Button } from '@/components/ui/button'

export default async function AdminServicePlansPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const clients = await listClientServicePlansAction()

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-primary/10">
              <Image
                src="/logo-upcrop.png"
                alt="Up Crop"
                width={24}
                height={24}
                className={brandLogoImageClass}
              />
            </div>
            <BrandWordmark className="text-xl" />
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="hidden font-medium text-foreground sm:inline">Admin</span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-medium text-foreground">Planes de servicio</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin?tab=usuarios">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Panel admin
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ServicePlansClientsManager initialClients={clients} />
      </main>
    </div>
  )
}
