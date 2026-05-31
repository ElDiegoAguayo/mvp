'use client'

import { useLayoutEffect, useState } from 'react'
import {
  clearLogoutTransition,
  hasLogoutTransition,
  readLogoutTransition,
} from '@/lib/auth/logout-transition'
import {
  dismissPersistentLogoutOverlay,
  isPersistentLogoutOverlayMounted,
  mountPersistentLogoutOverlay,
  teardownPersistentLogoutOverlayImmediate,
} from '@/components/auth/logout-persistent-overlay'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** En login: retira el overlay ya visible (sin volver a montarlo). */
export function LogoutTransitionFinish() {
  const [active] = useState(() =>
    typeof window !== 'undefined' ? hasLogoutTransition() : false,
  )

  useLayoutEffect(() => {
    if (!active) return

    const payload = readLogoutTransition()

    if (!isPersistentLogoutOverlayMounted()) {
      mountPersistentLogoutOverlay(payload?.userName, { skipEntrance: true })
    }

    if (prefersReducedMotion()) {
      clearLogoutTransition()
      teardownPersistentLogoutOverlayImmediate()
      return
    }

    const revealTimer = window.setTimeout(() => {
      void dismissPersistentLogoutOverlay().then(() => {
        clearLogoutTransition()
      })
    }, 280)

    return () => {
      window.clearTimeout(revealTimer)
    }
  }, [active])

  return null
}
