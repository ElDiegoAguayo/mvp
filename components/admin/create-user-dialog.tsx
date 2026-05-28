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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { createUserAction } from '@/app/admin/actions'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
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
    setRole('user')
    setShowPassword(false)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('full_name', fullName)
    fd.set('role', role)

    startTransition(async () => {
      const result = await createUserAction(undefined, fd)
      if (!result.ok) {
        setError(result.message)
        toast.error('No se pudo crear el usuario', { description: result.message })
        return
      }
      toast.success('Cliente registrado', { description: result.message })
      resetForm()
      onOpenChange(false)
    })
  }

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
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-foreground">
                Registrar Nuevo Cliente
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                La cuenta se crea sin cerrar tu sesión.
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
            <Label htmlFor="new-name" className="text-foreground">
              Nombre completo
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-name"
                ref={firstFieldRef}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Pérez"
                required
                disabled={isPending}
                autoComplete="off"
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@upcrop.cl"
                required
                disabled={isPending}
                autoComplete="off"
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-foreground">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-password"
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
              Compártela con el cliente por un canal seguro.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role" className="text-foreground">
              Rol
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as 'user' | 'admin')}
              disabled={isPending}
            >
              <SelectTrigger id="new-role" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Cliente (user)</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
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
              className="bg-primary hover:bg-lime-dark text-primary-foreground"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
