'use client'

import { cn } from '@/lib/utils'
import { getCountryFlagUrl } from '@/lib/timezone/country-flags'

const SIZE_CLASS = {
  xs: 'h-3.5 w-5',
  sm: 'h-4 w-6',
  md: 'h-6 w-9',
  lg: 'h-10 w-14',
  xl: 'h-12 w-16',
} as const

const WIDTH = { xs: 20, sm: 40, md: 80, lg: 80, xl: 160 } as const

interface CountryFlagProps {
  countryName?: string | null
  emoji?: string
  size?: keyof typeof SIZE_CLASS
  className?: string
  title?: string
}

export function CountryFlag({
  countryName,
  emoji = '🌍',
  size = 'md',
  className,
  title,
}: CountryFlagProps) {
  const flagUrl = countryName ? getCountryFlagUrl(countryName, WIDTH[size]) : null

  if (flagUrl) {
    return (
      <img
        src={flagUrl}
        alt=""
        title={title}
        className={cn(
          'shrink-0 rounded-sm border border-black/10 object-cover shadow-sm',
          SIZE_CLASS[size],
          className,
        )}
      />
    )
  }

  const emojiSize =
    size === 'xs' ? 'text-sm' : size === 'sm' ? 'text-base' : size === 'md' ? 'text-2xl' : size === 'lg' ? 'text-4xl' : 'text-5xl'

  return (
    <span className={cn('leading-none', emojiSize, className)} title={title}>
      {emoji}
    </span>
  )
}
