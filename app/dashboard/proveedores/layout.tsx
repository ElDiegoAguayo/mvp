import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProveedoresPageHeader } from '@/components/dashboard/proveedores/proveedores-page-header'
import { ProveedoresTabNav } from '@/components/dashboard/proveedores/proveedores-tab-nav'
import { userCanAccessProveedores } from '@/lib/dashboard/proveedores-access'

export default async function ProveedoresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const hasAccess = await userCanAccessProveedores()
  if (!hasAccess) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <ProveedoresPageHeader />
      <ProveedoresTabNav />
      {children}
    </div>
  )
}
