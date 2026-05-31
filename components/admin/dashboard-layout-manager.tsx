'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Copy, Eye, LayoutGrid, Loader2, RotateCcw, Save, Users } from 'lucide-react'
import { startImpersonationAction } from '@/app/admin/impersonation-actions'
import type { WidgetConfig } from '@/lib/dashboard/widget-config'
import { layoutWidgetsDirty, snapshotLayoutWidgets } from '@/lib/dashboard/layout-snapshot'
import {
  useAdminNavigationGuard,
  useAdminUnsavedChanges,
} from '@/components/admin/unsaved-changes-provider'
import {
  copyDashboardLayoutFromUserAction,
  getDashboardLayoutForUserAction,
  getPlatformDefaultLayoutAction,
  listDashboardLayoutUsersAction,
  resetDashboardLayoutForUserAction,
  saveDashboardLayoutForUserAction,
  savePlatformDefaultLayoutAction,
  applyPlatformTemplateToAllUsersAction,
  type LayoutUserOption,
  type ResetLayoutSource,
} from '@/app/admin/dashboard-layout-actions'
import { DashboardLayoutPreview } from '@/components/admin/dashboard-layout-preview'
import { isPrincipalClientProfile } from '@/lib/profiles/principal-clients'
import { DashboardWidgetEditor } from '@/components/admin/dashboard-widget-editor'
import { LayoutUserCombobox } from '@/components/admin/layout-user-combobox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const RESET_OPTIONS: { value: ResetLayoutSource; label: string; description: string }[] = [
  {
    value: 'platform',
    label: 'Plantilla Up Crop',
    description:
      'Quita la personalización y vuelve a heredar la plantilla global (o el sistema si aún no hay plantilla).',
  },
  {
    value: 'system',
    label: 'Sistema (código)',
    description: 'Fija el default original del código: alertas, insumos, monedas y SAG.',
  },
]

