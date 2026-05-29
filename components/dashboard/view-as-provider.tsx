'use client'

import { createContext, useContext, useEffect } from 'react'
import { setClientViewAsUserId } from '@/lib/supabase/effective-user'

const ViewAsContext = createContext<string | null>(null)

export function useViewAsUserId() {
  return useContext(ViewAsContext)
}

/** Syncs server view-as cookie into client getEffectiveUserId override. */
export function ViewAsProvider({
  viewAsUserId,
  children,
}: {
  viewAsUserId: string | null
  children: React.ReactNode
}) {
  // Disponible antes de effects hijos (modo soporte)
  setClientViewAsUserId(viewAsUserId)

  useEffect(() => {
    setClientViewAsUserId(viewAsUserId)
    return () => setClientViewAsUserId(null)
  }, [viewAsUserId])

  return (
    <ViewAsContext.Provider value={viewAsUserId}>
      {children}
    </ViewAsContext.Provider>
  )
}
