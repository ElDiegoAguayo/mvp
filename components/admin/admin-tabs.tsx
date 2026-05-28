'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'

interface AdminTabsProps {
  defaultTab: string
  children: React.ReactNode
}

export function AdminTabs({ defaultTab, children }: AdminTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? defaultTab

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    // Preserve clientId/moduleId only on clientes tab
    if (value !== 'clientes') {
      params.delete('clientId')
      params.delete('moduleId')
    }
    router.replace(`/admin?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      {children}
    </Tabs>
  )
}
