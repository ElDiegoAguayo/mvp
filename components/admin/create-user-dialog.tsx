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
import { createUserAction, inviteUserByEmailAction } from '@/app/admin/actions'
import { upsertTechLocationAction } from '@/app/actions/tech-assistance-location-actions'
import {
  ClientLocationFormFields,
  emptyClientLocationForm,
  hasClientLocationDraft,
  type ClientLocationFormValues,
} from '@/components/admin/client-location-form-fields'
import { useLocale } from '@/components/i18n/locale-provider'
import { Switch } from '@/components/ui/switch'

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
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState<ClientLocationFormValues>(emptyClientLocationForm())
  const [geocoding, setGeocoding] = useState(false)
  const [inviteByEmail, setInviteByEmail] = useState(false)
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
    setLocationForm(emptyClientLocationForm())
    setGeocoding(false)
    setInviteByEmail(false)
  }

  const handleGeocode = async () => {
    const query = locationForm.search_query.trim() || locationForm.name.trim()
    if (!query) {
      toast.error(t('asistenciaTecnica.locations.searchRequired'))
      return
    }
    setGeocoding(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.message ?? t('asistenciaTecnica.locations.geocodeFailed'))
        return
      }
      setLocationForm(f => ({
        ...f,
        search_query: query,
        lat: String(data.lat),
        lng: String(data.lng),
        resolved_address: data.displayName ?? query,
        name: f.name.trim() || query.split(',')[0]?.trim() || f.name,
      }))
      toast.success(t('asistenciaTecnica.locations.geocodeSuccess'))
    } catch {
      toast.error(t('asistenciaTecnica.locations.geocodeFailed'))
    } finally {
      setGeocoding(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('email', email)
    fd.set('role', role)

    if (!inviteByEmail) {
      fd.set('full_name', fullName)
      fd.set('password', password)
    }

    startTransition(async () => {
      const result = inviteByEmail
        ? await inviteUserByEmailAction(undefined, fd)
        : await createUserAction(undefined, fd)
      if (!result.ok) {
        setError(result.message)
        toast.error(
          inviteByEmail ? 'No se pudo enviar la invitación' : 'No se pudo crear el usuario',
          { description: result.message },
        )
        return
      }

      if (role === 'user' && result.userId && hasClientLocationDraft(locationForm)) {
        const locResult = await upsertTechLocationAction({
          clientUserId: result.userId,
          name: locationForm.name.trim(),
          search_query: locationForm.search_query.trim() || null,
          lat: Number(locationForm.lat),
          lng: Number(locationForm.lng),
          radius_meters: Number(locationForm.radius_meters) || 500,
        })
        if (!locResult.ok) {
          toast.warning('Cliente creado, pero no se guardó la ubicación', {
            description: locResult.message,
          })
        }
      }

      toast.success(
        inviteByEmail ? 'Correo enviado' : 'Cliente registrado',
        { description: result.message },
      )
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
            <Label htmlFor="new-email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-email"
                ref={firstFieldRef}
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

          {!inviteByEmail && (
          <div className="space-y-2">
            <Label htmlFor="new-name" className="text-foreground">
              Nombre completo
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="new-name"
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
          )}

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="invite-by-email" className="text-sm font-medium">
                Invitar por correo
              </Label>
              <p className="text-xs text-muted-foreground">
                Solo necesitas el email. La persona activará su cuenta desde el enlace del correo.
              </p>
            </div>
            <Switch
              id="invite-by-email"
              checked={inviteByEmail}
              onCheckedChange={setInviteByEmail}
              disabled={isPending}
            />
          </div>

          {!inviteByEmail && (
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
                required={!inviteByEmail}
                minLength={inviteByEmail ? undefined : 8}
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
          )}

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

          {role === 'user' && (
            <ClientLocationFormFields
              form={locationForm}
              onChange={setLocationForm}
              geocoding={geocoding}
              onGeocode={handleGeocode}
              disabled={isPending}
            />
          )}

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
                  {inviteByEmail ? 'Enviando...' : 'Creando...'}
                </>
              ) : inviteByEmail ? (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar invitación
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
