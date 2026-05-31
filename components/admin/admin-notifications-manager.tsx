'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Bell, Plus, Trash2, Loader2, Megaphone, CheckCircle2,
  AlertTriangle, Info, X, CalendarDays, Pencil, Users, ShieldCheck, User, Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isLocalizedText } from '@/lib/i18n/localized-text'
import { TimezoneGlobePanel } from '@/components/admin/timezone-globe-panel'
import {
  createAdminNotificationAction,
  updateAdminNotificationAction,
  deleteAdminNotificationAction,
  listAdminNotificationsAction,
  type AdminNotificationRow,
} from '@/app/admin/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS = [
  { value: 'info',     label: 'Información', color: 'text-blue-600 dark:text-blue-400',        bg: 'bg-blue-500/10 border-blue-500/30',        icon: Info          },
  { value: 'success',  label: 'Éxito',       color: 'text-emerald-600 dark:text-emerald-400',   bg: 'bg-emerald-500/10 border-emerald-500/30',   icon: CheckCircle2  },
  { value: 'warning',  label: 'Advertencia', color: 'text-amber-600 dark:text-amber-400',       bg: 'bg-amber-500/10 border-amber-500/30',       icon: AlertTriangle },
  { value: 'critical', label: 'Crítico',     color: 'text-rose-600 dark:text-rose-400',         bg: 'bg-rose-500/10 border-rose-500/30',         icon: AlertTriangle },
]

const ROLE_OPTIONS = [
  { value: 'all',   label: 'Todos los usuarios',   icon: Users,       color: 'text-[#4A6CF7]' },
  { value: 'admin', label: 'Solo Administradores', icon: ShieldCheck, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'user',  label: 'Solo Clientes',        icon: User,        color: 'text-emerald-600 dark:text-emerald-400' },
]

function getSeverityMeta(severity: string) {
  return SEVERITY_OPTIONS.find(s => s.value === severity) ?? SEVERITY_OPTIONS[0]
}

function getRoleMeta(role?: string) {
  return ROLE_OPTIONS.find(r => r.value === (role ?? 'all')) ?? ROLE_OPTIONS[0]
}

function getNotificationStatus(row: AdminNotificationRow): 'active' | 'upcoming' | 'expired' {
  const now  = Date.now()
  const from = new Date(row.active_from).getTime()
  const to   = new Date(row.active_until).getTime()
  if (now < from) return 'upcoming'
  if (now > to)   return 'expired'
  return 'active'
}

function formatDateLocal(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function todayInputValue() {
  const d = new Date(); d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

function weekFromNowInputValue() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

// Convert stored ISO date to datetime-local input format (YYYY-MM-DDTHH:MM)
function isoToLocalInput(iso: string) {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'active' | 'upcoming' | 'expired' }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Activa
    </span>
  )
  if (status === 'upcoming') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
      <CalendarDays className="w-3 h-3" />
      Programada
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
      <X className="w-3 h-3" />
      Expirada
    </span>
  )
}

// ─── Notification form (create / edit) ───────────────────────────────────────

interface NotifFormState {
  titleEs: string
  titleEn: string
  messageEs: string
  messageEn: string
  severity: string
  activeFrom: string
  activeUntil: string
  targetRole: string
}

function emptyForm(): NotifFormState {
  return {
    titleEs: '', titleEn: '', messageEs: '', messageEn: '',
    severity: 'info',
    activeFrom: todayInputValue(), activeUntil: weekFromNowInputValue(),
    targetRole: 'admin',
  }
}

function formFromRow(row: AdminNotificationRow): NotifFormState {
  const titleI18n = isLocalizedText(row.title_i18n) ? row.title_i18n : null
  const messageI18n = isLocalizedText(row.message_i18n) ? row.message_i18n : null
  return {
    titleEs: titleI18n?.es ?? row.title,
    titleEn: titleI18n?.en ?? row.title,
    messageEs: messageI18n?.es ?? row.message,
    messageEn: messageI18n?.en ?? row.message,
    severity: row.severity,
    activeFrom: isoToLocalInput(row.active_from),
    activeUntil: isoToLocalInput(row.active_until),
    targetRole: row.target_role ?? 'all',
  }
}

function isFormComplete(form: NotifFormState): boolean {
  return Boolean(
    form.titleEs.trim() &&
    form.titleEn.trim() &&
    form.messageEs.trim() &&
    form.messageEn.trim(),
  )
}

interface NotifFormProps {
  form: NotifFormState
  onChange: (f: NotifFormState) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  isEdit: boolean
}

