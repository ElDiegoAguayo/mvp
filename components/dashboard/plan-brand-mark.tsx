'use client'

import Image from 'next/image'
import { getServicePlanLabel, getServicePlanMarkClass } from '@/lib/service-plan-admin'
import type { ServicePlanId } from '@/lib/subscription-plans'
import { cn } from '@/lib/utils'

const LOGO_ISOTYPE = '/logo-upcrop-isotype.png'

interface PlanBrandMarkProps {
  planId?: ServicePlanId | null
  size?: 'xs' | 'sm'
  className?: string
}

const SIZE_PX = { xs: 20, sm: 24 } as const

export function PlanBrandMark({ planId, size = 'sm', className }: PlanBrandMarkProps) {
  const box = SIZE_PX[size]
  const logo = Math.max(12, box - 8)
  const title = planId ? getServicePlanLabel(planId) : 'Up Crop'

  return (
    <div
      title={title}
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border p-0.5',
        getServicePlanMarkClass(planId),
        className,
      )}
      style={{ width: box, height: box }}
    >
      <Image
        src={LOGO_ISOTYPE}
        alt=""
        width={logo}
        height={logo}
        className={cn(
          'object-contain',
          planId === 'business' && 'brightness-0 invert',
          planId === 'enterprise' && 'brightness-0 invert opacity-95',
          planId === 'esencial' && 'brightness-0 invert opacity-90',
          !planId && 'opacity-90',
        )}
      />
    </div>
  )
}
