'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggleFloat() {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || pathname?.startsWith('/auth')) {
    return null
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="fixed top-6 z-50 isolate w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center group [transform:translateZ(0)] fixed-right-safe"
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <div className="relative z-10 w-5 h-5 shrink-0">
        <Sun
          className={`absolute inset-0 w-5 h-5 transition-opacity duration-300 ${
            isDark ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <Moon
          className={`absolute inset-0 w-5 h-5 transition-opacity duration-300 ${
            isDark ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-popover text-popover-foreground text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md border border-border pointer-events-none z-20">
        {isDark ? 'Modo claro' : 'Modo oscuro'}
      </span>

      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-full -z-10 blur-xl ${
          isDark ? 'bg-blue-500/20' : 'bg-yellow-500/20'
        }`}
      />
    </button>
  )
}
