import { cn } from '@/lib/utils'

/** Logotipo textual: Up + Crop en el mismo color (sin acento azul en Crop). */
export function BrandWordmark({
  className,
  as: Tag = 'span',
}: {
  className?: string
  as?: 'span' | 'p' | 'h1'
}) {
  return (
    <Tag className={cn('font-bold text-foreground', className)}>
      Up Crop
    </Tag>
  )
}

/** Clase para isotipo PNG azul → blanco en modo oscuro. */
export const brandLogoImageClass =
  'object-contain shrink-0 dark:brightness-0 dark:invert'
