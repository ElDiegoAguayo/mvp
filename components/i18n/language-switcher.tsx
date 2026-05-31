'use client'

import { useLocale } from '@/components/i18n/locale-provider'
import type { Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  compact?: boolean
  className?: string
}

export function LanguageSwitcher({ compact = false, className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale()

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-secondary/50 p-0.5',
        compact && 'scale-90 origin-left',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(['es', 'en'] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded transition-colors',
            locale === code
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === code}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
