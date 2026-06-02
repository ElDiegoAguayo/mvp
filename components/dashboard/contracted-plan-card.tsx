'use client'

import Link from 'next/link'
import { Check, Crown, Sparkles, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'
import { getContractedPlanCardStyles, getPlanVisualTier } from '@/lib/subscription-plan-styles'
import { PlanMetalOverlays } from '@/components/dashboard/plan-metal-overlays'
import { PlanLogoPattern } from '@/components/dashboard/plan-logo-pattern'
import { PlanPremiumEffects } from '@/components/dashboard/plan-premium-effects'
import { PlanSilverEffects } from '@/components/dashboard/plan-silver-effects'
import {
  getServicePlanDefinition,
  UP_CROP_CONTACT,
  type ServicePlanId,
} from '@/lib/subscription-plans'
import type { ServicePlanSubscriptionStatus } from '@/lib/service-plan-subscription'
import { SERVICE_PLANS_SECTION_ID } from '@/components/dashboard/subscription-plans-showcase'
import { cn } from '@/lib/utils'

interface ContractedPlanCardProps {
  servicePlanId: ServicePlanId | null
  activatedAt?: string | null
  expiresAt?: string | null
  status?: ServicePlanSubscriptionStatus
  className?: string
}

function formatPlanDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return null
  try {
    const date = new Date(iso)
    const loc = locale === 'es' ? 'es-CL' : 'en-US'
    return {
      date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(date),
    }
  } catch {
    return null
  }
}

export function ContractedPlanCard({
  servicePlanId,
  activatedAt = null,
  expiresAt = null,
  status = 'none',
  className,
}: ContractedPlanCardProps) {
  const { t, locale } = useLocale()

  const scrollToPlans = () => {
    document.getElementById(SERVICE_PLANS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!servicePlanId) {
    return (
      <Card className={cn('border-dashed border-border bg-secondary/20 shadow-sm', className)}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('profile.contractedPlan.title')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('profile.contractedPlan.none')}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="sm"
              className="shrink-0 bg-[#4A6CF7] text-white hover:bg-[#3a5ce6]"
              onClick={scrollToPlans}
            >
              {t('profile.contractedPlan.viewPlans')}
            </Button>
            <Button asChild variant="outline" size="sm" className="shrink-0 border-primary/30 text-primary">
              <Link href={UP_CROP_CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
                {t('profile.contractedPlan.contact')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const plan = getServicePlanDefinition(servicePlanId)
  const Icon = plan.icon
  const styles = getContractedPlanCardStyles(servicePlanId)
  const metalTier = getPlanVisualTier(servicePlanId)
  const isPremium = servicePlanId === 'business'
  const isSilver = servicePlanId === 'enterprise'
  const activated = formatPlanDateTime(activatedAt, locale)
  const expiry = formatPlanDateTime(expiresAt, locale)
  const isExpired = status === 'expired'
  const isExpiring = status === 'expiring'
  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const statusBadge = isExpired ? (
    <Badge variant="destructive">
      {t('profile.contractedPlan.expired')}
    </Badge>
  ) : isExpiring ? (
    <Badge className="bg-amber-500/90 text-white hover:bg-amber-500/90">
      {t('profile.contractedPlan.expiring')}
    </Badge>
  ) : (
    <Badge className={cn('text-white', styles.activeBadge)}>
      <Check className="mr-1 h-3 w-3" />
      {t('profile.contractedPlan.active')}
    </Badge>
  )

  return (
    <Card className={cn('relative overflow-hidden', styles.card, className)}>
      <CardContent className="relative p-0">
        <PlanMetalOverlays tier={metalTier} />
        <PlanLogoPattern tier={metalTier} />
        {isSilver && <PlanSilverEffects />}
        {isPremium && <PlanPremiumEffects />}

        <div className="relative z-[1] flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
                styles.iconWrap,
              )}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    styles.label ?? (isPremium ? 'text-amber-400/90' : 'text-muted-foreground'),
                  )}
                >
                  {t('profile.contractedPlan.title')}
                </p>
                {statusBadge}
                {isSilver && styles.leaderBadge && (
                  <Badge variant="secondary" className={styles.leaderBadge}>
                    <Star className="mr-1 h-3 w-3 fill-current" />
                    {t('profile.servicePlans.leaderBadge')}
                  </Badge>
                )}
                {isPremium && (
                  <Badge className="border border-amber-300/60 bg-[linear-gradient(180deg,#fde68a,#f59e0b,#d97706)] text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:opacity-95">
                    <Crown className="mr-1 h-3 w-3" />
                    {t('profile.servicePlans.premiumBadge')}
                  </Badge>
                )}
              </div>
              <h2 className={cn('mt-1 text-2xl font-bold', styles.title)}>
                {t(`profile.servicePlans.plans.${servicePlanId}.name`)}
              </h2>
              <p className={cn('mt-1 text-sm', styles.description)}>
                {t(`profile.servicePlans.plans.${servicePlanId}.description`)}
              </p>
              {(activated || expiry) && (
                <div className="mt-3 space-y-1 text-sm">
                  {activated && (
                    <p className={cn(styles.description ?? 'text-muted-foreground')}>
                      {t('profile.contractedPlan.activatedAt', {
                        date: activated.date,
                        time: activated.time,
                      })}
                    </p>
                  )}
                  {expiry && !isExpired && (
                    <p className={cn(isExpiring ? 'text-amber-600 dark:text-amber-400 font-medium' : styles.description)}>
                      {t('profile.contractedPlan.validUntil', {
                        date: expiry.date,
                        time: expiry.time,
                      })}
                      {isExpiring && daysUntilExpiry != null && daysUntilExpiry > 0 && (
                        <span className="ml-1">
                          ({t('profile.contractedPlan.expiringIn', { days: String(daysUntilExpiry) })})
                        </span>
                      )}
                    </p>
                  )}
                  {expiry && isExpired && (
                    <p className="text-destructive font-medium">
                      {t('profile.contractedPlan.expiredOn', {
                        date: expiry.date,
                        time: expiry.time,
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              'shrink-0 rounded-xl border px-4 py-3 text-center sm:min-w-[140px] sm:text-right',
              styles.priceBox,
            )}
          >
            <p
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                styles.label ?? (isPremium ? 'text-amber-400/90' : 'text-muted-foreground'),
              )}
            >
              {plan.priceType === 'custom'
                ? t('profile.servicePlans.investment')
                : t('profile.contractedPlan.monthlyValue')}
            </p>
            {plan.priceType === 'custom' ? (
              <p className={cn('text-2xl font-bold tracking-tight', styles.price)}>
                {t('profile.servicePlans.customPrice')}
              </p>
            ) : (
              <p className={cn('text-2xl font-bold tabular-nums', styles.price)}>
                {t(`profile.servicePlans.plans.${servicePlanId}.price`)}
                <span className={cn('ml-1 text-sm font-semibold', styles.priceSuffix)}>
                  {t('profile.servicePlans.perMonth')}
                </span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
