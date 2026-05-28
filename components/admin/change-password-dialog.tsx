'use client'

import { useState, useEffect, useActionState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Save, Eye, EyeOff } from 'lucide-react'
import { changePasswordAction, type ChangePasswordState } from '@/app/admin/actions'
import { toast } from 'sonner'

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
}

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserRow | null
}

export function ChangePasswordDialog({ open, onOpenChange, user }: ChangePasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [state, formAction, isPending] = useActionState<ChangePasswordState | undefined, FormData>(
    changePasswordAction,
    undefined
  )

  // Reset form when user changes or dialog closes
  useEffect(() => {
    if (!open) {
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
    }
  }, [open])

  // Handle result
  useEffect(() => {
    if (state?.ok) {
      toast.success('Contraseña actualizada', { description: state.message })
      setPassword('')
      setConfirmPassword('')
      onOpenChange(false)
    } else if (state?.ok === false) {
      toast.error('Error', { description: state.message })
    }
  }, [state, onOpenChange])

  if (!user) return null

  const passwordsMatch = password === confirmPassword
  const passwordValid = password.length >= 8
  const isFormValid = passwordValid && passwordsMatch && password.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="bg-card border-border sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-foreground">Cambiar contraseña</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Establece una nueva contraseña para {user.full_name || user.email}. La nueva contraseña se aplicará inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />
          
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-foreground">
              Nueva contraseña
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                disabled={isPending}
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {password && !passwordValid && (
              <p className="text-xs text-destructive">
                La contraseña debe tener al menos 8 caracteres
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-foreground">
              Confirmar contraseña
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                name="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                disabled={isPending}
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-destructive">
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cambiando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar contraseña
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
