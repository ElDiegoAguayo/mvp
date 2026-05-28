'use client'

import { useTransition } from 'react'
import { Eye, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stopImpersonationAction } from '@/app/admin/impersonation-actions'

interface SupportModeBannerProps {
  targetName: string
  targetEmail: string | null
}

export function SupportModeBanner({ targetName, targetEmail }: SupportModeBannerProps) {
  const [isPending, startTransition] = useTransition()

  const handleExit = () => {
    startTransition(async () => {
      await stopImpersonationAction()
    })
  }

  return (
    <div className="sticky top-0 z-40 shrink-0 border-b border-amber-500/40 bg-amber-500/15 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Modo soporte
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 truncate">
              Viendo la plataforma como{' '}
              <span className="font-medium">{targetName}</span>
              {targetEmail && (
                <span className="text-amber-700/80 dark:text-amber-300/80"> · {targetEmail}</span>
              )}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleExit}
          className="shrink-0 border-amber-500/50 bg-background/80 hover:bg-amber-500/10 text-amber-900 dark:text-amber-100 h-8 gap-1.5"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
          Salir del modo soporte
        </Button>
      </div>
    </div>
  )
}
