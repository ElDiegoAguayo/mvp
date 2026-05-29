import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LoginVariantId } from './constants'
import { HeaderBar } from './login-parts'

/** Contenedor raíz: exactamente una pantalla, sin scroll de página */
export function LoginShell({
  variant,
  className,
  children,
  headerExtra,
}: {
  variant: LoginVariantId
  className?: string
  children: ReactNode
  headerExtra?: ReactNode
}) {
  return (
    <div className={cn('login-shell h-full w-full flex flex-col overflow-hidden', className)}>
      <HeaderBar variant={variant}>{headerExtra}</HeaderBar>
      {children}
    </div>
  )
}

/** Área principal entre header y selector de estilos */
export function LoginMain({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main className={cn('login-main flex-1 min-h-0 w-full overflow-hidden relative z-10', className)}>
      <div className="login-main-fit h-full w-full">{children}</div>
    </main>
  )
}

/** Panel izquierdo decorativo — se oculta en pantallas bajas o móvil para no forzar scroll */
export function LoginSide({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('login-side hidden lg:flex flex-col justify-center min-h-0 min-w-0 overflow-hidden', className)}>
      {children}
    </div>
  )
}
