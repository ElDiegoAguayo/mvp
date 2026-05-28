'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Trash2,
  Search,
  X,
  CheckCircle2,
  Loader2,
  Folder,
  ChevronRight,
  Home,
  MoreVertical,
  Plus,
  ArrowLeft,
  Eye,
  Share2,
  Copy,
  Check,
  Clock,
  Link2,
  FolderInput,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { logAudit, type AuditActionType } from '@/lib/audit-log'
import { toast } from 'sonner'
import { VaultFilePreviewDialog } from '@/components/vault/vault-file-preview-dialog'
import { VaultStorageBar } from '@/components/vault/vault-storage-bar'
import { inferVaultFileType, isVaultPreviewable, resolveVaultPreviewKind } from '@/lib/vault-preview'
import { formatStorageBytes, formatAvailableStorage } from '@/lib/vault-storage'
import {
  getMyVaultDataAction,
  uploadVaultDocumentAction,
  type VaultStorageInfo,
} from '@/app/actions/vault-documents-actions'
import {
  isAllowedVaultUpload,
  VAULT_MAX_UPLOAD_BYTES,
} from '@/lib/vault-upload'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VaultFolder {
  id: string
  name: string
  parentId: string | null
}

interface VaultFile {
  id: string
  name: string
  size: number // bytes
  type: 'pdf' | 'excel' | 'image' | 'word'
  folderId: string | null
  storagePath?: string // Supabase storage path
  createdAt: string // ISO date
  expiresAt?: string | null
}

type FileTypeFilter = 'all' | 'pdf' | 'excel' | 'image' | 'word'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Hace unos minutos'
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatExpiryDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Fecha inválida'
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpiringSoon(isoDate?: string | null): boolean {
  if (!isoDate) return false
  const now = new Date()
  const expires = new Date(isoDate)
  if (Number.isNaN(expires.getTime())) return false
  const diffMs = expires.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 30
}

function getFileIcon(type: VaultFile['type']) {
  switch (type) {
    case 'pdf':
      return { Icon: FileText, bgColor: 'bg-red-500/10 dark:bg-red-500/20', iconColor: 'text-red-500' }
    case 'excel':
      return { Icon: FileSpreadsheet, bgColor: 'bg-green-500/10 dark:bg-green-500/20', iconColor: 'text-green-500' }
    case 'image':
      return { Icon: ImageIcon, bgColor: 'bg-blue-500/10 dark:bg-blue-500/20', iconColor: 'text-blue-500' }
    case 'word':
      return { Icon: FileText, bgColor: 'bg-sky-500/10 dark:bg-sky-500/20', iconColor: 'text-sky-600' }
  }
}

