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
  AlertCircle,
  Eye,
  EyeOff,
  HardHat,
  Loader2,
  Mail,
  Lock,
  Shuffle,
  User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createFieldInspectorAction } from '@/app/admin/actions'

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

interface CreateFieldInspectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateFieldInspectorDialog({ open, onOpenChange }: CreateFieldInspectorDialogProps) {
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
    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    fd.set('full_name', fullName)

    startTransition(async () => {
      const result = await createFieldInspectorAction(undefined, fd)
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      resetForm()
      onOpenChange(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!isPending) {
          if (!o) resetForm()
          onOpenChange(o)
        }
      }}
    >
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <DialogTitle>Crear inspector de campo</DialogTitle>
              <DialogDescription>
                Personal Up Crop. No pertenece a un cliente fijo; elige el cliente al marcar asistencia.
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
            <Label htmlFor="insp-name">Nombre completo</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="insp-name"
                ref={firstFieldRef}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                disabled={isPending}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insp-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="insp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insp-password">Contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="insp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isPending}
                  className="pl-9 pr-9 bg-background border-border"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPassword(generatePassword())
                  setShowPassword(true)
                }}
                disabled={isPending}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear inspector
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
