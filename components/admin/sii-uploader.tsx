'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { procesarExcelSII, type ProcesarResult } from '@/app/actions/costos-gastos'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'selected' | 'processing' | 'done' | 'error'

interface SiiUploaderProps {
  /** UUID del cliente cuyos datos se están importando */
  clienteId: string
  /** Callback opcional al completar una importación exitosa */
  onSuccess?: (result: ProcesarResult) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function isValidFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME.includes(file.type)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SiiUploader({ clienteId, onSuccess }: SiiUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<ProcesarResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  // ── File selection ─────────────────────────────────────────────────────────

  const pickFile = useCallback((file: File) => {
    if (!isValidFile(file)) {
      toast.error('Formato no válido. Sube un archivo .xlsx, .xls o .csv.')
      return
    }
    setSelectedFile(file)
    setResult(null)
    setShowErrors(false)
    setState('selected')
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) pickFile(file)
      // Reset input so the same file can be re-selected after clearing
      e.target.value = ''
    },
    [pickFile],
  )

  const handleClickZone = useCallback(() => {
    if (state === 'processing') return
    inputRef.current?.click()
  }, [state])

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear when leaving the zone entirely, not child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) pickFile(file)
    },
    [pickFile],
  )

  // ── Clear selection ────────────────────────────────────────────────────────

  const clearFile = useCallback(() => {
    setSelectedFile(null)
    setResult(null)
    setShowErrors(false)
    setState('idle')
  }, [])

  // ── Process ────────────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!selectedFile || !clienteId) return

    setState('processing')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('archivo', selectedFile)
      formData.append('cliente_id', clienteId)

      const res = await procesarExcelSII(formData)
      setResult(res)

      if (res.ok && res.insertados > 0) {
        toast.success(res.message, {
          description:
            res.errores.length > 0
              ? `${res.errores.length} advertencia${res.errores.length !== 1 ? 's' : ''} — revisa el detalle.`
              : undefined,
          duration: 5000,
        })
        setState('done')
        onSuccess?.(res)
      } else {
        toast.error(res.message, {
          description:
            res.errores.length > 0 ? res.errores[0] : 'Revisa el formato del archivo.',
          duration: 7000,
        })
        setState('error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al procesar.'
      toast.error(msg)
      setResult({ ok: false, insertados: 0, omitidos: 0, errores: [msg], message: msg })
      setState('error')
    }
  }, [selectedFile, clienteId, onSuccess])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivo Excel SII"
        onClick={handleClickZone}
        onKeyDown={(e) => e.key === 'Enter' && handleClickZone()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 cursor-pointer select-none',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : state === 'selected' || state === 'done'
              ? 'border-primary/40 bg-primary/5'
              : state === 'error'
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
          state === 'processing' ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={handleInputChange}
          aria-hidden="true"
        />

        {/* Idle state */}
        {(state === 'idle' || isDragging) && (
          <>
            <div
              className={[
                'flex h-14 w-14 items-center justify-center rounded-full border transition-colors',
                isDragging
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border bg-secondary',
              ].join(' ')}
            >
              <CloudUpload
                className={['w-7 h-7 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground'].join(' ')}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o haz clic para seleccionar'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Formatos aceptados: .xlsx, .xls, .csv
              </p>
            </div>
          </>
        )}

        {/* File selected */}
        {(state === 'selected' || state === 'processing') && selectedFile && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              {state === 'processing' ? (
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              ) : (
                <FileSpreadsheet className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground break-all max-w-xs">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(selectedFile.size)}
                {state === 'processing' && (
                  <span className="ml-2 text-primary animate-pulse">Procesando…</span>
                )}
              </p>
            </div>

            {state === 'processing' && (
              <Progress value={undefined} className="w-48 h-1" />
            )}

            {/* Clear button only when not processing */}
            {state === 'selected' && (
              <button
                type="button"
                aria-label="Quitar archivo"
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Done state */}
        {state === 'done' && result && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {result.insertados} registro{result.insertados !== 1 ? 's' : ''} importado{result.insertados !== 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.omitidos > 0 && `${result.omitidos} omitidos · `}
                {result.errores.length === 0 ? 'Sin advertencias' : `${result.errores.length} advertencia${result.errores.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </>
        )}

        {/* Error state */}
        {state === 'error' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                No se pudo importar el archivo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result?.message ?? 'Revisa el formato e intenta de nuevo.'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {state === 'selected' && (
          <Button onClick={handleProcess} className="gap-2">
            <CloudUpload className="w-4 h-4" />
            Procesar archivo
          </Button>
        )}

        {(state === 'done' || state === 'error') && (
          <Button variant="outline" onClick={clearFile} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Subir otro archivo
          </Button>
        )}

        {state === 'idle' && (
          <Button variant="outline" onClick={handleClickZone} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Seleccionar archivo
          </Button>
        )}

        {/* Badges de estado */}
        {state === 'done' && result && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              {result.insertados} insertados
            </Badge>
            {result.omitidos > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                {result.omitidos} omitidos
              </Badge>
            )}
            {result.errores.length > 0 && (
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                {result.errores.length} advertencia{result.errores.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Error detail accordion */}
      {result && result.errores.length > 0 && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowErrors((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-orange-700 hover:bg-orange-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>
                {result.errores.length} advertencia{result.errores.length !== 1 ? 's' : ''} durante la importación
              </span>
            </div>
            {showErrors ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </button>

          {showErrors && (
            <ul className="divide-y divide-orange-500/10 px-4 pb-3">
              {result.errores.map((err, i) => (
                <li
                  key={i}
                  className="py-2 text-xs text-orange-700 font-mono leading-relaxed"
                >
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
