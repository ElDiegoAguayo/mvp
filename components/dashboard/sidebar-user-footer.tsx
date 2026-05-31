'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'

interface SidebarUserFooterProps {
  user: {
    full_name: string
    email: string | null
    avatar_url?: string | null
  }
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarUserFooter({ user, collapsed = false, onNavigate }: SidebarUserFooterProps) {
  const pathname = usePathname()
  const { t } = useLocale()
  const profileActive = pathname === '/dashboard/perfil' || pathname.startsWith('/dashboard/perfil/')

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/dashboard/perfil"
          onClick={onNavigate}
          title={t('shell.myProfile')}
          className={cn(
            'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition-colors',
            profileActive
              ? 'border-primary/40 bg-primary/15'
              : 'border-primary/20 bg-primary/10 hover:bg-primary/20',
          )}
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-primary">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
        <LogoutButton userName={user.full_name} compact />
      </div>
    )
  }

  return (
    <>
      <Link
        href="/dashboard/perfil"
        onClick={onNavigate}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors',
          profileActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-primary/10 text-xs font-semibold text-primary">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </Link>
      <div className="mt-2">
        <LogoutButton userName={user.full_name} />
      </div>
    </>
  )
}
