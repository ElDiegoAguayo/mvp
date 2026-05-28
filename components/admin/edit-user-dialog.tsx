'use client'

import { useState, useEffect, useActionState, useRef, useTransition, useCallback } from 'react'
import Image from 'next/image'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2, User, Save, Lock, AlertCircle, ImageIcon,
  Upload, Trash2, Check, RefreshCw, AlertTriangle,
  ZoomIn, ZoomOut, Crop,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  updateUserAction, type UpdateUserState,
  resetPasswordAction, type ResetPasswordState,
  updateAvatarAction, uploadPresetAvatarAction,
  deletePresetAvatarAction, listPresetAvatarsAction,
  uploadCroppedAvatarAction,
} from '@/app/admin/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Canvas crop helper ────────────────────────────────────────────────────────
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new window.Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((res, rej) => {
    image.onload = () => res()
    image.onerror = rej
    image.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas empty')), 'image/jpeg', 0.92))
}

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  role: string
  avatar_url?: string | null
}

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserRow | null
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [activeTab, setActiveTab] = useState('info')

  // Avatar state
  const [presets, setPresets] = useState<{ name: string; url: string }[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [isSavingAvatar, startSavingAvatar] = useTransition()
  const [isUploading, startUploading] = useTransition()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ name: string; url: string } | null>(null)

  // Crop state
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isApplyingCrop, startApplyingCrop] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, formAction, isPending] = useActionState<UpdateUserState | undefined, FormData>(
    updateUserAction, undefined
  )
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState<ResetPasswordState | undefined, FormData>(
    resetPasswordAction, undefined
  )

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '')
      setEmail(user.email ?? '')
      setNewPassword('')
      setConfirmPassword('')
      setSelectedAvatar(user.avatar_url ?? null)
    }
  }, [user])

  useEffect(() => {
    if (state?.ok) {
      toast.success('Usuario actualizado', { description: state.message })
      onOpenChange(false)
    } else if (state?.ok === false) {
      toast.error('Error', { description: state.message })
    }
  }, [state, onOpenChange])

  useEffect(() => {
    if (passwordState?.ok) {
      toast.success('Contrasena actualizada', { description: passwordState.message })
      setNewPassword(''); setConfirmPassword(''); setActiveTab('info')
    } else if (passwordState?.ok === false) {
      toast.error('Error', { description: passwordState.message })
    }
  }, [passwordState])

  const loadPresets = useCallback(async () => {
    setPresetsLoading(true)
    const result = await listPresetAvatarsAction()
    setPresets(result)
    setPresetsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'photo' && presets.length === 0 && !presetsLoading) {
      loadPresets()
    }
  }, [activeTab, presets.length, presetsLoading, loadPresets])

  const handleSaveAvatar = () => {
    if (!user) return
    startSavingAvatar(async () => {
      const result = await updateAvatarAction(user.id, selectedAvatar)
      if (result.ok) {
        toast.success('Foto actualizada')
        onOpenChange(false)
      } else {
        toast.error('Error al guardar foto', { description: result.message })
      }
    })
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    startUploading(async () => {
      const result = await uploadPresetAvatarAction(formData)
      if (result.ok) {
        toast.success('Imagen subida')
        await loadPresets()
        if (result.url) setSelectedAvatar(result.url)
      } else {
        toast.error('Error al subir imagen', { description: result.message })
      }
    })
    e.target.value = ''
  }

  const openCrop = (url: string) => {
    setCropSource(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const handleApplyCrop = () => {
    if (!croppedAreaPixels || !cropSource || !user) return
    startApplyingCrop(async () => {
      try {
        const blob = await getCroppedBlob(cropSource, croppedAreaPixels)
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadCroppedAvatarAction(formData, user.id)
        if (result.ok && result.url) {
          setSelectedAvatar(result.url)
          setCropSource(null)
          toast.success('Recorte aplicado')
        } else {
          toast.error('Error al aplicar recorte', { description: result.message })
        }
      } catch {
        toast.error('Error al procesar la imagen')
      }
    })
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    const { name, url } = confirmDelete
    setConfirmDelete(null)
    setIsDeleting(name)
    const result = await deletePresetAvatarAction(name)
    if (result.ok) {
      toast.success('Imagen eliminada')
      setPresets(prev => prev.filter(p => p.name !== name))
      if (selectedAvatar === url) setSelectedAvatar(null)
    } else {
      toast.error('Error', { description: result.message })
    }
    setIsDeleting(null)
  }

  const initials = (user?.full_name ?? user?.email ?? '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !isPending && !isPasswordPending && onOpenChange(o)}>
      <DialogContent className="bg-card border-border sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            {selectedAvatar ? (
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
                <Image src={selectedAvatar} alt="Avatar" width={40} height={40} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{initials}</span>
              </div>
            )}
            <div>
              <DialogTitle className="text-foreground">Editar usuario</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                {user?.full_name ?? user?.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 bg-secondary/50 border-b border-border rounded-none mx-0 h-10 flex-shrink-0">
            <TabsTrigger value="info" className="flex items-center gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <User className="w-3.5 h-3.5" />Informacion
            </TabsTrigger>
            <TabsTrigger value="photo" className="flex items-center gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <ImageIcon className="w-3.5 h-3.5" />Foto de Perfil
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Lock className="w-3.5 h-3.5" />Contrasena
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Informacion ── */}
          <TabsContent value="info" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="user_id" value={user?.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-full-name">Nombre completo</Label>
                <Input id="edit-full-name" name="full_name" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre del usuario" disabled={isPending}
                  className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Correo electronico</Label>
                <Input id="edit-email" name="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com" disabled={isPending}
                  className="bg-secondary border-border" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Tab: Foto de Perfil ── */}
          <TabsContent value="photo" className="flex-1 overflow-y-auto p-6 mt-0 space-y-5">
            {/* Current avatar */}
            <div className="flex items-center gap-4 p-4 bg-secondary/40 rounded-xl border border-border">
              <div className="shrink-0">
                {selectedAvatar ? (
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/40">
                    <Image src={selectedAvatar} alt="Avatar actual" width={64} height={64} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">{initials}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Foto actual</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedAvatar ? 'Foto de perfil asignada' : 'Sin foto — mostrando iniciales'}
                </p>
                {selectedAvatar && (
                  <button
                    type="button"
                    onClick={() => setSelectedAvatar(null)}
                    className="text-xs text-destructive hover:underline mt-1"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>

            {/* Preset gallery */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Catalogo de fotos</Label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={loadPresets} disabled={presetsLoading}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw className={cn('w-3 h-3', presetsLoading && 'animate-spin')} />
                    Actualizar
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-7 text-xs gap-1.5">
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Subir imagen
                  </Button>
                </div>
              </div>

              {presetsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : presets.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl py-10 text-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No hay fotos en el catalogo.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usa "Subir imagen" para agregar fotos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {presets.map(preset => {
                    const isSelected = selectedAvatar === preset.url
                    return (
                      <div key={preset.name} className="relative group">
                        <button
                          type="button"
                          onClick={() => openCrop(preset.url)}
                          className={cn(
                            'w-full aspect-square rounded-xl overflow-hidden border-2 transition-all',
                            isSelected ? 'border-primary ring-2 ring-primary/30 scale-95' : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Image
                            src={preset.url} alt={preset.name}
                            width={100} height={100}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                        {/* Delete button on hover */}
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ name: preset.name, url: preset.url })}
                          disabled={isDeleting === preset.name}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                        >
                          {isDeleting === preset.name ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Haz clic en una foto para seleccionarla. Pasa el cursor para ver la opcion de eliminar.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveAvatar} disabled={isSavingAvatar} className="gap-1.5">
                {isSavingAvatar ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar foto</>}
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab: Contrasena ── */}
          <TabsContent value="password" className="flex-1 overflow-y-auto p-6 mt-0 space-y-4">
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Establece una nueva contrasena. Se requiere minimo 8 caracteres.
              </AlertDescription>
            </Alert>
            <form action={passwordFormAction} className="space-y-4">
              <input type="hidden" name="user_id" value={user?.id} />
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contrasena</Label>
                <Input id="new-password" name="new_password" type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres" disabled={isPasswordPending}
                  className="bg-secondary border-border" />
                <p className="text-xs text-muted-foreground">
                  {newPassword.length > 0 && newPassword.length < 8
                    ? `${newPassword.length}/8 caracteres`
                    : newPassword.length >= 8 ? '✓ Contrasena valida' : ''}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contrasena</Label>
                <Input id="confirm-password" type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirma la contrasena" disabled={isPasswordPending}
                  className="bg-secondary border-border" />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Las contrasenas no coinciden</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline"
                  onClick={() => { setNewPassword(''); setConfirmPassword('') }}
                  disabled={isPasswordPending}>
                  Limpiar
                </Button>
                <Button type="submit"
                  disabled={isPasswordPending || newPassword.length < 8 || newPassword !== confirmPassword}>
                  {isPasswordPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Actualizando...</> : <><Lock className="w-4 h-4 mr-2" />Cambiar</>}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* ── Crop dialog ── */}
    <Dialog open={!!cropSource} onOpenChange={(o) => { if (!o && !isApplyingCrop) setCropSource(null) }}>
      <DialogContent className="bg-card border-border sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Crop className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Recortar imagen</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Mueve y ajusta el zoom para elegir el area de la foto de perfil
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Cropper area */}
        <div className="relative w-full" style={{ height: 320 }}>
          {cropSource && (
            <Cropper
              image={cropSource}
              crop={crop}
              zoom={zoom}
              minZoom={0.5}
              maxZoom={2}
              aspect={1}
              cropShape="round"
              showGrid={false}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          )}
        </div>

        {/* Zoom controls */}
        <div className="px-6 py-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-8 text-right">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCropSource(null)} disabled={isApplyingCrop}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleApplyCrop} disabled={isApplyingCrop} className="gap-1.5">
              {isApplyingCrop
                ? <><Loader2 className="w-4 h-4 animate-spin" />Aplicando...</>
                : <><Check className="w-4 h-4" />Aplicar recorte</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirm delete dialog */}

    <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar imagen del catalogo</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground">
            Esta accion no se puede deshacer. La imagen sera eliminada permanentemente del catalogo y ya no podra asignarse a ningun usuario.
            {confirmDelete && selectedAvatar === confirmDelete.url && (
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                Esta imagen esta actualmente asignada a este usuario.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmDelete && (
          <div className="flex justify-center py-2">
            <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-destructive/30">
              <Image src={confirmDelete.url} alt="Imagen a eliminar" width={80} height={80} className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirmed}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Si, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
