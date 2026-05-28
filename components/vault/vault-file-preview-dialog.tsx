'use client'

import { useEffect, useState, useRef } from 'react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { Loader2, Download, FileText, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  resolveVaultPreviewKind,
  vaultPreviewKindLabel,
} from '@/lib/vault-preview'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PREVIEW_DIALOG_CLOSE_MS = 220

function previewIcon(kind: ReturnType<typeof resolveVaultPreviewKind>) {
  switch (kind) {
    case 'excel':
      return { Icon: FileSpreadsheet, bg: 'bg-green-500/10', color: 'text-green-500' }
    case 'image':
      return { Icon: ImageIcon, bg: 'bg-blue-500/10', color: 'text-blue-500' }
    case 'word':
      return { Icon: FileText, bg: 'bg-sky-500/10', color: 'text-sky-600' }
    default:
      return { Icon: FileText, bg: 'bg-red-500/10', color: 'text-red-500' }
  }
}

export interface VaultFilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  fileType: string
  fileSize?: number
  fetchBlob: () => Promise<Blob>
  onDownload?: () => void
  headerActions?: React.ReactNode
}

export function VaultFilePreviewDialog({
  open,
  onOpenChange,
  fileName,
  fileType,
  fileSize,
  fetchBlob,
  onDownload,
  headerActions,
}: VaultFilePreviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [excelSheets, setExcelSheets] = useState<{ name: string; html: string }[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const objectUrlRef = useRef<string | null>(null)

  const kind = resolveVaultPreviewKind(fileType, fileName)
  const { Icon, bg, color } = previewIcon(kind)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadPreview() {
      setLoading(true)
      setError(null)
      setObjectUrl(null)
      setHtmlContent(null)
      setExcelSheets([])
      setActiveSheet(0)

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }

      try {
        const blob = await fetchBlob()
        if (cancelled) return

        const previewKind = resolveVaultPreviewKind(fileType, fileName)
        const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

        if (previewKind === 'pdf' || previewKind === 'image') {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setObjectUrl(url)
        } else if (previewKind === 'excel') {
          const buffer = await blob.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          const sheets = workbook.SheetNames.map((name) => ({
            name,
            html: XLSX.utils.sheet_to_html(workbook.Sheets[name]),
          }))
          if (sheets.length === 0) {
            setError('La hoja de cálculo está vacía o no se pudo leer.')
          } else {
            setExcelSheets(sheets)
          }
        } else if (previewKind === 'word') {
          if (ext === 'doc') {
            setError('Los archivos .doc (Word antiguo) no se pueden previsualizar aquí. Descarga el archivo para abrirlo.')
            return
          }
          const buffer = await blob.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          setHtmlContent(result.value || '<p>Documento vacío.</p>')
        } else {
          setError('Tipo de archivo no soportado para vista previa.')
        }
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar la vista previa.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
    }
  }, [open, fileName, fileType, fetchBlob])

  useEffect(() => {
    if (open) return

    const timer = window.setTimeout(() => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      setObjectUrl(null)
      setHtmlContent(null)
      setExcelSheets([])
      setError(null)
      setLoading(false)
    }, PREVIEW_DIALOG_CLOSE_MS)

    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 bg-background border-border">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold truncate">{fileName}</DialogTitle>
              <DialogDescription className="text-xs mt-0">
                {vaultPreviewKindLabel(kind)}
                {fileSize != null ? ` · ${formatFileSize(fileSize)}` : ''}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} className="gap-1.5 text-xs h-8">
                <Download className="w-3.5 h-3.5" />
                Descargar
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-muted/30 overflow-hidden rounded-b-lg">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground h-full min-h-[min(70vh,800px)]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Cargando vista previa…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center justify-center h-full min-h-[min(70vh,800px)] p-6">
              <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20 max-w-md text-center">
                {error}
              </div>
            </div>
          )}

          {!loading && !error && objectUrl && kind === 'pdf' && (
            <iframe
              title={fileName}
              src={objectUrl}
              className="h-full w-full"
              style={{ minHeight: 'min(70vh, 800px)' }}
            />
          )}

          {!loading && !error && objectUrl && kind === 'image' && (
            <div
              className="flex items-center justify-center w-full h-full p-6"
              style={{ minHeight: 'min(70vh, 800px)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {!loading && !error && htmlContent && kind === 'word' && (
            <div
              className="h-full overflow-auto p-6 bg-background"
              style={{ minHeight: 'min(70vh, 800px)' }}
            >
              <article
                className="prose prose-sm dark:prose-invert max-w-none mx-auto bg-card border border-border rounded-lg p-6 shadow-sm"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          )}

          {!loading && !error && excelSheets.length > 0 && kind === 'excel' && (
            <div className="flex flex-col h-full" style={{ minHeight: 'min(70vh, 800px)' }}>
              {excelSheets.length > 1 && (
                <div className="flex gap-1 px-4 py-2 border-b border-border bg-secondary/40 overflow-x-auto flex-shrink-0">
                  {excelSheets.map((sheet, idx) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => setActiveSheet(idx)}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors',
                        activeSheet === idx
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:text-foreground border border-border',
                      )}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-auto p-4">
                <div
                  className="vault-excel-preview bg-card border border-border rounded-lg p-2 overflow-x-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: excelSheets[activeSheet]?.html ?? '' }}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
