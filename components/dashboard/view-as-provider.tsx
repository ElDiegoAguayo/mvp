'use client'

import { useEffect } from 'react'
import { setClientViewAsUserId } from '@/lib/supabase/effective-user'

/** Syncs server view-as cookie into client getEffectiveUserId override. */
export function ViewAsProvider({
  viewAsUserId,
  children,
}: {
  viewAsUserId: string | null
  children: React.ReactNode
}) {
  useEffect(() => {
    setClientViewAsUserId(viewAsUserId)
    return () => setClientViewAsUserId(null)
  }, [viewAsUserId])

  return <>{children}</>
}