function normalizeVaultFileType(type: string, name: string): VaultFile['type'] {
  if (type === 'pdf' || type === 'excel' || type === 'image' || type === 'word') return type
  return inferVaultFileType(name)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentVault() {
  // Use useMemo to ensure stable Supabase client reference
  const supabase = useMemo(() => createClient(), [])

  // Data state
  const [folders, setFolders] = useState<VaultFolder[]>([])
  const [files, setFiles] = useState<VaultFile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all')

  // Upload state
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null)
  const [storageInfo, setStorageInfo] = useState<VaultStorageInfo | null>(null)

  // Share state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [shareFile, setShareFile] = useState<VaultFile | null>(null)
  const [shareExpiry, setShareExpiry] = useState<'1d' | '7d' | '14d' | '30d'>('7d')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Move state
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [moveFile, setMoveFile] = useState<VaultFile | null>(null)
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [isBulkMoveDialogOpen, setIsBulkMoveDialogOpen] = useState(false)
  const [bulkMoveTargetFolderId, setBulkMoveTargetFolderId] = useState<string | null>(null)
  const [isBulkMoving, setIsBulkMoving] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // Load data from Supabase (filtered by current user)
  // ─────────────────────────────────────────────────────────────────────────────

  const reloadVault = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getMyVaultDataAction()
      if (!data) {
        setFolders([])
        setFiles([])
        setStorageInfo(null)
        setUserId(null)
        return
      }

      setUserId(data.ownerId)
      setStorageInfo(data.storage)
      setFolders(data.folders.map(f => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
      })))
      setFiles(data.files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: normalizeVaultFileType(f.type, f.name),
        folderId: f.folderId,
        storagePath: f.storagePath,
        createdAt: f.createdAt,
        expiresAt: f.expiresAt,
      })))
    } catch (err) {
      console.error('[v0] Bóveda load error:', err)
      setFolders([])
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadVault()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void reloadVault()
    })

    return () => subscription.unsubscribe()
  }, [supabase, reloadVault])

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────────────────────

  // Build breadcrumb path
  const breadcrumbs = useMemo(() => {
    const path: VaultFolder[] = []
    let currentId = currentFolderId
    while (currentId) {
      const folder = folders.find((f) => f.id === currentId)
      if (folder) {
        path.unshift(folder)
        currentId = folder.parentId
      } else {
        break
      }
    }
    return path
  }, [currentFolderId, folders])

  // Filter folders in current level
  const currentFolders = useMemo(() => {
    const inParent = (parentId: string | null | undefined) => {
      const normalized = parentId === null || parentId === undefined || parentId === '' ? null : parentId
      return normalized === currentFolderId
    }
    return folders
      .filter((f) => inParent(f.parentId))
      .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [folders, currentFolderId, searchQuery])

  // Filter files in current level
  const currentFiles = useMemo(() => {
    const inFolder = (folderId: string | null | undefined) => {
      const normalized = folderId === null || folderId === undefined || folderId === '' ? null : folderId
      return normalized === currentFolderId
    }
    return files
      .filter((f) => inFolder(f.folderId))
      .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((f) => typeFilter === 'all' || resolveVaultPreviewKind(f.type, f.name) === typeFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [files, currentFolderId, searchQuery, typeFilter])

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId)
    setSearchQuery('')
  }, [])

  const goBack = useCallback(() => {
    if (currentFolderId) {
      const currentFolder = folders.find((f) => f.id === currentFolderId)
      setCurrentFolderId(currentFolder?.parentId ?? null)
    }
  }, [currentFolderId, folders])

  const simulateUpload = useCallback(
    async (file: File) => {
      if (!userId) {
        alert('Debes iniciar sesión para subir archivos.')
        return
      }

      const expiresAt = expiryDate || null

      if (!isAllowedVaultUpload(file)) {
        alert('Tipo de archivo no soportado. Solo PDF, JPG, PNG, Excel, CSV y Word.')
        return
      }
      if (file.size > VAULT_MAX_UPLOAD_BYTES) {
        alert('Archivo muy grande. Máximo 10MB.')
        return
      }

      if (storageInfo && storageInfo.usedBytes + file.size > storageInfo.quotaBytes) {
        const available = Math.max(0, storageInfo.quotaBytes - storageInfo.usedBytes)
        alert(
          `No hay espacio suficiente. Tu plan permite ${storageInfo.quotaLabel} y te quedan ${formatAvailableStorage(storageInfo.usedBytes, storageInfo.quotaBytes)} disponibles.`,
        )
        return
      }

      setUploadingFileName(file.name)
      setUploadProgress(20)

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (currentFolderId) formData.append('folderId', currentFolderId)
        if (expiresAt) formData.append('expiresAt', expiresAt)

        setUploadProgress(60)
        const result = await uploadVaultDocumentAction(formData)

        if (!result.ok || !result.file) {
          toast.error(result.message ?? 'Error al subir archivo.')
          if (result.storage) setStorageInfo(result.storage)
          setUploadProgress(null)
          setUploadingFileName(null)
          await reloadVault()
          return
        }

        setUploadProgress(100)
        if (result.storage) setStorageInfo(result.storage)

        const uploaded = result.file
        const newFile: VaultFile = {
          id: uploaded.id,
          name: uploaded.name,
          type: normalizeVaultFileType(uploaded.type, uploaded.name),
          size: uploaded.size,
          folderId: uploaded.folderId,
          storagePath: uploaded.storagePath,
          createdAt: uploaded.createdAt,
          expiresAt: uploaded.expiresAt,
        }

        if (uploaded.folderId !== currentFolderId) {
          setCurrentFolderId(uploaded.folderId)
        }

        await reloadVault()

        toast.success(`"${file.name}" subido correctamente.`)

        setExpiryDate('')

        setTimeout(() => {
          setUploadProgress(null)
          setUploadingFileName(null)
        }, 600)

        void logAudit(supabase, {
          action_type: 'FILE_UPLOAD',
          target_type: 'document',
          target_label: file.name,
          description: `Subió el archivo "${file.name}" a la bóveda documental`,
          metadata: {
            size: file.size,
            type: newFile.type,
            folder_id: uploaded.folderId,
            storage_path: uploaded.storagePath,
          },
        })
      } catch (err) {
        console.error('[v0] Upload failed:', err)
        toast.error('Error inesperado al subir archivo.')
        setUploadProgress(null)
        setUploadingFileName(null)
        await reloadVault()
      }
    },
    [currentFolderId, expiryDate, supabase, userId, storageInfo, reloadVault],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) simulateUpload(droppedFile)
    },
    [simulateUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) simulateUpload(selectedFile)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [simulateUpload],
  )

  const handleDeleteFile = useCallback(async (id: string) => {
    const file = files.find(f => f.id === id)
    if (file?.storagePath) {
      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage.from('boveda').remove([file.storagePath])
      if (storageError) {
        console.error('[v0] Storage delete error:', storageError)
      }
      // Delete from database
      const { error: dbError } = await supabase.from('documentos').delete().eq('id', id)
      if (dbError) {
        console.error('[v0] DB delete error:', dbError)
        return
      }
    }
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (file) {
      void logAudit(supabase, {
        action_type: 'FILE_DELETE',
        target_type: 'document',
        target_id: id,
        target_label: file.name,
        description: `Eliminó el archivo "${file.name}" de la bóveda`,
        metadata: { storage_path: file.storagePath },
      })
      void reloadVault()
    }
  }, [files, supabase, reloadVault])

  const handleDeleteFolder = useCallback(async (id: string) => {
    const folderMeta = folders.find(f => f.id === id)
    // Also delete all files and subfolders recursively
    const folderIdsToDelete = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      folders.forEach((f) => {
        if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id)
          changed = true
        }
      })
    }

    // Get files in those folders to delete from storage
    const filesToDelete = files.filter(f => f.folderId && folderIdsToDelete.has(f.folderId))
    
    // Delete files from storage
    for (const file of filesToDelete) {
      if (file.storagePath) {
        await supabase.storage.from('boveda').remove([file.storagePath])
      }
    }

    // Delete from Supabase DB (cascade will handle documentos)
    for (const folderId of folderIdsToDelete) {
      await supabase.from('carpetas').delete().eq('id', folderId)
    }

    setFolders((prev) => prev.filter((f) => !folderIdsToDelete.has(f.id)))
    setFiles((prev) => prev.filter((f) => !f.folderId || !folderIdsToDelete.has(f.folderId)))

    void logAudit(supabase, {
      action_type: 'FOLDER_DELETE',
      target_type: 'folder',
      target_id: id,
      target_label: folderMeta?.name ?? id,
      description: `Eliminó la carpeta "${folderMeta?.name ?? 'Sin nombre'}" (${filesToDelete.length} archivos)`,
      metadata: { folders_deleted: folderIdsToDelete.size, files_deleted: filesToDelete.length },
    })
    void reloadVault()
  }, [folders, files, supabase, reloadVault])

  const handleCreateFolder = useCallback(async () => {
    if (!userId) {
      alert('Debes iniciar sesión para crear carpetas.')
      return
    }

    const name = prompt('Nombre de la nueva carpeta:')
    if (name?.trim()) {
      const { data: inserted, error } = await supabase
        .from('carpetas')
        .insert({
          name: name.trim(),
          parent_id: currentFolderId,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('[v0] Create folder error:', error)
        alert(`Error al crear carpeta: ${error.message}`)
        return
      }

      if (inserted) {
        const newFolder: VaultFolder = {
          id: inserted.id,
          name: inserted.name,
          parentId: inserted.parent_id,
        }
        setFolders((prev) => [...prev, newFolder])
        void logAudit(supabase, {
          action_type: 'FOLDER_CREATE',
          target_type: 'folder',
          target_id: inserted.id,
          target_label: inserted.name,
          description: `Creó la carpeta "${inserted.name}" en la bóveda`,
        })
      }
    }
  }, [currentFolderId, supabase, userId])

  const handleDownload = useCallback(async (file: VaultFile) => {
    if (!file.storagePath) {
      alert('Este archivo no tiene ruta de almacenamiento.')
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from('boveda')
        .download(file.storagePath)

      if (error) {
        console.error('[v0] Download error:', error)
        alert(`Error al descargar: ${error.message}`)
        return
      }

      if (data) {
        const url = URL.createObjectURL(data)
        const element = document.createElement('a')
        element.href = url
        element.download = file.name
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
        URL.revokeObjectURL(url)
        void logAudit(supabase, {
          action_type: 'FILE_DOWNLOAD',
          target_type: 'document',
          target_label: file.name,
          description: `Descargó el archivo "${file.name}"`,
          metadata: { storage_path: file.storagePath },
        })
      }
    } catch (err) {
      console.error('[v0] Download failed:', err)
      alert('Error inesperado al descargar archivo.')
    }
  }, [supabase])

  const handlePreview = useCallback((file: VaultFile) => {
    if (!isVaultPreviewable(file.type, file.name)) return
    if (!file.storagePath) {
      alert('Este archivo no tiene ruta de almacenamiento.')
      return
    }
    setPreviewFile(file)
    setIsPreviewOpen(true)
  }, [])

  const fetchPreviewBlob = useCallback(async () => {
    if (!previewFile?.storagePath) {
      throw new Error('Sin ruta de almacenamiento')
    }
    const { data, error } = await supabase.storage
      .from('boveda')
      .download(previewFile.storagePath)
    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo descargar el archivo')
    }
    return data
  }, [previewFile, supabase])

  const handleOpenShare = useCallback((file: VaultFile) => {
    setShareFile(file)
    setShareUrl(null)
    setShareExpiry('7d')
    setShareCopied(false)
    setIsShareDialogOpen(true)
  }, [])

  const handleGenerateShareUrl = useCallback(async () => {
    if (!shareFile?.storagePath || !userId) return
    setShareLoading(true)
    setShareUrl(null)

    const expiryMs: Record<string, number> = {
      '1d':  1000 * 60 * 60 * 24,
      '7d':  1000 * 60 * 60 * 24 * 7,
      '14d': 1000 * 60 * 60 * 24 * 14,
      '30d': 1000 * 60 * 60 * 24 * 30,
    }

    try {
      const expiresAt = new Date(Date.now() + expiryMs[shareExpiry]).toISOString()
      // Generate a short random code
      const code = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 10)

      const { error: insertError } = await supabase
        .from('shared_links')
        .insert({
          code,
          bucket: 'boveda',
          storage_path: shareFile.storagePath,
          file_name: shareFile.name,
          expires_at: expiresAt,
          user_id: userId,
        })

      if (insertError) {
        console.error('[v0] Shared link insert error:', insertError)
        alert(`Error al generar link: ${insertError.message}`)
        return
      }

      const shortUrl = `${window.location.origin}/compartir/${code}`
      setShareUrl(shortUrl)
      void logAudit(supabase, {
        action_type: 'FILE_SHARE',
        target_type: 'document',
        target_label: shareFile.name,
        description: `Generó link compartido para "${shareFile.name}" (expira en ${shareExpiry})`,
        metadata: { expiry: shareExpiry, code },
      })
    } catch (err) {
      console.error('[v0] Share failed:', err)
      alert('Error inesperado al generar el link.')
    } finally {
      setShareLoading(false)
    }
  }, [shareFile, shareExpiry, supabase, userId])

  const handleCopyShareUrl = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    })
  }, [shareUrl])

  const handleOpenMove = useCallback((file: VaultFile) => {
    setMoveFile(file)
    setMoveTargetFolderId(file.folderId)
    setIsMoveDialogOpen(true)
  }, [])

  const handleConfirmMove = useCallback(async () => {
    if (!moveFile) return
    if (moveTargetFolderId === moveFile.folderId) {
      setIsMoveDialogOpen(false)
      return
    }
    setIsMoving(true)
    try {
      const { error } = await supabase
        .from('documentos')
        .update({ folder_id: moveTargetFolderId })
        .eq('id', moveFile.id)

      if (error) {
        console.error('[v0] Move file error:', error)
        alert(`Error al mover archivo: ${error.message}`)
        return
      }

      setFiles(prev => prev.map(f =>
        f.id === moveFile.id ? { ...f, folderId: moveTargetFolderId } : f
      ))
      setIsMoveDialogOpen(false)
      void logAudit(supabase, {
        action_type: 'FILE_MOVE',
        target_type: 'document',
        target_id: moveFile.id,
        target_label: moveFile.name,
        description: `Movió "${moveFile.name}" a otra carpeta`,
        metadata: { folder_id: moveTargetFolderId },
      })
    } finally {
      setIsMoving(false)
    }
  }, [moveFile, moveTargetFolderId, supabase])

  const toggleSelectFile = useCallback((fileId: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedFileIds(prev =>
      prev.size === currentFiles.length
        ? new Set()
        : new Set(currentFiles.map(f => f.id))
    )
  }, [currentFiles])

  const clearSelection = useCallback(() => setSelectedFileIds(new Set()), [])

  const handleBulkMove = useCallback(async () => {
    if (selectedFileIds.size === 0) return
    setIsBulkMoving(true)
    try {
      const ids = Array.from(selectedFileIds)
      const { error } = await supabase
        .from('documentos')
        .update({ folder_id: bulkMoveTargetFolderId })
        .in('id', ids)

      if (error) {
        console.error('[v0] Bulk move error:', error)
        alert(`Error al mover archivos: ${error.message}`)
        return
      }

      setFiles(prev => prev.map(f =>
        selectedFileIds.has(f.id) ? { ...f, folderId: bulkMoveTargetFolderId } : f
      ))
      setSelectedFileIds(new Set())
      setIsBulkMoveDialogOpen(false)
      void logAudit(supabase, {
        action_type: 'BULK_FILE_MOVE',
        target_type: 'document',
        target_label: `${ids.length} archivos`,
        description: `Movió ${ids.length} archivos a otra carpeta`,
        metadata: { count: ids.length, folder_id: bulkMoveTargetFolderId, file_ids: ids },
      })
    } finally {
      setIsBulkMoving(false)
    }
  }, [selectedFileIds, bulkMoveTargetFolderId, supabase])

  const handlePreviewClose = useCallback((open: boolean) => {
    setIsPreviewOpen(open)
    if (!open) {
      window.setTimeout(() => setPreviewFile(null), 220)
    }
  }, [])

  const currentFolderName = currentFolderId
    ? folders.find((f) => f.id === currentFolderId)?.name ?? 'Carpeta'
    : 'Mis documentos'

  const storageFull = storageInfo
    ? storageInfo.usedBytes >= storageInfo.quotaBytes
    : false

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#2b2926] border border-slate-200 dark:border-neutral-700 rounded-xl p-12 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-slate-500 dark:text-slate-400">Cargando Mis documentos...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#2b2926] border border-slate-200 dark:border-neutral-700 rounded-xl overflow-hidden">
      {/* Header / Toolbar */}
      <div className="border-b border-slate-200 dark:border-neutral-700 p-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button
            onClick={() => navigateToFolder(null)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
              currentFolderId === null
                ? 'text-primary font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
          {breadcrumbs.map((folder) => (
            <div key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
              <button
                onClick={() => navigateToFolder(folder.id)}
                className={cn(
                  'px-2 py-1 rounded-md transition-colors',
                  folder.id === currentFolderId
                    ? 'text-primary font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search + Filters + Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Back button */}
          {currentFolderId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-700 gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          )}

          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <Input
              type="text"
              placeholder="Buscar archivos y carpetas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'pdf', 'excel', 'image', 'word'] as FileTypeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTypeFilter(filter)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                  typeFilter === filter
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-600',
                )}
              >
                {filter === 'all' && 'Todos'}
                {filter === 'pdf' && 'PDFs'}
                {filter === 'excel' && 'Planillas'}
                {filter === 'image' && 'Imágenes'}
                {filter === 'word' && 'Word'}
              </button>
            ))}
          </div>

          {/* New Folder Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateFolder}
            className="border-slate-200 dark:border-neutral-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nueva Carpeta
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {storageInfo && (
          <div className="mb-6">
            <VaultStorageBar
              usedBytes={storageInfo.usedBytes}
              quotaBytes={storageInfo.quotaBytes}
            />
          </div>
        )}

        {/* Upload Zone (compact) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.csv,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Seleccionar archivo"
        />

        <div
          onClick={() => !storageFull && fileInputRef.current?.click()}
          onDrop={storageFull ? undefined : handleDrop}
          onDragOver={storageFull ? undefined : handleDragOver}
          onDragLeave={storageFull ? undefined : handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-lg p-4 mb-6 flex items-center justify-center gap-3 transition-all',
            storageFull
              ? 'border-red-300 dark:border-red-800 bg-red-500/5 cursor-not-allowed opacity-80'
              : 'cursor-pointer',
            !storageFull && isDragging
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : !storageFull && 'border-slate-300 dark:border-neutral-600 hover:border-primary hover:bg-slate-50 dark:hover:bg-neutral-800',
          )}
        >
          {storageFull ? (
            <span className="text-sm text-red-600 dark:text-red-400 text-center">
              Almacenamiento lleno ({storageInfo?.quotaLabel ?? 'plan'}). Elimina archivos o contacta a soporte para ampliar tu plan.
            </span>
          ) : uploadProgress !== null ? (
            <div className="flex items-center gap-3">
              {uploadProgress < 100 ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                {uploadingFileName}
              </span>
              <div className="w-24 h-2 bg-slate-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <UploadCloud
                className={cn(
                  'w-5 h-5 transition-colors',
                  isDragging ? 'text-primary' : 'text-slate-400 dark:text-slate-500',
                )}
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Arrastra archivos aquí o haz clic para subir a <span className="font-medium text-slate-900 dark:text-slate-100">{currentFolderName}</span>
              </span>
            </>
          )}
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Fecha de Vencimiento (opcional)
            </label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 h-9 bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-600 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Se aplicará al próximo archivo que subas.
          </div>
        </div>

        {/* Folders Grid */}
        {currentFolders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Carpetas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="group relative bg-slate-50 dark:bg-[#3a3835] border border-slate-200 dark:border-neutral-600 rounded-lg p-4 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  onClick={() => navigateToFolder(folder.id)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Folder className="w-10 h-10 text-amber-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center truncate w-full">
                      {folder.name}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-neutral-600 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFolder(folder.id)
                        }}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {currentFiles.length > 0 && (
                <Checkbox
                  id="select-all"
                  checked={selectedFileIds.size === currentFiles.length && currentFiles.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="border-slate-300 dark:border-neutral-500"
                />
              )}
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Archivos {currentFiles.length > 0 && `(${currentFiles.length})`}
              </h3>
            </div>

            {/* Selection action bar */}
            {selectedFileIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedFileIds.size} seleccionado{selectedFileIds.size > 1 ? 's' : ''}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearSelection}
                  className="h-7 px-2 text-xs text-slate-500 border-slate-200 dark:border-neutral-600"
                >
                  <X className="w-3 h-3 mr-1" />
                  Quitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkMoveTargetFolderId(currentFolderId)
                    setIsBulkMoveDialogOpen(true)
                  }}
                  className="h-7 px-3 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  Mover seleccionados
                </Button>
              </div>
            )}
          </div>

          {currentFiles.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {searchQuery || typeFilter !== 'all' ? (
                <p>No se encontraron archivos con los filtros actuales.</p>
              ) : (
                <p>Esta carpeta está vacía. Sube archivos o crea subcarpetas.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {currentFiles.map((file) => {
                const { Icon, bgColor, iconColor } = getFileIcon(file.type)
                const expiringSoon = isExpiringSoon(file.expiresAt)
                const isPreviewable = isVaultPreviewable(file.type, file.name)
                const isSelected = selectedFileIds.has(file.id)
                return (
                  <div
                    key={file.id}
                    onClick={isPreviewable && selectedFileIds.size === 0 ? () => handlePreview(file) : undefined}
                    onKeyDown={
                      isPreviewable && selectedFileIds.size === 0
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handlePreview(file)
                            }
                          }
                        : undefined
                    }
                    role={isPreviewable && selectedFileIds.size === 0 ? 'button' : undefined}
                    tabIndex={isPreviewable && selectedFileIds.size === 0 ? 0 : undefined}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                      isSelected
                        ? 'bg-primary/5 border-primary/40 dark:bg-primary/10'
                        : 'bg-slate-50 dark:bg-[#3a3835] border-slate-200 dark:border-neutral-600',
                      isPreviewable && selectedFileIds.size === 0
                        ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-700'
                        : 'hover:bg-slate-100 dark:hover:bg-neutral-700',
                    )}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectFile(file.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 border-slate-300 dark:border-neutral-500"
                    />
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bgColor)}>
                      <Icon className={cn('w-5 h-5', iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {file.name}
                        </p>
                        {expiringSoon && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/20 px-2 py-0.5 rounded-full">
                            Por vencer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                        {file.expiresAt && ` • Vence ${formatExpiryDate(file.expiresAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPreviewable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handlePreview(file) }}
                          className="h-8 w-8 p-0 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                          title="Vista previa"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleOpenShare(file) }}
                        className="h-8 w-8 p-0 text-slate-500 dark:text-slate-300 hover:text-primary"
                        title="Compartir link"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDownload(file) }}
                        className="h-8 w-8 p-0 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleOpenMove(file) }}
                        className="h-8 w-8 p-0 text-slate-500 dark:text-slate-300 hover:text-amber-600"
                        title="Mover a carpeta"
                      >
                        <FolderInput className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id) }}
                        className="h-8 w-8 p-0 text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400"
                        title="Eliminar"
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
      </div>

      {(isPreviewOpen || previewFile) && (
        <VaultFilePreviewDialog
          open={isPreviewOpen}
          onOpenChange={handlePreviewClose}
          fileName={previewFile?.name ?? ''}
          fileType={previewFile?.type ?? 'pdf'}
          fileSize={previewFile?.size}
          fetchBlob={fetchPreviewBlob}
          onDownload={previewFile ? () => handleDownload(previewFile) : undefined}
          headerActions={
            previewFile ? (
              <Button variant="outline" size="sm" onClick={() => handleOpenShare(previewFile)} className="gap-1.5 text-xs h-8">
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </Button>
            ) : undefined
          }
        />
      )}

      {/* ── Share Dialog ── */}
      <Dialog open={isShareDialogOpen} onOpenChange={(open) => { if (!open) { setIsShareDialogOpen(false); setShareUrl(null) } }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg bg-background border-border p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold">Compartir archivo</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 truncate">
                  {shareFile?.name}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Expiry selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">El link expira en</p>
              </div>
              <div className="flex gap-2">
                {([
                  { value: '1d',  label: '1 día'  },
                  { value: '7d',  label: '7 días' },
                  { value: '14d', label: '14 días'},
                  { value: '30d', label: '1 mes'  },
                ] as const).map(opt => {
                  const active = shareExpiry === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setShareExpiry(opt.value); setShareUrl(null) }}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center border',
                        active
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Generated URL */}
            {shareUrl && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link generado</p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary min-w-0">
                  <p className="flex-1 min-w-0 text-xs truncate font-mono text-secondary-foreground">{shareUrl}</p>
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className={cn(
                      'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex-shrink-0 w-[90px]',
                      shareCopied
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                        : 'border-border bg-background hover:border-primary/50 hover:bg-white/80 dark:hover:bg-white/10'
                    )}
                  >
                    {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {shareCopied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Este link es válido por {shareExpiry === '1d' ? '1 día' : shareExpiry === '7d' ? '7 días' : shareExpiry === '14d' ? '14 días' : '1 mes'}.
                  Cualquier persona con el link podrá ver el archivo.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(false)}>Cerrar</Button>
            <Button size="sm" onClick={handleGenerateShareUrl} disabled={shareLoading} className="gap-1.5 min-w-[140px]">
              {shareLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generando…</>
              ) : (
                <><Link2 className="w-3.5 h-3.5" />{shareUrl ? 'Regenerar link' : 'Generar link'}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Move to Folder Dialog ── */}
      <Dialog open={isMoveDialogOpen} onOpenChange={(open) => { if (!open) setIsMoveDialogOpen(false) }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm bg-background border-border p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <FolderInput className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold">Mover archivo</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 truncate">
                  {moveFile?.name}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Folder list */}
          <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-1">
            {/* Root option */}
            <button
              type="button"
              onClick={() => setMoveTargetFolderId(null)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border',
                moveTargetFolderId === null
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-transparent hover:bg-secondary/60 text-foreground'
              )}
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              <span>Inicio (raíz)</span>
              {moveTargetFolderId === null && (
                <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
              )}
            </button>

            {/* All folders */}
            {folders.map(folder => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setMoveTargetFolderId(folder.id)}
                disabled={folder.id === moveFile?.folderId}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border',
                  moveTargetFolderId === folder.id && folder.id !== moveFile?.folderId
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : folder.id === moveFile?.folderId
                    ? 'border-transparent text-muted-foreground opacity-50 cursor-not-allowed'
                    : 'border-transparent hover:bg-secondary/60 text-foreground'
                )}
              >
                <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span className="flex-1 truncate">{folder.name}</span>
                {folder.id === moveFile?.folderId && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">actual</span>
                )}
                {moveTargetFolderId === folder.id && folder.id !== moveFile?.folderId && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                )}
              </button>
            ))}

            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 italic">
                No hay carpetas creadas todavía.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground truncate">
              {moveTargetFolderId === null
                ? 'Mover a: Inicio'
                : `Mover a: ${folders.find(f => f.id === moveTargetFolderId)?.name ?? '…'}`}
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmMove}
                disabled={isMoving || moveTargetFolderId === moveFile?.folderId}
                className="gap-1.5 min-w-[90px]"
              >
                {isMoving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Moviendo…</>
                ) : (
                  <><FolderInput className="w-3.5 h-3.5" />Mover</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Move Dialog ── */}
      <Dialog open={isBulkMoveDialogOpen} onOpenChange={(open) => { if (!open) setIsBulkMoveDialogOpen(false) }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm bg-background border-border p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <FolderInput className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold">Mover archivos</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {selectedFileIds.size} archivo{selectedFileIds.size > 1 ? 's' : ''} seleccionado{selectedFileIds.size > 1 ? 's' : ''}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Folder list */}
          <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-1">
            {/* Root option */}
            <button
              type="button"
              onClick={() => setBulkMoveTargetFolderId(null)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border',
                bulkMoveTargetFolderId === null
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-transparent hover:bg-secondary/60 text-foreground'
              )}
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              <span>Inicio (raíz)</span>
              {bulkMoveTargetFolderId === null && (
                <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
              )}
            </button>

            {folders.map(folder => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setBulkMoveTargetFolderId(folder.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border',
                  bulkMoveTargetFolderId === folder.id
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-transparent hover:bg-secondary/60 text-foreground'
                )}
              >
                <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span className="flex-1 truncate">{folder.name}</span>
                {bulkMoveTargetFolderId === folder.id && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                )}
              </button>
            ))}

            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 italic">
                No hay carpetas creadas todavía.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground truncate">
              {bulkMoveTargetFolderId === null
                ? 'Destino: Inicio'
                : `Destino: ${folders.find(f => f.id === bulkMoveTargetFolderId)?.name ?? '…'}`}
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsBulkMoveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleBulkMove}
                disabled={isBulkMoving}
                className="gap-1.5 min-w-[100px]"
              >
                {isBulkMoving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Moviendo…</>
                ) : (
                  <><FolderInput className="w-3.5 h-3.5" />Mover {selectedFileIds.size}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
