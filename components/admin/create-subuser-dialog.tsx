'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shuffle,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { createSubuserAction } from '@/app/admin/actions'

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
}

interface CreateSubuserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentUser: UserRow | null
}

function generatePassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const all = lower + upper + digits + symbols
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)]
  for (let i = chars.length; i < 14; i++) chars.push(pick(all))
  return chars.sort(() => Math.random() - 0.5).join('')
}

export function CreateSubuserDialog({ open, onOpenChange, parentUser }: CreateSubuserDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setTimeout(() => firstFieldRef.current?.focus(), 50)
    }
  }, [open])

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setShowPassword(false)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!parentUser?.id) {
      setError('Selecciona un usuario principal válido.')
      return
    }

    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('full_name', fullName)
    fd.set('parent_user_id', parentUser.id)

    startTransition(async () => {
      const result = await createSubuserAction(undefined, fd)
      if (!result.ok) {
        setError(result.message)
        toast.error('No se pudo crear el subusuario', { description: result.message })
        return
      }
      toast.success('Subusuario creado', { description: result.message })
      resetForm()
      onOpenChange(false)
    })
  }

  const parentLabel = parentUser?.full_name || parentUser?.email || 'Cliente'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) {
          if (!o) resetForm()
          onOpenChange(o)
        }
      }}
    >
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-foreground">
                Crear subusuario
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Este acceso quedará asociado a {parentLabel}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="sub-name" className="text-foreground">
              Nombre completo
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sub-name"
                ref={firstFieldRef}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre del colaborador"
                required
                disabled={isPending}
                autoComplete="off"
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                disabled={isPending}
                autoComplete="off"
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-password" className="text-foreground">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="sub-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                disabled={isPending}
                autoComplete="new-password"
                className="pl-9 pr-20 bg-background border-border"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPassword((s) => !s)}
                  disabled={isPending}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPassword(generatePassword())
                    setShowPassword(true)
                  }}
                  disabled={isPending}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                  aria-label="Generar contraseña aleatoria"
                  title="Generar contraseña aleatoria"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Compártela con el colaborador por un canal seguro.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
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
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear subusuario
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}