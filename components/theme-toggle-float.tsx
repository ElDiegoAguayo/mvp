'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ThemeToggleButtonProps {
  className?: string
  size?: 'sm' | 'md'
}

export function ThemeToggleButton({ className, size = 'md' }: ThemeToggleButtonProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span
        className={cn(
          'inline-block shrink-0 rounded-full bg-primary/20',
          size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
          className,
        )}
        aria-hidden
      />
    )
  }

  const isDark = resolvedTheme === 'dark'
  const dimension = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'relative isolate shrink-0 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg flex items-center justify-center transition-shadow',
        dimension,
        className,
      )}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <Sun
        className={cn(
          iconSize,
          'absolute transition-opacity duration-300',
          isDark ? 'opacity-0' : 'opacity-100',
        )}
      />
      <Moon
        className={cn(
          iconSize,
          'absolute transition-opacity duration-300',
          isDark ? 'opacity-100' : 'opacity-0',
        )}
      />
    </button>
  )
}

/** Botón flotante global — oculto en login (el header lleva su propio toggle). */
export function ThemeToggleFloat() {
  const pathname = usePathname()

  if (pathname === '/auth/login' || pathname?.startsWith('/auth/login/')) {
    return null
  }

  return (
    <div className="fixed top-6 z-50 fixed-right-safe">
      <ThemeToggleButton size="md" className="shadow-lg hover:shadow-xl" />
    </div>
  )
}
