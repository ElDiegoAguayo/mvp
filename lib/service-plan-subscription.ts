import type { ServicePlanId } from '@/lib/subscription-plans'

/** Días antes del vencimiento para considerar "por vencer". */
export const SERVICE_PLAN_EXPIRING_SOON_DAYS = 7

export type ServicePlanSubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'

export interface ServicePlanSubscriptionInfo {
  planId: ServicePlanId | null
  activatedAt: string | null
  expiresAt: string | null
  status: ServicePlanSubscriptionStatus
  daysUntilExpiry: number | null
}

/** Suma un mes calendario a la fecha de activación. */
export function computeServicePlanExpiresAt(activatedAt: Date): Date {
  const expires = new Date(activatedAt)
  expires.setMonth(expires.getMonth() + 1)
  return expires
}

export function getServicePlanSubscriptionStatus(
  planId: string | null | undefined,
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): ServicePlanSubscriptionStatus {
  if (!planId) return 'none'
  if (!expiresAt) return 'active'

  const expiry = new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) return 'active'
  if (expiry.getTime() <= now.getTime()) return 'expired'

  const soonLimit = new Date(now)
  soonLimit.setDate(soonLimit.getDate() + SERVICE_PLAN_EXPIRING_SOON_DAYS)
  if (expiry.getTime() <= soonLimit.getTime()) return 'expiring'

  return 'active'
}

export function getDaysUntilExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null
  const expiry = new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) return null
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function buildServicePlanSubscriptionInfo(
  planId: ServicePlanId | null,
  activatedAt: string | null,
  expiresAt: string | null,
  now: Date = new Date(),
): ServicePlanSubscriptionInfo {
  const status = getServicePlanSubscriptionStatus(planId, expiresAt, now)
  return {
    planId,
    activatedAt,
    expiresAt,
    status,
    daysUntilExpiry: status === 'expiring' || status === 'active'
      ? getDaysUntilExpiry(expiresAt, now)
      : status === 'expired'
        ? getDaysUntilExpiry(expiresAt, now)
        : null,
  }
}
