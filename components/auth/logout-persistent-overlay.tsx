'use client'

import { createRoot, type Root } from 'react-dom/client'
import { LogoutOverlay } from '@/components/auth/logout-overlay'

const ROOT_ID = 'upcrop-logout-overlay-root'
const EXIT_MS = 520

let reactRoot: Root | null = null
let activeUserName: string | null | undefined = undefined

function getContainer(): HTMLDivElement {
  let container = document.getElementById(ROOT_ID) as HTMLDivElement | null
  if (!container) {
    container = document.createElement('div')
    container.id = ROOT_ID
    document.body.appendChild(container)
  }
  return container
}

export function isPersistentLogoutOverlayMounted(): boolean {
  return reactRoot !== null
}

type MountOptions = {
  /** Sin animación de entrada (overlay ya visible o remount en login). */
  skipEntrance?: boolean
}

export function mountPersistentLogoutOverlay(
  userName?: string | null,
  options?: MountOptions,
) {
  if (typeof document === 'undefined') return
  activeUserName = userName
  const container = getContainer()
  if (!reactRoot) {
    reactRoot = createRoot(container)
  }
  reactRoot.render(
    <LogoutOverlay
      visible
      userName={userName}
      phase="closing"
      skipEntrance={options?.skipEntrance}
    />,
  )
}

export function dismissPersistentLogoutOverlay(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !reactRoot) {
      resolve()
      return
    }

    reactRoot.render(
      <LogoutOverlay
        visible
        exiting
        userName={activeUserName}
        phase="closing"
        skipEntrance
      />,
    )

    window.setTimeout(() => {
      reactRoot?.unmount()
      reactRoot = null
      activeUserName = undefined
      document.getElementById(ROOT_ID)?.remove()
      resolve()
    }, EXIT_MS)
  })
}

export function teardownPersistentLogoutOverlayImmediate() {
  if (typeof document === 'undefined') return
  reactRoot?.unmount()
  reactRoot = null
  activeUserName = undefined
  document.getElementById(ROOT_ID)?.remove()
}