function NotifForm({ form, onChange, onSubmit, onCancel, isPending, isEdit }: NotifFormProps) {
  const meta = getSeverityMeta(form.severity)
  const SeverityIcon = meta.icon

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {isEdit ? <Pencil className="w-4 h-4 text-[#4A6CF7]" /> : <Bell className="w-4 h-4 text-[#4A6CF7]" />}
        {isEdit ? 'Editar notificación' : 'Nueva notificación'}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ES content */}
        <div className="sm:col-span-2 rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <span className="inline-flex px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px]">ES</span>
            Texto para usuarios con la página en español
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título (ES) *</label>
            <Input
              value={form.titleEs}
              onChange={e => onChange({ ...form, titleEs: e.target.value })}
              placeholder="Ej: Mantenimiento programado"
              className="bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mensaje (ES) *</label>
            <textarea
              value={form.messageEs}
              onChange={e => onChange({ ...form, messageEs: e.target.value })}
              placeholder="Describe el aviso que verán los usuarios en español..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        {/* EN content */}
        <div className="sm:col-span-2 rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <span className="inline-flex px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px]">EN</span>
            Text for users with the page in English
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title (EN) *</label>
            <Input
              value={form.titleEn}
              onChange={e => onChange({ ...form, titleEn: e.target.value })}
              placeholder="E.g.: Scheduled maintenance"
              className="bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Message (EN) *</label>
            <textarea
              value={form.messageEn}
              onChange={e => onChange({ ...form, messageEn: e.target.value })}
              placeholder="Describe the notice English-speaking users will see..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={form.severity} onValueChange={v => onChange({ ...form, severity: v })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <span className={cn('font-medium', s.color)}>{s.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target role */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Destinatarios</label>
          <Select value={form.targetRole} onValueChange={v => onChange({ ...form, targetRole: v })}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(r => {
                const RoleIcon = r.icon
                return (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="flex items-center gap-2">
                      <RoleIcon className={cn('w-3.5 h-3.5', r.color)} />
                      <span className="font-medium">{r.label}</span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Severity preview */}
        <div className="sm:col-span-2">
          <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium', meta.bg, meta.color)}>
            <SeverityIcon className="w-3.5 h-3.5 shrink-0" />
            Vista previa: así verán los usuarios este tipo de alerta
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Visible desde *</label>
          <Input type="datetime-local" value={form.activeFrom} onChange={e => onChange({ ...form, activeFrom: e.target.value })} className="bg-background" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Visible hasta *</label>
          <Input type="datetime-local" value={form.activeUntil} onChange={e => onChange({ ...form, activeUntil: e.target.value })} className="bg-background" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancelar</Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isPending || !isFormComplete(form)}
          className="gap-2 bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white"
        >
          {isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />
          }
          {isEdit ? 'Guardar cambios' : 'Publicar notificación'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminNotificationsManager() {
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [isPending,     startTransition]  = useTransition()

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm,     setCreateForm]     = useState<NotifFormState>(emptyForm)

  // Edit form
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState<NotifFormState>(emptyForm)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [timezoneOpen, setTimezoneOpen] = useState(false)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    const data = await listAdminNotificationsAction()
    setNotifications(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  // ── Create ────────────────────────────────────────────────────────────────────
  function handleCreate() {
    if (!isFormComplete(createForm)) {
      toast.error('Completa título y mensaje en español e inglés.')
      return
    }
    if (new Date(createForm.activeUntil) <= new Date(createForm.activeFrom)) {
      toast.error('La fecha de fin debe ser posterior a la de inicio.')
      return
    }
    const fd = new FormData()
    fd.append('title_es',     createForm.titleEs.trim())
    fd.append('title_en',     createForm.titleEn.trim())
    fd.append('message_es',   createForm.messageEs.trim())
    fd.append('message_en',   createForm.messageEn.trim())
    fd.append('severity',     createForm.severity)
    fd.append('active_from',  createForm.activeFrom)
    fd.append('active_until', createForm.activeUntil)
    fd.append('target_role',  createForm.targetRole)

    startTransition(async () => {
      const res = await createAdminNotificationAction(fd)
      if (res.ok) {
        toast.success(res.message)
        setShowCreateForm(false)
        setCreateForm(emptyForm())
        loadNotifications()
      } else {
        toast.error(res.message)
      }
    })
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  function startEdit(notif: AdminNotificationRow) {
    setEditingId(notif.id)
    setEditForm(formFromRow(notif))
    setShowCreateForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleUpdate() {
    if (!editingId) return
    if (!isFormComplete(editForm)) {
      toast.error('Completa título y mensaje en español e inglés.')
      return
    }
    if (new Date(editForm.activeUntil) <= new Date(editForm.activeFrom)) {
      toast.error('La fecha de fin debe ser posterior a la de inicio.')
      return
    }
    const fd = new FormData()
    fd.append('title_es',     editForm.titleEs.trim())
    fd.append('title_en',     editForm.titleEn.trim())
    fd.append('message_es',   editForm.messageEs.trim())
    fd.append('message_en',   editForm.messageEn.trim())
    fd.append('severity',     editForm.severity)
    fd.append('active_from',  editForm.activeFrom)
    fd.append('active_until', editForm.activeUntil)
    fd.append('target_role',  editForm.targetRole)

    const id = editingId
    startTransition(async () => {
      const res = await updateAdminNotificationAction(id, fd)
      if (res.ok) {
        toast.success(res.message)
        setEditingId(null)
        loadNotifications()
      } else {
        toast.error(res.message)
      }
    })
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAdminNotificationAction(id)
      if (res.ok) {
        toast.success(res.message)
        loadNotifications()
      } else {
        toast.error(res.message)
      }
      setConfirmDelete(null)
    })
  }

  const activeCount   = notifications.filter(n => getNotificationStatus(n) === 'active').length
  const upcomingCount = notifications.filter(n => getNotificationStatus(n) === 'upcoming').length

  return (
    <>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#4A6CF7]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Notificaciones</h2>
              <p className="text-xs text-muted-foreground">
                Mensajes que aparecen en el Centro de Notificaciones
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeCount} activa{activeCount !== 1 ? 's' : ''}
              </span>
            )}
            {upcomingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                <CalendarDays className="w-3 h-3" />
                {upcomingCount} programada{upcomingCount !== 1 ? 's' : ''}
              </span>
            )}
            <Button
              onClick={() => setTimezoneOpen(v => !v)}
              size="sm"
              variant={timezoneOpen ? 'default' : 'outline'}
              className={cn(
                'gap-2',
                timezoneOpen && 'bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white',
              )}
            >
              <Globe2 className="w-4 h-4" />
              Zona horaria
            </Button>
            <Button
              onClick={() => { setShowCreateForm(v => !v); setEditingId(null) }}
              size="sm"
              className="gap-2 bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white"
            >
              <Plus className="w-4 h-4" />
              Nueva notificación
            </Button>
          </div>
        </div>

        <TimezoneGlobePanel open={timezoneOpen} onOpenChange={setTimezoneOpen} />

        {/* Create form */}
        {showCreateForm && !editingId && (
          <NotifForm
            form={createForm}
            onChange={setCreateForm}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setCreateForm(emptyForm()) }}
            isPending={isPending}
            isEdit={false}
          />
        )}

        {/* Notifications list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando notificaciones...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Megaphone className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">No hay notificaciones creadas aún.</p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Crear la primera
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-5 py-3 bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Notificación</span>
                <span className="text-center">Destinatarios</span>
                <span className="text-center">Tipo</span>
                <span className="text-center">Estado</span>
                <span />
              </div>

              {notifications.map(notif => {
                const meta       = getSeverityMeta(notif.severity)
                const roleMeta   = getRoleMeta(notif.target_role)
                const RoleIcon   = roleMeta.icon
                const status     = getNotificationStatus(notif)
                const SevIcon    = meta.icon
                const isEditing  = editingId === notif.id

                return (
                  <div key={notif.id}>
                    {/* Edit form inline */}
                    {isEditing ? (
                      <div className="px-5 py-4">
                        <NotifForm
                          form={editForm}
                          onChange={setEditForm}
                          onSubmit={handleUpdate}
                          onCancel={cancelEdit}
                          isPending={isPending}
                          isEdit={true}
                        />
                      </div>
                    ) : (
                      <div className={cn(
                        'grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-start px-5 py-4 hover:bg-secondary/30 transition-colors',
                        status === 'expired' && 'opacity-55'
                      )}>
                        {/* Content */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={cn('p-1 rounded-md border', meta.bg)}>
                              <SevIcon className={cn('w-3.5 h-3.5', meta.color)} />
                            </div>
                            <span className="font-semibold text-sm text-foreground truncate">{notif.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.message}</p>
                          {isLocalizedText(notif.title_i18n) && notif.title_i18n.en !== notif.title_i18n.es && (
                            <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-1">
                              <span className="font-semibold text-[10px] uppercase mr-1">EN</span>
                              {notif.title_i18n.en}
                            </p>
                          )}
                          <div className="flex items-center gap-3 pt-0.5">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {formatDateLocal(notif.active_from)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">→</span>
                            <span className="text-[10px] text-muted-foreground">{formatDateLocal(notif.active_until)}</span>
                          </div>
                        </div>

                        {/* Role */}
                        <div className="flex items-start pt-1">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-secondary text-muted-foreground border-border')}>
                            <RoleIcon className={cn('w-3 h-3', roleMeta.color)} />
                            {roleMeta.label}
                          </span>
                        </div>

                        {/* Severity */}
                        <div className="flex items-start pt-1">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', meta.bg, meta.color)}>
                            {meta.label}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="flex items-start pt-1">
                          <StatusBadge status={status} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-start gap-1 pt-0.5">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-[#4A6CF7] hover:bg-[#4A6CF7]/10"
                            onClick={() => startEdit(notif)}
                            disabled={isPending}
                            title="Editar notificación"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete(notif.id)}
                            disabled={isPending}
                            title="Eliminar notificación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar notificación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los usuarios dejarán de ver este mensaje de inmediato.
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
