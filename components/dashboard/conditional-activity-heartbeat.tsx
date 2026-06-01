'use client'

import { usePathname } from 'next/navigation'
import { ActivityHeartbeat } from '@/components/dashboard/activity-heartbeat'

/** Skip auth routes so invite/magic-link hashes are not consumed before callback handling. */
export function ConditionalActivityHeartbeat() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/auth/')) return null
  return <ActivityHeartbeat />
}
