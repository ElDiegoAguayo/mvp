'use client'

import { useTransition } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { sendUserRegistrationInviteAction } from '@/app/admin/actions'
import { cn } from '@/lib/utils'

interface SendUserInviteButtonProps {
  userId: string
  email: string | null
  fullName?: string | null
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'icon'
  className?: string
  showLabel?: boolean
}

export function SendUserInviteButton({
  userId,
  email,
  fullName,
  variant = 'outline',
  size = 'sm',
  className,
  showLabel = true,
}: SendUserInviteButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!email?.trim()) {
      toast.error('Este usuario no tiene correo registrado.')
      return
    }

    startTransition(async () => {
      const result = await sendUserRegistrationInviteAction(userId)
      if (result.ok) {
        toast.success('Correo enviado', {
          description: result.message,
        })
      } else {
        toast.error('No se pudo enviar la invitación', {
          description: result.message,
        })
      }
    })
  }

  const label = fullName ? `Invitar a ${fullName}` : 'Enviar invitación'

  if (size === 'icon') {
    return (
      <Button
        type="button"
        size="icon"
        variant={variant === 'default' ? 'outline' : variant}
        onClick={handleClick}
        disabled={isPending || !email}
        title={email ? 'Enviar invitación por correo' : 'Sin correo'}
        className={cn('h-7 w-7 p-0', className)}
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Mail className="w-3.5 h-3.5" />
        )}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={isPending || !email}
      className={cn(className)}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Mail className="w-4 h-4 mr-2" />
      )}
      {showLabel && (isPending ? 'Enviando...' : 'Enviar invitación')}
    </Button>
  )
}
