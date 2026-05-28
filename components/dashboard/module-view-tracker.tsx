'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit-log'

interface ModuleViewTrackerProps {
  moduleId: string
  moduleSlug: string
  moduleName: string
}

/** Logs a MODULE_VIEW audit event once per mount (throttled per session). */
export function ModuleViewTracker({ moduleId, moduleSlug, moduleName }: ModuleViewTrackerProps) {
  const supabase = useMemo(() => createClient(), [])
  const loggedRef = useRef(false)

  useEffect(() => {
    if (loggedRef.current || !moduleId) return

    const key = `module-view:${moduleId}`
    const last = sessionStorage.getItem(key)
    const now = Date.now()
    if (last && now - Number(last) < 15 * 60 * 1000) return

    loggedRef.current = true
    sessionStorage.setItem(key, String(now))

    void logAudit(supabase, {
      action_type: 'MODULE_VIEW',
      description: `Visitó módulo "${moduleName}"`,
      target_type: 'module',
      target_id: moduleId,
      target_label: moduleName,
      metadata: { module_slug: moduleSlug, module_name: moduleName },
    })
  }, [supabase, moduleId, moduleSlug, moduleName])

  return null
}
