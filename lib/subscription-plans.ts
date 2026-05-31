import type { LucideIcon } from 'lucide-react'
import { Building2, Sparkles, Zap } from 'lucide-react'

export type ServicePlanId = 'esencial' | 'enterprise' | 'business'

export interface ServicePlanDefinition {
  id: ServicePlanId
  icon: LucideIcon
  featured: boolean
  priceType: 'uf' | 'custom'
  featureKeys: string[]
}

export const SERVICE_PLANS: ServicePlanDefinition[] = [
  {
    id: 'esencial',
    icon: Sparkles,
    featured: false,
    priceType: 'uf',
    featureKeys: [
      'modules',
      'analyst',
      'visualizers',
      'ai',
      'programmingHours',
      'integration',
      'support',
      'security',
    ],
  },
  {
    id: 'enterprise',
    icon: Zap,
    featured: true,
    priceType: 'uf',
    featureKeys: [
      'modules',
      'analyst',
      'predictiveAi',
      'programmingHours',
      'erpIntegration',
      'directSupport',
      'backups',
    ],
  },
  {
    id: 'business',
    icon: Building2,
    featured: false,
    priceType: 'custom',
    featureKeys: [
      'unlimitedModules',
      'fieldStaff',
      'devHours',
      'omnichannel',
      'dedicatedServers',
      'enterpriseSecurity',
    ],
  },
]

export const UP_CROP_CONTACT = {
  phone: '+569 6280 6306',
  phoneHref: 'tel:+56962806306',
  whatsappHref: 'https://wa.me/56962806306',
  email: 'cristobal@upcrop-ia.com',
  emailHref: 'mailto:cristobal@upcrop-ia.com',
} as const

const SERVICE_PLAN_ID_SET = new Set<string>(SERVICE_PLANS.map(p => p.id))

export function isServicePlanId(value: string | null | undefined): value is ServicePlanId {
  return !!value && SERVICE_PLAN_ID_SET.has(value)
}

export function getServicePlanDefinition(id: ServicePlanId): ServicePlanDefinition {
  return SERVICE_PLANS.find(p => p.id === id)!
}