export function DashboardLayoutManager() {
  const [users, setUsers] = useState<LayoutUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [copySourceUserId, setCopySourceUserId] = useState('')
  const [userWidgets, setUserWidgets] = useState<WidgetConfig[]>([])
  const [platformWidgets, setPlatformWidgets] = useState<WidgetConfig[]>([])
  const [isUserCustom, setIsUserCustom] = useState(false)
  const [layoutOwnerLabel, setLayoutOwnerLabel] = useState('')
  const [fallbackLabel, setFallbackLabel] = useState('Sistema (código)')
  const [platformConfigured, setPlatformConfigured] = useState(false)
  const [resetSource, setResetSource] = useState<ResetLayoutSource>('platform')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingUserLayout, setLoadingUserLayout] = useState(false)
  const [loadingPlatform, setLoadingPlatform] = useState(true)
  const [savingUser, setSavingUser] = useState(false)
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [applyingToAll, setApplyingToAll] = useState(false)
  const [applyAllOpen, setApplyAllOpen] = useState(false)
  const [layoutTab, setLayoutTab] = useState('user')
  const [userBaseline, setUserBaseline] = useState('')
  const [platformBaseline, setPlatformBaseline] = useState('')
  const [previewingAsClient, setPreviewingAsClient] = useState(false)
  const [previewPending, startPreviewTransition] = useTransition()

  const confirmNavigation = useAdminNavigationGuard()

  const userDirty = useMemo(
    () => layoutWidgetsDirty(userWidgets, userBaseline),
    [userWidgets, userBaseline],
  )
  const platformDirty = useMemo(
    () => layoutWidgetsDirty(platformWidgets, platformBaseline),
    [platformWidgets, platformBaseline],
  )

  useAdminUnsavedChanges('layout-user', userDirty)
  useAdminUnsavedChanges('layout-platform', platformDirty)

  const loadPlatform = useCallback(async () => {
    setLoadingPlatform(true)
    const res = await getPlatformDefaultLayoutAction()
    if (!res.ok) {
      toast.error(res.message ?? 'No se pudo cargar la plantilla.')
      setLoadingPlatform(false)
      return
    }
    setPlatformWidgets(res.widgets)
    setPlatformConfigured(res.isConfigured)
    setPlatformBaseline(snapshotLayoutWidgets(res.widgets))
    setLoadingPlatform(false)
  }, [])

  useEffect(() => {
    void listDashboardLayoutUsersAction().then((res) => {
      if (!res.ok) {
        toast.error(res.message ?? 'No se pudieron cargar los usuarios.')
        setLoadingUsers(false)
        return
      }
      setUsers(res.users)
      if (res.users.length > 0) setSelectedUserId(res.users[0].id)
      setLoadingUsers(false)
    })
    void loadPlatform()
  }, [loadPlatform])

  const loadUserLayout = useCallback(async (userId: string) => {
    if (!userId) return
    setLoadingUserLayout(true)
    const res = await getDashboardLayoutForUserAction(userId)
    if (!res.ok) {
      toast.error(res.message ?? 'No se pudo cargar el layout.')
      setLoadingUserLayout(false)
      return
    }
    setUserWidgets(res.widgets)
    setIsUserCustom(res.isCustom)
    setFallbackLabel(res.fallbackLabel)
    setLayoutOwnerLabel(res.layoutOwnerLabel)
    setUserBaseline(snapshotLayoutWidgets(res.widgets))
    setLoadingUserLayout(false)
  }, [])

  useEffect(() => {
    if (selectedUserId) void loadUserLayout(selectedUserId)
  }, [selectedUserId, loadUserLayout])

  useEffect(() => {
    setCopySourceUserId('')
  }, [selectedUserId])

  const userVisibleCount = userWidgets.filter((w) => w.visible).length
  const platformVisibleCount = platformWidgets.filter((w) => w.visible).length
  const selectedUser = users.find((u) => u.id === selectedUserId)
  const copySourceOptions = users.filter((u) => u.id !== selectedUserId)
  const parentUser = selectedUser?.parent_user_id
    ? users.find((u) => u.id === selectedUser.parent_user_id)
    : null
  const parentDisplayName =
    layoutOwnerLabel ||
    parentUser?.full_name?.trim() ||
    parentUser?.email ||
    'cliente principal'
  const isSubuserSelected = Boolean(selectedUser?.parent_user_id)

  const handlePreviewAsClient = () => {
    if (!selectedUserId || previewingAsClient || previewPending) return

    const launchPreview = () => {
      setPreviewingAsClient(true)
      startPreviewTransition(async () => {
        const res = await startImpersonationAction(selectedUserId)
        if (!res.ok) {
          toast.error('No se pudo abrir la vista del cliente', { description: res.message })
          setPreviewingAsClient(false)
          return
        }
        window.location.assign(res.redirectTo)
      })
    }

    if (userDirty) {
      confirmNavigation(launchPreview, {
        when: true,
        message:
          'Tienes cambios sin guardar. La vista del cliente usa el layout guardado; si sales ahora, perderás los cambios del editor.',
      })
      return
    }

    launchPreview()
  }

  const handleSaveUser = async () => {
    if (!selectedUserId) return
    setSavingUser(true)
    const sorted = userWidgets.slice().sort((a, b) => a.order - b.order)
    const res = await saveDashboardLayoutForUserAction(selectedUserId, sorted)
    setSavingUser(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setIsUserCustom(true)
    setUserBaseline(snapshotLayoutWidgets(sorted))
  }

  const handleSavePlatform = async () => {
    setSavingPlatform(true)
    const sorted = platformWidgets.slice().sort((a, b) => a.order - b.order)
    const res = await savePlatformDefaultLayoutAction(sorted)
    setSavingPlatform(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setPlatformConfigured(true)
    setPlatformBaseline(snapshotLayoutWidgets(sorted))
    if (selectedUserId) void loadUserLayout(selectedUserId)
  }

  const handleApplyToAll = async () => {
    setApplyingToAll(true)
    const res = await applyPlatformTemplateToAllUsersAction()
    setApplyingToAll(false)
    setApplyAllOpen(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    if (selectedUserId) void loadUserLayout(selectedUserId)
  }

  const handleReset = async () => {
    if (!selectedUserId) return
    setResetting(true)
    const res = await resetDashboardLayoutForUserAction(selectedUserId, resetSource)
    setResetting(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setUserWidgets(res.widgets)
    setIsUserCustom(res.isCustom)
    setUserBaseline(snapshotLayoutWidgets(res.widgets))
    toast.success(res.message)
  }

  const handleCopyLayout = async () => {
    if (!selectedUserId || !copySourceUserId) return
    setCopying(true)
    const res = await copyDashboardLayoutFromUserAction(copySourceUserId, selectedUserId)
    setCopying(false)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setUserWidgets(res.widgets)
    setIsUserCustom(true)
    setUserBaseline(snapshotLayoutWidgets(res.widgets))
    toast.success(res.message)
  }

  const handleUserChange = (userId: string) => {
    if (userId === selectedUserId) return
    confirmNavigation(
      () => setSelectedUserId(userId),
      {
        when: userDirty,
        message:
          'Tienes cambios sin guardar en este cliente. Si cambias de usuario, se perderán.',
      },
    )
  }

  const handleLayoutTabChange = (tab: string) => {
    if (tab === layoutTab) return
    if (layoutTab === 'user' && tab === 'platform') {
      confirmNavigation(() => setLayoutTab(tab), {
        when: userDirty,
        message:
          'Tienes cambios sin guardar en el layout del cliente. Guarda antes de ir a la plantilla Up Crop.',
      })
      return
    }
    if (layoutTab === 'platform' && tab === 'user') {
      confirmNavigation(() => setLayoutTab(tab), {
        when: platformDirty,
        message:
          'Tienes cambios sin guardar en la plantilla Up Crop. Guarda antes de cambiar de pestaña.',
      })
      return
    }
    setLayoutTab(tab)
  }

  const showUnsavedBanner =
    (layoutTab === 'user' && userDirty) || (layoutTab === 'platform' && platformDirty)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Layout de Inicio
          </CardTitle>
          <CardDescription>
            Configura widgets, orden y tamaño. La vista previa muestra cómo se verá el Inicio del
            cliente en pantallas medianas y grandes.
          </CardDescription>
        </CardHeader>
      </Card>

      {showUnsavedBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-amber-950 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Tienes cambios sin guardar. Si cambias de pestaña, de cliente o sales del admin, se
              perderán.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            disabled={layoutTab === 'user' ? savingUser : savingPlatform}
            onClick={() =>
              void (layoutTab === 'user' ? handleSaveUser() : handleSavePlatform())
            }
          >
            {layoutTab === 'user' ? (
              savingUser ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )
            ) : savingPlatform ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar ahora
          </Button>
        </div>
      )}

      <Tabs value={layoutTab} onValueChange={handleLayoutTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="user">Por usuario</TabsTrigger>
          <TabsTrigger value="platform">Plantilla Up Crop</TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Plantilla predeterminada global</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Los clientes sin layout personalizado heredan esta plantilla automáticamente.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={platformConfigured ? 'default' : 'secondary'}>
                    {platformConfigured ? 'Configurada' : 'Sin guardar (usa sistema)'}
                  </Badge>
                  <Badge variant="outline">{platformVisibleCount} visibles</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSavePlatform()}
                  disabled={savingPlatform || loadingPlatform || applyingToAll}
                >
                  {savingPlatform ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar plantilla Up Crop
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !platformConfigured ||
                    loadingPlatform ||
                    savingPlatform ||
                    applyingToAll ||
                    users.length === 0
                  }
                  onClick={() => setApplyAllOpen(true)}
                >
                  {applyingToAll ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  Aplicar a todos los clientes
                </Button>
              </div>
              {!platformConfigured && (
                <p className="text-xs text-muted-foreground">
                  Guarda la plantilla antes de aplicarla a todos los clientes.
                </p>
              )}
            </CardContent>
          </Card>

          <DashboardLayoutPreview widgets={platformWidgets} />

          <DashboardWidgetEditor
            widgets={platformWidgets}
            loading={loadingPlatform}
            onChange={setPlatformWidgets}
          />
        </TabsContent>

        <TabsContent value="user" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label htmlFor="layout-user">Usuario</Label>
                  {loadingUsers ? (
                    <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando usuarios…
                    </div>
                  ) : (
                    <LayoutUserCombobox
                      id="layout-user"
                      users={users}
                      value={selectedUserId}
                      onValueChange={handleUserChange}
                      placeholder="Buscar por nombre o email…"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-source">Restaurar a</Label>
                  <Select
                    value={resetSource}
                    onValueChange={(v) => setResetSource(v as ResetLayoutSource)}
                  >
                    <SelectTrigger id="reset-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {RESET_OPTIONS.find((o) => o.value === resetSource)?.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleReset()}
                    disabled={!selectedUserId || resetting || loadingUserLayout}
                  >
                    {resetting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restaurar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveUser()}
                    disabled={!selectedUserId || savingUser || loadingUserLayout}
                  >
                    {savingUser ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Guardar layout
                  </Button>
                </div>
              </div>

              {isSubuserSelected && (
                <Alert className="border-sky-500/30 bg-sky-500/5">
                  <Users className="text-sky-600 dark:text-sky-400" />
                  <AlertTitle>Layout del cliente principal</AlertTitle>
                  <AlertDescription>
                    El Inicio de <strong>{selectedUser?.full_name || selectedUser?.email}</strong>{' '}
                    lo define el cliente principal{' '}
                    <strong>{parentDisplayName}</strong>. Los cambios que guardes aquí se aplican al
                    principal y a todos sus subusuarios.
                  </AlertDescription>
                </Alert>
              )}

              {selectedUser && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {isSubuserSelected ? (
                    <Badge variant="secondary">Subusuario</Badge>
                  ) : null}
                  <Badge variant={isUserCustom ? 'default' : 'secondary'}>
                    {isUserCustom ? 'Layout personalizado' : `Hereda: ${fallbackLabel}`}
                  </Badge>
                  <span className="text-muted-foreground">
                    {userVisibleCount} widget{userVisibleCount !== 1 ? 's' : ''} visible
                  </span>
                </div>
              )}

              {copySourceOptions.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="copy-source-user">Copiar layout desde</Label>
                    <LayoutUserCombobox
                      id="copy-source-user"
                      users={copySourceOptions}
                      value={copySourceUserId}
                      onValueChange={setCopySourceUserId}
                      placeholder="Buscar cliente origen…"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!copySourceUserId || copying || loadingUserLayout}
                    onClick={() => void handleCopyLayout()}
                  >
                    {copying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copiar y guardar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Vista previa del grid</p>
              <p className="text-xs text-muted-foreground">
                Aproximación del Inicio en pantallas medianas y grandes.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!selectedUserId || loadingUserLayout || previewingAsClient || previewPending}
              onClick={handlePreviewAsClient}
            >
              {previewingAsClient || previewPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Ver Inicio como cliente
            </Button>
          </div>

          <DashboardLayoutPreview widgets={userWidgets} />

          <DashboardWidgetEditor
            widgets={userWidgets}
            loading={loadingUserLayout}
            onChange={setUserWidgets}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={applyAllOpen} onOpenChange={setApplyAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aplicar plantilla a todos los clientes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Se copiará la <strong>plantilla Up Crop guardada</strong> a los clientes{' '}
                  <strong>principales</strong> ({users.filter(u => isPrincipalClientProfile(u)).length}).
                  Los subusuarios heredan del principal.
                </p>
                <p>
                  Esto <strong>sobrescribe</strong> cualquier layout personalizado de los principales.
                  Los cambios se verán al recargar Inicio.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyingToAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={applyingToAll}
              onClick={(e) => {
                e.preventDefault()
                void handleApplyToAll()
              }}
            >
              {applyingToAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              ) : (
                'Sí, aplicar a todos'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
