'use client'

import { clearViewAsCookieAction } from '@/app/admin/impersonation-actions'
import { logLogoutAction } from '@/app/auth/logout-actions'
import { mountPersistentLogoutOverlay } from '@/components/auth/logout-persistent-overlay'
import { beginLogoutTransition } from '@/lib/auth/logout-transition'
import { createClient } from '@/lib/supabase/client'
import { setClientViewAsUserId } from '@/lib/supabase/effective-user'
import { useLocale } from '@/components/i18n/locale-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'

const LOGOUT_HOLD_MS = 1950

type LogoutButtonProps = {
  userName?: string | null
  className?: string
  compact?: boolean
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function LogoutButton({ userName, className, compact = false }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useLocale()

  const handleLogout = async () => {
    if (isLoading) return
    setIsLoading(true)

    const reducedMotion = prefersReducedMotion()

    try {
      beginLogoutTransition({ userName })
      mountPersistentLogoutOverlay(userName)

      if (!reducedMotion) {
        await sleep(LOGOUT_HOLD_MS)
      }

      await logLogoutAction()
      await clearViewAsCookieAction()
      setClientViewAsUserId(null)
      const supabase = createClient()
      await supabase.auth.signOut()

      router.replace('/auth/login')
      router.refresh()
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={() => void handleLogout()}
      variant="outline"
      size={compact ? 'icon' : 'sm'}
      disabled={isLoading}
      title={compact ? (isLoading ? t('auth.loggingOut') : t('auth.logout')) : undefined}
      className={
        className ??
        (compact
          ? 'h-9 w-9 border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
          : 'w-full border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30')
      }
    >
      <LogOut className={cn('h-4 w-4', !compact && 'mr-2')} />
      {!compact && <span>{isLoading ? t('auth.loggingOut') : t('auth.logout')}</span>}
    </Button>
  )
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
