'use client'

import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'
import { UpCropLogoMark } from '@/components/auth/login-form'
import { cn } from '@/lib/utils'

type LogoutOverlayProps = {
  visible: boolean
  exiting?: boolean
  userName?: string | null
  phase?: 'closing' | 'closed'
  /** Overlay ya visible: no repetir animación de entrada. */
  skipEntrance?: boolean
}

export function LogoutOverlay({
  visible,
  exiting = false,
  userName,
  phase = 'closing',
  skipEntrance = false,
}: LogoutOverlayProps) {
  if (!visible || typeof document === 'undefined') return null

  const displayName = userName?.trim() || null
  const title =
    phase === 'closed'
      ? 'Sesión cerrada'
      : displayName
        ? `Hasta pronto, ${displayName}`
        : 'Cerrando sesión'
  const subtitle =
    phase === 'closed'
      ? 'Redirigiendo al inicio de sesión…'
      : 'Tu sesión se cerrará de forma segura…'

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center bg-background backdrop-blur-md',
        !skipEntrance && !exiting && 'logout-overlay',
        skipEntrance && !exiting && 'logout-overlay-continuing',
        exiting && 'logout-overlay-exit',
      )}
      role="status"
      aria-live="polite"
      aria-label="Cerrando sesión"
    >
      <div
        className={cn(
          'flex max-w-sm flex-col items-center px-6 text-center',
          !skipEntrance && !exiting && 'logout-overlay-panel',
          skipEntrance && !exiting && 'logout-overlay-panel-continuing',
          exiting && 'logout-overlay-panel-exit',
        )}
      >
        <UpCropLogoMark size="md" className="mb-6 opacity-90" />

        <div className="relative mb-5">
          <span
            className={cn(
              'pointer-events-none absolute inset-0 rounded-full bg-primary/20',
              !skipEntrance && !exiting && 'logout-overlay-ring',
            )}
            aria-hidden
          />
          <div
            className={cn(
              'relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/10',
              !skipEntrance && !exiting && 'logout-overlay-icon-wrap',
            )}
          >
            <LogOut className="h-9 w-9 text-primary" strokeWidth={2} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>,
    document.body,
  )
}
