'use client'

import {
  Calendar,
  Crown,
  HardDrive,
  Layers,
  Mail,
  Shield,
  User,
  Users,
} from 'lucide-react'
import { ClientStorageBar } from '@/components/vault/vault-storage-bar'
import { SubscriptionPlansShowcase, SERVICE_PLANS_SECTION_ID } from '@/components/dashboard/subscription-plans-showcase'
import { ContractedPlanCard } from '@/components/dashboard/contracted-plan-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/components/i18n/locale-provider'
import { translateStoragePlanLabel } from '@/lib/i18n/translate'
import { getModuleIcon } from '@/lib/module-icons'
import { STORAGE_PLANS } from '@/lib/vault-storage'
import { cn } from '@/lib/utils'
import type { ProfilePageData } from '@/app/actions/profile-actions'

interface UserProfileViewProps {
  data: ProfilePageData
}

function formatMemberSince(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-CL' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

export function UserProfileView({ data }: UserProfileViewProps) {
  const { locale, t, tModule } = useLocale()
  const { profile, storagePlan, enabledModules, servicePlanId } = data

  const roleLabel =
    profile.role === 'admin'
      ? t('profile.roleAdmin')
      : profile.isSubuser
        ? t('profile.roleSubuser')
        : t('profile.roleClient')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <ContractedPlanCard servicePlanId={servicePlanId} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              {t('profile.personalData')}
            </CardTitle>
            <CardDescription>{t('profile.personalDataDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="mt-4 min-w-0 flex-1 sm:mt-0">
                <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>
                <Badge variant="secondary" className="mt-2 border border-primary/20 bg-primary/10 text-primary">
                  {roleLabel}
                </Badge>
              </div>
            </div>

            <dl className="mt-6 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('profile.email')}
                  </dt>
                  <dd className="truncate text-sm font-medium text-foreground">{profile.email ?? '—'}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('profile.memberSince')}
                  </dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatMemberSince(profile.created_at, locale)}
                  </dd>
                </div>
              </div>

              {profile.isSubuser && profile.parentName && (
                <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('profile.parentAccount')}
                    </dt>
                    <dd className="text-sm font-medium text-foreground">{profile.parentName}</dd>
                  </div>
                </div>
              )}

              {profile.role === 'admin' && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm text-muted-foreground">{t('profile.adminNote')}</p>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="h-5 w-5 text-primary" />
                {t('profile.plansTitle')}
              </CardTitle>
              <CardDescription>{t('profile.plansDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {storagePlan ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {STORAGE_PLANS.filter(p => p.id !== '1mb-test').map(plan => {
                      const isCurrent = plan.id === storagePlan.planId
                      return (
                        <div
                          key={plan.id}
                          className={cn(
                            'rounded-xl border px-4 py-3 transition-colors',
                            isCurrent
                              ? 'border-primary/40 bg-primary/10 shadow-sm'
                              : 'border-border/60 bg-secondary/10 opacity-70',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <HardDrive className={cn('h-4 w-4', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                              <span className="text-sm font-semibold text-foreground">
                                {translateStoragePlanLabel(plan.id, locale, plan.label)}
                              </span>
                            </div>
                            {isCurrent && (
                              <Badge className="bg-[#4A6CF7] text-white hover:bg-[#4A6CF7]">
                                {t('profile.currentPlan')}
                              </Badge>
                            )}
                          </div>
                          {!isCurrent && (
                            <p className="mt-2 text-xs text-muted-foreground">{t('profile.contactToUpgrade')}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <ClientStorageBar
                    usedBytes={storagePlan.usedBytes}
                    quotaBytes={storagePlan.quotaBytes}
                    modules={storagePlan.modules}
                  />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-8 text-center">
                  <HardDrive className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{t('profile.noStoragePlan')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-primary" />
                {t('profile.modulesTitle')}
              </CardTitle>
              <CardDescription>{t('profile.modulesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {enabledModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('profile.noModules')}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {enabledModules.map(mod => {
                    const Icon = getModuleIcon(mod.icon)
                    return (
                      <li
                        key={mod.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="truncate text-sm font-medium text-foreground">
                          {tModule(mod.slug, mod.name)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SubscriptionPlansShowcase id={SERVICE_PLANS_SECTION_ID} currentPlanId={servicePlanId} />
    </div>
  )
}
