'use client'

import { Check, Crown, Mail, Phone, Star } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getPlanCardStyles, getPlanVisualTier } from '@/lib/subscription-plan-styles'
import { PlanMetalOverlays } from '@/components/dashboard/plan-metal-overlays'
import { PlanLogoPattern } from '@/components/dashboard/plan-logo-pattern'
import { PlanPremiumEffects } from '@/components/dashboard/plan-premium-effects'
import { PlanSilverEffects } from '@/components/dashboard/plan-silver-effects'
import { SERVICE_PLANS, UP_CROP_CONTACT, type ServicePlanId } from '@/lib/subscription-plans'

export const SERVICE_PLANS_SECTION_ID = 'service-plans'

interface SubscriptionPlansShowcaseProps {
  id?: string
  currentPlanId?: ServicePlanId | null
  className?: string
}

export function SubscriptionPlansShowcase({
  id = SERVICE_PLANS_SECTION_ID,
  currentPlanId = null,
  className,
}: SubscriptionPlansShowcaseProps) {
  const { t } = useLocale()

  return (
    <section id={id} className={cn('scroll-mt-8 space-y-8', className)}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('profile.servicePlans.sectionTitlePrefix')}{' '}
          <span className="bg-gradient-to-r from-primary to-[#6b8cff] bg-clip-text text-transparent">
            {t('profile.servicePlans.sectionTitleHighlight')}
          </span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t('profile.servicePlans.sectionSubtitle')}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          {t('profile.servicePlans.ufBadge')}
        </div>
      </div>

      <div className="grid items-stretch gap-6 overflow-visible lg:grid-cols-3 lg:gap-5 lg:pt-6">
        {SERVICE_PLANS.map(plan => {
          const Icon = plan.icon
          const isCurrent = currentPlanId === plan.id
          const styles = getPlanCardStyles(plan.id, { isCurrent })
          const metalTier = getPlanVisualTier(plan.id)
          const isPremium = styles.topBadge === 'premium'
          const isSilver = metalTier === 'silver'
          const hasTopBadge = !!styles.topBadge

          return (
            <div
              key={plan.id}
              className={cn(
                'relative overflow-visible',
                hasTopBadge && 'pt-4 sm:pt-5',
                metalTier === 'silver' && 'lg:px-0.5',
              )}
            >
              {styles.topBadge === 'leader' && (
                <Badge
                  className={cn(
                    'absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                    styles.leaderBadge,
                  )}
                >
                  <Star className="mr-1 h-3 w-3 shrink-0 fill-current" />
                  {t('profile.servicePlans.leaderBadge')}
                </Badge>
              )}

              {styles.topBadge === 'premium' && (
                <Badge
                  className={cn(
                    'absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                    styles.premiumBadge,
                  )}
                >
                  <Crown className="mr-1 h-3 w-3 shrink-0" />
                  {t('profile.servicePlans.premiumBadge')}
                </Badge>
              )}

            <article
              className={cn(
                'relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 sm:p-6',
                styles.article,
              )}
            >
              {styles.glow && <div className={styles.glow} aria-hidden />}

              <PlanMetalOverlays tier={metalTier} />

              <PlanLogoPattern tier={metalTier} />

              {isSilver && <PlanSilverEffects />}
              {isPremium && <PlanPremiumEffects />}

              {isCurrent && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'absolute right-4 top-4 z-20 text-[10px] font-semibold',
                    styles.currentBadge,
                  )}
                >
                  {t('profile.currentPlan')}
                </Badge>
              )}

              <div className="relative z-[1] mb-5 flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
                    styles.iconWrap,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className={cn('min-w-0', isCurrent && 'pr-14')}>
                  <h3 className={cn('text-lg font-bold', styles.title)}>
                    {t(`profile.servicePlans.plans.${plan.id}.name`)}
                  </h3>
                  <p className={cn('mt-1 text-xs leading-relaxed', styles.description)}>
                    {t(`profile.servicePlans.plans.${plan.id}.description`)}
                  </p>
                </div>
              </div>

              <div className={cn('relative z-[1] mb-5 rounded-xl border px-4 py-3', styles.priceBox)}>
                {plan.priceType === 'custom' ? (
                  <div>
                    <p className={cn('text-[10px] font-semibold uppercase tracking-widest', styles.priceLabel)}>
                      {t('profile.servicePlans.investment')}
                    </p>
                    <p className={cn('mt-0.5 text-3xl font-bold tracking-tight', styles.price)}>
                      {t('profile.servicePlans.customPrice')}
                    </p>
                  </div>
                ) : (
                  <p className={cn('text-3xl font-bold tabular-nums', styles.price)}>
                    {t(`profile.servicePlans.plans.${plan.id}.price`)}
                    <span className={cn('ml-1.5 text-base font-semibold', styles.priceSuffix)}>
                      {t('profile.servicePlans.perMonth')}
                    </span>
                  </p>
                )}
              </div>

              <ul className="relative z-[1] flex-1 space-y-2.5">
                {plan.featureKeys.map(key => (
                  <li key={key} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        styles.featureCheck,
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className={cn('leading-snug', styles.featureText)}>
                      {t(`profile.servicePlans.plans.${plan.id}.features.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {isPremium && styles.footnote && (
                <p className={cn('relative z-[1] mt-5 border-t pt-4 text-center text-[11px] font-medium uppercase tracking-widest', styles.footnote)}>
                  {t('profile.servicePlans.premiumFootnote')}
                </p>
              )}
            </article>
            </div>
          )
        })}
      </div>

      <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        {t('profile.servicePlans.disclaimer')}
      </p>

      <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
        <a
          href={UP_CROP_CONTACT.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('profile.servicePlans.contactPhone')}
            </p>
            <p className="text-sm font-semibold text-foreground">{UP_CROP_CONTACT.phone}</p>
          </div>
        </a>
        <a
          href={UP_CROP_CONTACT.emailHref}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('profile.servicePlans.contactEmail')}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{UP_CROP_CONTACT.email}</p>
          </div>
        </a>
      </div>
    </section>
  )
}
