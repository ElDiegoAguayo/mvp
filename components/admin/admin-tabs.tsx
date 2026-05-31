'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import { AdminUnsavedChangesProvider, useAdminNavigationGuard } from '@/components/admin/unsaved-changes-provider'

interface AdminTabsProps {
  defaultTab: string
  children: React.ReactNode
}

function AdminTabsInner({ defaultTab, children }: AdminTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? defaultTab
  const confirmNavigation = useAdminNavigationGuard()

  function handleTabChange(value: string) {
    if (value === activeTab) return
    confirmNavigation(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', value)
      if (value !== 'clientes') {
        params.delete('clientId')
        params.delete('moduleId')
      }
      router.replace(`/admin?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      {children}
    </Tabs>
  )
}

export function AdminTabs({ defaultTab, children }: AdminTabsProps) {
  return (
    <AdminUnsavedChangesProvider>
      <AdminTabsInner defaultTab={defaultTab}>{children}</AdminTabsInner>
    </AdminUnsavedChangesProvider>
  )
}
