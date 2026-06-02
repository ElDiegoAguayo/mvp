'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Ban, Clock, Crown, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  blockClientAccountAction,
  listClientServicePlansAction,
  type ClientServicePlanRow,
} from '@/app/admin/actions'
import { AssignServicePlanDialog } from '@/components/admin/assign-service-plan-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { getServicePlanBadgeClass, getServicePlanLabel } from '@/lib/service-plan-admin'
import { SERVICE_PLAN_EXPIRING_SOON_DAYS } from '@/lib/service-plan-subscription'
import { cn } from '@/lib/utils'

function formatAdminDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function StatusBadge({ row }: { row: ClientServicePlanRow }) {
  if (!row.is_active) {
    return <Badge variant="outline" className="text-destructive border-destructive/40">Bloqueado</Badge>
  }
  if (row.status === 'expired') {
    return <Badge variant="destructive">Vencido</Badge>
  }
  if (row.status === 'expiring') {
    return (
      <Badge className="bg-amber-500/90 text-white hover:bg-amber-500/90">
        Por vencer
        {row.daysUntilExpiry != null && row.daysUntilExpiry > 0 && ` (${row.daysUntilExpiry}d)`}
      </Badge>
    )
  }
  return <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600/90">Activo</Badge>
}

interface ServicePlansClientsManagerProps {
  initialClients: ClientServicePlanRow[]
}

export function ServicePlansClientsManager({ initialClients }: ServicePlansClientsManagerProps) {
  const [clients, setClients] = useState(initialClients)
  const [activeTab, setActiveTab] = useState('expiring')
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [blockTarget, setBlockTarget] = useState<ClientServicePlanRow | null>(null)
  const [assignUser, setAssignUser] = useState<ClientServicePlanRow | null>(null)
  const [isRefreshing, startRefresh] = useTransition()

  const expiring = useMemo(
    () => clients.filter(c => c.status === 'expiring' && c.is_active),
    [clients],
  )
  const expired = useMemo(
    () => clients.filter(c => c.status === 'expired'),
    [clients],
  )
  const active = useMemo(
    () => clients.filter(c => c.status === 'active' && c.is_active),
    [clients],
  )

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const rows = await listClientServicePlansAction()
      setClients(rows)
    })
  }, [])

  const handleBlock = async (row: ClientServicePlanRow) => {
    setBlockingId(row.id)
    const result = await blockClientAccountAction(row.id)
    setBlockingId(null)
    setBlockTarget(null)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    setClients(prev =>
      prev.map(c => (c.id === row.id ? { ...c, is_active: false } : c)),
    )
  }

  const renderTable = (rows: ClientServicePlanRow[], showBlock = false) => {
    if (rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Crown className="h-8 w-8 opacity-40" />
          <p className="text-sm">No hay clientes en esta categoría.</p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/40">
              <TableHead>Cliente</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Activado</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id} className={cn(!row.is_active && 'opacity-70')}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {row.full_name || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', getServicePlanBadgeClass(row.service_plan_id))}>
                    {getServicePlanLabel(row.service_plan_id)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatAdminDateTime(row.service_plan_activated_at)}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatAdminDateTime(row.service_plan_expires_at)}
                </TableCell>
                <TableCell>
                  <StatusBadge row={row} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignUser(row)}
                    >
                      <Crown className="mr-1 h-3.5 w-3.5" />
                      Renovar
                    </Button>
                    {showBlock && row.is_active && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={blockingId === row.id}
                        onClick={() => setBlockTarget(row)}
                      >
                        {blockingId === row.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Ban className="mr-1 h-3.5 w-3.5" />
                        )}
                        Bloquear
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Planes de servicio — Clientes
            </h1>
          </div>
          <p className="text-sm text-muted-foreground sm:text-base max-w-2xl">
            Vigencia de 1 mes por asignación. Revisa planes por vencer (últimos{' '}
            {SERVICE_PLAN_EXPIRING_SOON_DAYS} días), vencidos y renueva o bloquea cuentas.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin?tab=usuarios">Volver a usuarios</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Por vencer
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{expiring.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Vencidos
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{expired.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-emerald-600" />
              Activos
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{active.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-foreground">
              {expiring.length} cliente{expiring.length !== 1 ? 's' : ''} con plan por vencer en los
              próximos {SERVICE_PLAN_EXPIRING_SOON_DAYS} días. Renueva el plan para extender 1 mes
              más.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="expiring" className="gap-2">
            <Clock className="h-4 w-4" />
            Por vencer ({expiring.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Vencidos ({expired.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Crown className="h-4 w-4" />
            Todos ({clients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expiring" className="mt-4">
          {renderTable(expiring)}
        </TabsContent>
        <TabsContent value="expired" className="mt-4">
          {renderTable(expired, true)}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {renderTable(clients, true)}
        </TabsContent>
      </Tabs>

      <AssignServicePlanDialog
        open={!!assignUser}
        onOpenChange={open => {
          if (!open) setAssignUser(null)
        }}
        user={assignUser}
        onSaved={() => {
          setAssignUser(null)
          refresh()
        }}
      />

      <AlertDialog open={!!blockTarget} onOpenChange={open => !open && setBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Bloquear cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget && (
                <>
                  Se bloqueará a{' '}
                  <strong>{blockTarget.full_name || blockTarget.email}</strong>. No podrá iniciar
                  sesión hasta que lo desbloquees desde la tabla de usuarios.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => blockTarget && handleBlock(blockTarget)}
            >
              Bloquear usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
