'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { PlanBrandMark } from '@/components/dashboard/plan-brand-mark'
import { useLocale } from '@/components/i18n/locale-provider'
import { getServicePlanNameClass } from '@/lib/service-plan-admin'
import type { ServicePlanId } from '@/lib/subscription-plans'
import { cn } from '@/lib/utils'

interface SidebarUserFooterProps {
  user: {
    full_name: string
    email: string | null
    avatar_url?: string | null
    service_plan_id?: ServicePlanId | null
  }
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarUserFooter({ user, collapsed = false, onNavigate }: SidebarUserFooterProps) {
  const pathname = usePathname()
  const { t } = useLocale()
  const profileActive = pathname === '/dashboard/perfil' || pathname.startsWith('/dashboard/perfil/')
  const nameClass = getServicePlanNameClass(user.service_plan_id)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/dashboard/perfil"
          onClick={onNavigate}
          title={t('shell.myProfile')}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition-colors',
            profileActive
              ? 'border-primary/40 bg-primary/15'
              : 'border-primary/20 bg-primary/10 hover:bg-primary/20',
          )}
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
          ) : (
            <span className={cn('text-xs font-semibold', nameClass)}>
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          )}
          {user.service_plan_id && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <PlanBrandMark planId={user.service_plan_id} size="xs" className="rounded-sm" />
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
            <span className={cn('flex h-full w-full items-center justify-center bg-primary/10 text-xs font-semibold', nameClass)}>
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className={cn('truncate text-sm font-semibold', nameClass)}>{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <PlanBrandMark planId={user.service_plan_id} size="sm" className="self-center" />
      </Link>
      <div className="mt-2">
        <LogoutButton userName={user.full_name} />
      </div>
    </>
  )
}
