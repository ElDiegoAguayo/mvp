'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  DatabaseBackup, Download, Trash2, Loader2, RotateCcw,
  ShieldAlert, HardDrive, CalendarDays, FileJson, Plus, RefreshCw,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createBackupAction,
  listBackupsAction,
  downloadBackupAction,
  restoreBackupAction,
  deleteBackupAction,
  type BackupMeta,
} from '@/app/admin/actions'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  let relative = ''
  if (mins < 1)    relative = 'Hace un momento'
  else if (mins < 60) relative = `Hace ${mins} min`
  else if (hours < 24) relative = `Hace ${hours}h`
  else if (days === 1) relative = 'Ayer'
  else relative = `Hace ${days} días`

  return {
    date: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    relative,
  }
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function BackupManager() {
  const [backups,     setBackups]     = useState<BackupMeta[]>([])
  const [loading,     setLoading]     = useState(true)
  const [isPending,   startTransition] = useTransition()
  const [customLabel, setCustomLabel] = useState('')

  // Confirm states
  const [confirmRestore, setConfirmRestore] = useState<BackupMeta | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState<BackupMeta | null>(null)
  const [downloadingId,  setDownloadingId]  = useState<string | null>(null)

  const loadBackups = useCallback(async () => {
    setLoading(true)
    const data = await listBackupsAction()
    setBackups(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadBackups() }, [loadBackups])

  // ── Create backup ────────────────────────────────────────────────────────────
  function handleCreate() {
    startTransition(async () => {
      const res = await createBackupAction(customLabel || undefined)
      if (res.ok) {
        toast.success(res.message)
        setCustomLabel('')
        loadBackups()
      } else {
        toast.error(res.message)
      }
    })
  }

  // ── Download backup ──────────────────────────────────────────────────────────
  async function handleDownload(backup: BackupMeta) {
    setDownloadingId(backup.fileName)
    try {
      const res = await downloadBackupAction(backup.fileName)
      if (!res.ok || !res.data) {
        toast.error(res.message ?? 'Error al descargar.')
        return
      }
      const blob = new Blob([res.data], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = backup.fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup descargado.')
    } catch {
      toast.error('Error inesperado al descargar.')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Restore backup ───────────────────────────────────────────────────────────
  function handleRestore(backup: BackupMeta) {
    startTransition(async () => {
      const res = await restoreBackupAction(backup.fileName)
      if (res.ok) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
      setConfirmRestore(null)
    })
  }

  // ── Delete backup ────────────────────────────────────────────────────────────
  function handleDelete(backup: BackupMeta) {
    startTransition(async () => {
      const res = await deleteBackupAction(backup.fileName)
      if (res.ok) {
        toast.success(res.message)
        loadBackups()
      } else {
        toast.error(res.message)
      }
      setConfirmDelete(null)
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const latestBackup = backups[0] ?? null

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
              <DatabaseBackup className="w-5 h-5 text-[#4A6CF7]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Copias de Seguridad</h2>
              <p className="text-xs text-muted-foreground">
                Exporta y restaura el estado completo de la base de datos
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-300">Importante sobre la restauración</p>
            <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5 leading-relaxed">
              La restauración usa una estrategia <strong>upsert</strong>: actualiza y recupera filas del backup pero
              <strong> no elimina</strong> filas nuevas creadas después del snapshot. Es ideal para revertir
              cambios accidentales o recuperar datos borrados. Los logs de auditoría <strong>no se restauran</strong> para preservar la trazabilidad.
            </p>
          </div>
        </div>

        {/* Create new backup */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#4A6CF7]" />
            Crear nuevo backup
          </h3>
          <div className="flex gap-3">
            <Input
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="Descripción opcional (ej: Antes de migración de módulos)"
              className="flex-1 bg-background"
              disabled={isPending}
              onKeyDown={e => e.key === 'Enter' && !isPending && handleCreate()}
            />
            <Button
              onClick={handleCreate}
              disabled={isPending}
              className="gap-2 bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white shrink-0"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <DatabaseBackup className="w-4 h-4" />
              }
              Crear backup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se incluyen: perfiles, módulos, permisos, tablas dinámicas, datos, gráficos, inventario, notificaciones, carpetas, documentos, links compartidos y manifiesto de almacenamiento boveda.
          </p>
        </div>

        {/* Backup list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-secondary/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Backup</span>
            <span className="text-right">Tamaño</span>
            <span className="text-center">Estado</span>
            <span className="text-right">Acciones</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <HardDrive className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">No hay backups creados aún.</p>
              <Button variant="outline" size="sm" onClick={handleCreate} disabled={isPending} className="gap-2">
                <DatabaseBackup className="w-4 h-4" />
                Crear el primero
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {backups.map((backup, idx) => {
                const { date, time, relative } = formatDate(backup.createdAt)
                const isLatest = idx === 0
                const isDownloading = downloadingId === backup.fileName

                return (
                  <div
                    key={backup.fileName}
                    className={cn(
                      'grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-secondary/30 transition-colors',
                      isLatest && 'bg-[#4A6CF7]/5'
                    )}
                  >
                    {/* Info */}
                    <div className="min-w-0 flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
                        isLatest ? 'bg-[#4A6CF7]/10 border-[#4A6CF7]/30' : 'bg-secondary border-border'
                      )}>
                        <FileJson className={cn('w-4 h-4', isLatest ? 'text-[#4A6CF7]' : 'text-muted-foreground')} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">{backup.fileName.replace('.json', '')}</span>
                          {isLatest && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#4A6CF7]/15 text-[#4A6CF7] border border-[#4A6CF7]/30 shrink-0">
                              Más reciente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          <span>{date} a las {time}</span>
                          <span className="text-border">·</span>
                          <span>{relative}</span>
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-right">
                      <span className="text-sm font-mono text-muted-foreground">
                        {backup.sizeBytes > 0 ? formatBytes(backup.sizeBytes) : '—'}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Disponible
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="outline" size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleDownload(backup)}
                        disabled={isDownloading || isPending}
                        title="Descargar JSON"
                      >
                        {isDownloading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />
                        }
                        <span className="hidden sm:inline">Descargar</span>
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="h-8 gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => setConfirmRestore(backup)}
                        disabled={isPending}
                        title="Restaurar base de datos a este backup"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Restaurar</span>
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDelete(backup)}
                        disabled={isPending}
                        title="Eliminar backup"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stats footer */}
        {backups.length > 0 && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              {backups.length} backup{backups.length !== 1 ? 's' : ''} almacenado{backups.length !== 1 ? 's' : ''}
            </span>
            {latestBackup && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Último: {formatDate(latestBackup.createdAt).relative}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              Total: {formatBytes(backups.reduce((acc, b) => acc + b.sizeBytes, 0))}
            </span>
          </div>
        )}
      </div>

      {/* ── Restore confirmation ── */}
      <AlertDialog open={!!confirmRestore} onOpenChange={open => !open && setConfirmRestore(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Restaurar base de datos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Vas a restaurar la base de datos al estado guardado en:
                </p>
                <div className="bg-secondary rounded-lg p-3 font-mono text-xs">
                  {confirmRestore?.fileName}
                </div>
                <p>
                  Esta acción <strong>actualiza y recupera</strong> todas las filas del backup mediante upsert.
                  Los datos creados después de este snapshot <strong>no se eliminarán</strong>.
                </p>
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  ¿Estás seguro que deseas continuar?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Sí, restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. El archivo <strong>{confirmDelete?.fileName}</strong> se eliminará permanentemente del almacenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
