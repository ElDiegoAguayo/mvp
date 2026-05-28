'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Activity heartbeat for presence tracking.
 * - Updates `profiles.last_activity_at` on any user interaction while the tab is visible
 * - Throttles writes to once every THROTTLE_MS
 * - While active, runs a periodic heartbeat every HEARTBEAT_MS
 * - Pauses when the page is hidden or the window blurs
 */
export function ActivityHeartbeat() {
  const lastPingRef = useRef<number>(0)
  const heartbeatIntervalRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)
  const isActiveRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    isMountedRef.current = true
    let hasSession = false
    let listenersAttached = false

    const THROTTLE_MS = 8_000  // min ms between DB writes
    const HEARTBEAT_MS = 30_000 // periodic while active

    const doPing = async () => {
      if (!isMountedRef.current || !hasSession) return
      const now = Date.now()
      if (now - lastPingRef.current < THROTTLE_MS) return
      lastPingRef.current = now

      try {
        // Use RPC with SECURITY DEFINER to bypass RLS
        const { error } = await supabase.rpc('update_last_activity')
        if (error) {
          console.warn('[heartbeat] RPC error, falling back to direct update:', error.message)
          // Fallback: direct update (works if RLS allows it)
          const userRes = await supabase.auth.getUser()
          const user = userRes?.data?.user
          if (!user) return
          const { error: fallbackError } = await supabase
            .from('profiles')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', user.id)
          if (fallbackError) console.warn('[heartbeat] fallback error:', fallbackError.message)
          else console.log('[heartbeat] fallback OK at', new Date().toLocaleTimeString())
        } else {
          console.log('[heartbeat] ping OK at', new Date().toLocaleTimeString())
        }
      } catch (err) {
        console.error('[heartbeat] exception:', err)
      }
    }

    const startHeartbeat = () => {
      if (heartbeatIntervalRef.current != null) return
      heartbeatIntervalRef.current = window.setInterval(() => {
        doPing()
      }, HEARTBEAT_MS)
    }

    const stopHeartbeat = () => {
      if (heartbeatIntervalRef.current != null) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }

    const markActive = () => {
      if (!isMountedRef.current || !hasSession) return
      isActiveRef.current = true
      doPing()
      startHeartbeat()
    }

    const markInactive = () => {
      isActiveRef.current = false
      stopHeartbeat()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        markActive()
      } else {
        markInactive()
      }
    }

    const onFocus = () => markActive()
    const onBlur = () => markInactive()

    const activityEvents: Array<keyof DocumentEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ]

    const addActivityListeners = () => {
      activityEvents.forEach((ev) => document.addEventListener(ev, markActive, { passive: true }))
      window.addEventListener('focus', onFocus)
      window.addEventListener('blur', onBlur)
      document.addEventListener('visibilitychange', onVisibility)
    }

    const removeActivityListeners = () => {
      activityEvents.forEach((ev) => document.removeEventListener(ev, markActive))
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }

    const startTracking = () => {
      if (!listenersAttached) {
        addActivityListeners()
        listenersAttached = true
      }
      if (document.visibilityState === 'visible') {
        markActive()
      }
    }

    const stopTracking = () => {
      markInactive()
      if (listenersAttached) {
        removeActivityListeners()
        listenersAttached = false
      }
    }

    const bootstrap = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!isMountedRef.current) return
      hasSession = !!user
      if (hasSession) startTracking()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) return
      const nextHasSession = !!session?.user
      if (nextHasSession === hasSession) return
      hasSession = nextHasSession
      if (hasSession) startTracking()
      else stopTracking()
    })

    if (typeof document !== 'undefined') {
      bootstrap()
    }

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
      stopTracking()
    }
  }, [])

  return null
}
