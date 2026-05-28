'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Folder, FolderOpen, FileText, FileSpreadsheet, Image as ImageIcon,
  HardDrive, Link2, Download, Trash2, Loader2, Search, ChevronRight,
  Home, RefreshCw, ShieldAlert, Copy, Check, ExternalLink, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VaultFilePreviewDialog } from '@/components/vault/vault-file-preview-dialog'
import { isVaultPreviewable, resolveVaultPreviewKind } from '@/lib/vault-preview'
import {
  getVaultClientsSummaryAction,
  getVaultClientExplorerAction,
  getVaultSharedLinksAction,
  revokeVaultSharedLinkAction,
  getVaultFileDownloadUrlAction,
  adminDeleteVaultDocumentAction,
  adminDeleteVaultFolderAction,
  updateClientStorageQuotaAction,
  type VaultClientSummary,
  type VaultDocumentRow,
  type VaultFolderRow,
  type VaultSharedLinkRow,
} from '@/app/admin/actions'
import { VaultStorageBar } from '@/components/vault/vault-storage-bar'
import {
  STORAGE_PLANS,
  storageUsagePercent,
} from '@/lib/vault-storage'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

function fileIcon(type: string, fileName = '') {
  const kind = resolveVaultPreviewKind(type, fileName)
  if (kind === 'excel') return { Icon: FileSpreadsheet, color: 'text-green-500', bg: 'bg-green-500/10' }
  if (kind === 'image') return { Icon: ImageIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' }
  if (kind === 'word') return { Icon: FileText, color: 'text-sky-600', bg: 'bg-sky-500/10' }
  return { Icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' }
}

const FILTER_SELECT =
  'w-full min-w-0 max-w-full overflow-hidden bg-secondary border-border [&_[data-slot=select-value]]:truncate'

/** Raíz = null; trata undefined y string vacío como null. */
function sameVaultFolder(
  itemFolderId: string | null | undefined,
  currentId: string | null,
): boolean {
  const normalize = (v: string | null | undefined) =>
    v === null || v === undefined || v === '' ? null : v
  return normalize(itemFolderId) === normalize(currentId)
}

function isOrphanVaultFile(
  folderId: string | null | undefined,
  knownFolderIds: Set<string>,
): boolean {
  const id = folderId === null || folderId === undefined || folderId === '' ? null : folderId
  return id !== null && !knownFolderIds.has(id)
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function VaultAdminManager() {
  const [clients, setClients]       = useState<VaultClientSummary[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [folders, setFolders]       = useState<VaultFolderRow[]>([])
  const [documents, setDocuments]   = useState<VaultDocumentRow[]>([])
  const [links, setLinks]           = useState<VaultSharedLinkRow[]>([])
  const [clientLabel, setClientLabel] = useState('')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [linkFilter, setLinkFilter] = useState<'active' | 'all'>('active')
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingExplorer, setLoadingExplorer] = useState(false)
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'file' | 'folder'; id: string; name: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<VaultSharedLinkRow | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<VaultDocumentRow | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [quotaPlanId, setQuotaPlanId] = useState<string>('10gb')
  const [isPending, startTransition] = useTransition()

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedId) ?? null,
    [clients, selectedId],
  )

  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    const data = await getVaultClientsSummaryAction()
    setClients(data)
    setLoadingClients(false)
  }, [])

  const loadExplorer = useCallback(async (userId: string) => {
    if (!userId) return
    setLoadingExplorer(true)
    const data = await getVaultClientExplorerAction(userId)
    if (data) {
      setFolders(data.folders)
      setDocuments(data.documents)
      setClientLabel(data.client.full_name || data.client.email || userId)
    } else {
      setFolders([])
      setDocuments([])
      setClientLabel('')
    }
    setCurrentFolderId(null)
    setLoadingExplorer(false)
  }, [])

  const loadLinks = useCallback(async (userId?: string) => {
    setLoadingLinks(true)
    const data = await getVaultSharedLinksAction(userId || undefined)
    setLinks(data)
    setLoadingLinks(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  useEffect(() => {
    if (selectedId) {
      loadExplorer(selectedId)
      loadLinks(selectedId)
    }
  }, [selectedId, loadExplorer, loadLinks])

  const breadcrumbs = useMemo(() => {
    const path: VaultFolderRow[] = []
    let cur = currentFolderId
    while (cur) {
      const folder = folders.find(f => f.id === cur)
      if (!folder) break
      path.unshift(folder)
      cur = folder.parent_id
    }
    return path
  }, [currentFolderId, folders])

  const folderIds = useMemo(() => new Set(folders.map(f => f.id)), [folders])

  const currentFolders = useMemo(() =>
    folders
      .filter(f => sameVaultFolder(f.parent_id, currentFolderId))
      .filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [folders, currentFolderId, search],
  )

  const currentFiles = useMemo(() =>
    documents
      .filter(d => {
        if (sameVaultFolder(d.folder_id, currentFolderId)) return true
        // Archivos huérfanos (carpeta eliminada) visibles en la raíz
        if (currentFolderId === null && isOrphanVaultFile(d.folder_id, folderIds)) return true
        return false
      })
      .filter(d => d.name.toLowerCase().includes(search.toLowerCase())),
    [documents, currentFolderId, search, folderIds],
  )

  const orphanFileCount = useMemo(
    () => documents.filter(d => isOrphanVaultFile(d.folder_id, folderIds)).length,
    [documents, folderIds],
  )

  const filteredLinks = useMemo(() => {
    if (linkFilter === 'all') return links
    return links.filter(l => !l.is_expired)
  }, [links, linkFilter])

  const totals = useMemo(() => ({
    files: clients.reduce((a, c) => a + c.file_count, 0),
    bytes: clients.reduce((a, c) => a + c.total_bytes, 0),
    shares: clients.reduce((a, c) => a + c.active_shares, 0),
  }), [clients])

  useEffect(() => {
    if (selectedClient) {
      setQuotaPlanId(selectedClient.storage_plan_id)
    }
  }, [selectedClient])

  const handleSaveQuota = () => {
    if (!selectedId) return
    startTransition(async () => {
      const res = await updateClientStorageQuotaAction(selectedId, quotaPlanId)
      if (res.ok) {
        toast.success(res.message)
        loadClients()
      } else {
        toast.error(res.message)
      }
    })
  }

  const handleDownload = async (doc: VaultDocumentRow) => {
    const res = await getVaultFileDownloadUrlAction(doc.id)
    if (!res.ok || !res.url) {
      toast.error(res.message ?? 'No se pudo descargar.')
      return
    }
    window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  const handlePreview = (doc: VaultDocumentRow) => {
    if (!isVaultPreviewable(doc.type, doc.name)) return
    setPreviewDoc(doc)
    setIsPreviewOpen(true)
  }

  const fetchPreviewBlob = useCallback(async () => {
    if (!previewDoc) throw new Error('Sin archivo')
    const res = await getVaultFileDownloadUrlAction(previewDoc.id)
    if (!res.ok || !res.url) {
      throw new Error(res.message ?? 'No se pudo obtener el archivo')
    }
    const response = await fetch(res.url)
    if (!response.ok) throw new Error('Error al descargar el archivo')
    return response.blob()
  }, [previewDoc])

  const handleDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = deleteTarget.kind === 'file'
        ? await adminDeleteVaultDocumentAction(deleteTarget.id)
        : await adminDeleteVaultFolderAction(deleteTarget.id)
      if (res.ok) {
        toast.success(res.message)
        if (selectedId) {
          loadExplorer(selectedId)
          loadLinks(selectedId)
          loadClients()
        }
      } else {
        toast.error(res.message)
      }
      setDeleteTarget(null)
    })
  }

  const handleRevoke = () => {
    if (!revokeTarget) return
    startTransition(async () => {
      const res = await revokeVaultSharedLinkAction(revokeTarget.id)
      if (res.ok) {
        toast.success(res.message)
        if (selectedId) {
          loadLinks(selectedId)
          loadClients()
        }
      } else {
        toast.error(res.message)
      }
      setRevokeTarget(null)
    })
  }

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/compartir/${code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header + global stats */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A6CF7]/10 border border-[#4A6CF7]/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-[#4A6CF7]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Mis documentos</h2>
              <p className="text-xs text-muted-foreground">
                Explora archivos por cliente, gestiona links compartidos y revisa uso de almacenamiento
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadClients(); if (selectedId) { loadExplorer(selectedId); loadLinks(selectedId) } }} className="gap-1.5 h-8 shrink-0">
            <RefreshCw className={cn('w-3.5 h-3.5', (loadingClients || loadingExplorer) && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Archivos totales</p>
            <p className="text-2xl font-bold text-foreground">{totals.files.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Almacenamiento</p>
            <p className="text-2xl font-bold text-foreground">{formatBytes(totals.bytes)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Links activos</p>
            <p className="text-2xl font-bold text-foreground">{totals.shares.toLocaleString('es-CL')}</p>
          </div>
        </div>

        {/* Client picker */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <label className="text-xs font-medium text-muted-foreground">Cliente</label>
          <Select value={selectedId || undefined} onValueChange={setSelectedId}>
            <SelectTrigger className={FILTER_SELECT}>
              <SelectValue placeholder={loadingClients ? 'Cargando clientes...' : 'Selecciona un cliente'} />
            </SelectTrigger>
            <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="truncate">
                    {c.full_name || c.email || c.id}
                    {' · '}{c.file_count} arch. · {formatBytes(c.total_bytes)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClient && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">{selectedClient.file_count} archivos</Badge>
                <Badge variant="outline" className="text-xs">{selectedClient.folder_count} carpetas</Badge>
                <Badge variant="outline" className="text-xs">{formatBytes(selectedClient.total_bytes)} usados</Badge>
                <Badge variant="outline" className="text-xs">{selectedClient.active_shares} links activos</Badge>
                <Badge variant="outline" className="text-xs">
                  Plan: {STORAGE_PLANS.find(p => p.id === selectedClient.storage_plan_id)?.label ?? '10 GB'}
                </Badge>
              </div>

              <VaultStorageBar
                usedBytes={selectedClient.total_bytes}
                quotaBytes={selectedClient.quota_bytes}
                compact
              />

              <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1 border-t border-border">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Plan de almacenamiento</label>
                  <Select value={quotaPlanId} onValueChange={setQuotaPlanId}>
                    <SelectTrigger className={FILTER_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORAGE_PLANS.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.label}
                          {storageUsagePercent(selectedClient.total_bytes, plan.quotaBytes) >= 90
                            ? ' · cliente cerca del límite'
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={isPending || quotaPlanId === selectedClient.storage_plan_id}
                  onClick={handleSaveQuota}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar plan
                </Button>
              </div>
            </div>
          )}
        </div>

        {!selectedId ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
            Selecciona un cliente para explorar sus documentos.
          </div>
        ) : (
          <Tabs defaultValue="explorer" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="explorer" className="gap-2">
                <Folder className="w-4 h-4" /> Explorador
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-2">
                <Link2 className="w-4 h-4" /> Links compartidos
              </TabsTrigger>
            </TabsList>

            {/* Explorer */}
            <TabsContent value="explorer" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={currentFolderId ? 'Buscar en esta carpeta...' : 'Buscar archivos y carpetas en la raíz...'}
                  className="pl-9 bg-secondary border-border"
                />
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border bg-secondary/40 text-xs flex-wrap">
                  <button type="button" onClick={() => setCurrentFolderId(null)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Home className="w-3.5 h-3.5" /> {clientLabel || 'Raíz'}
                  </button>
                  {breadcrumbs.map(f => (
                    <span key={f.id} className="inline-flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <button type="button" onClick={() => setCurrentFolderId(f.id)} className="text-muted-foreground hover:text-foreground truncate max-w-[140px]">
                        {f.name}
                      </button>
                    </span>
                  ))}
                </div>

                {loadingExplorer ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando archivos...
                  </div>
                ) : selectedClient && selectedClient.file_count > 0 && documents.length === 0 ? (
                  <div className="py-16 px-6 text-center text-sm space-y-2">
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      Hay {selectedClient.file_count} archivo(s) registrado(s) pero no se pudieron listar.
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Pulsa Actualizar. Si persiste, revisa la tabla documentos en Supabase.
                    </p>
                  </div>
                ) : currentFolders.length === 0 && currentFiles.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Esta carpeta está vacía.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {currentFolderId === null && orphanFileCount > 0 && (
                      <div className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border-b border-amber-500/20">
                        {orphanFileCount} archivo{orphanFileCount !== 1 ? 's' : ''} sin carpeta válida (se muestran aquí en la raíz).
                      </div>
                    )}
                    {currentFolders.map(folder => (
                      <div key={folder.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30">
                        <button type="button" onClick={() => setCurrentFolderId(folder.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Folder className="w-4 h-4 text-amber-500" />
                          </div>
                          <span className="text-sm font-medium truncate">{folder.name}</span>
                        </button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Eliminar carpeta"
                          onClick={() => setDeleteTarget({ kind: 'folder', id: folder.id, name: folder.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {currentFiles.map(doc => {
                      const { Icon, color, bg } = fileIcon(doc.type, doc.name)
                      const canPreview = isVaultPreviewable(doc.type, doc.name)
                      const orphaned = isOrphanVaultFile(doc.folder_id, folderIds)
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30">
                          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
                            <Icon className={cn('w-4 h-4', color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              {orphaned && currentFolderId === null && (
                                <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-300">
                                  Sin carpeta
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatBytes(doc.size)} · {formatDateTime(doc.created_at)}
                              {doc.expires_at && ` · Vence ${formatDateTime(doc.expires_at)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {canPreview && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Vista previa" onClick={() => handlePreview(doc)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Descargar" onClick={() => handleDownload(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              title="Eliminar"
                              onClick={() => setDeleteTarget({ kind: 'file', id: doc.id, name: doc.name })}
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

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Las acciones de eliminación son permanentes y quedan registradas en auditoría. Los links compartidos del archivo también se revocan.</span>
              </div>
            </TabsContent>

            {/* Shared links */}
            <TabsContent value="links" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Select value={linkFilter} onValueChange={v => setLinkFilter(v as 'active' | 'all')}>
                  <SelectTrigger className="w-[180px] bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Solo activos</SelectItem>
                    <SelectItem value="all">Todos (incl. expirados)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filteredLinks.length} link{filteredLinks.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {loadingLinks ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando links...
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">No hay links compartidos para este cliente.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                          <th className="text-left p-3 font-semibold">Archivo</th>
                          <th className="text-left p-3 font-semibold">Creado por</th>
                          <th className="text-left p-3 font-semibold">Expira</th>
                          <th className="text-left p-3 font-semibold">Estado</th>
                          <th className="text-right p-3 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLinks.map(link => (
                          <tr key={link.id} className="border-b border-border hover:bg-secondary/20">
                            <td className="p-3">
                              <p className="font-medium truncate max-w-[200px]">{link.file_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{link.code}</p>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {link.creator_name || link.creator_email || '—'}
                            </td>
                            <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(link.expires_at)}</td>
                            <td className="p-3">
                              {link.is_expired ? (
                                <Badge className="text-[10px] bg-muted text-muted-foreground border border-border">Expirado</Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">Activo</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copiar URL" onClick={() => copyLink(link.code)}>
                                  {copiedCode === link.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Abrir" asChild>
                                  <a href={`/compartir/${link.code}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                                {!link.is_expired && (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                    title="Revocar link"
                                    disabled={isPending}
                                    onClick={() => setRevokeTarget(link)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.kind === 'folder' ? 'carpeta' : 'archivo'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleteTarget?.name}</strong>
              {deleteTarget?.kind === 'folder' && ' y todo su contenido'}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar link compartido?</AlertDialogTitle>
            <AlertDialogDescription>
              El link de <strong>{revokeTarget?.file_name}</strong> dejará de funcionar de inmediato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleRevoke} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(isPreviewOpen || previewDoc) && (
        <VaultFilePreviewDialog
          open={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open)
            if (!open) {
              window.setTimeout(() => setPreviewDoc(null), 220)
            }
          }}
          fileName={previewDoc?.name ?? ''}
          fileType={previewDoc?.type ?? 'pdf'}
          fileSize={previewDoc?.size}
          fetchBlob={fetchPreviewBlob}
          onDownload={previewDoc ? () => handleDownload(previewDoc) : undefined}
        />
      )}
    </>
  )
}
