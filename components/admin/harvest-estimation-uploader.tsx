'use client'

import { useRef, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { parseHarvestWorkbook, type ParsedHarvestImport } from '@/lib/agronomy/parse-harvest-xlsx'
import { parseCountWorkbook, isBellavistaDashboardWorkbook } from '@/lib/agronomy/parse-count-xlsx'
import {
  importCountFromExcelAction,
  importEstimationFromExcelAction,
  syncEstimationsFromCountAction,
  type HarvestImportResult,
} from '@/app/actions/harvest-import-actions'

interface HarvestEstimationUploaderProps {
  clienteId: string
}

export function HarvestEstimationUploader({ clienteId }: HarvestEstimationUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importMode, setImportMode] = useState<'conteo' | 'estimacion'>('conteo')
  const [importPreview, setImportPreview] = useState<ParsedHarvestImport | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [lastResult, setLastResult] = useState<HarvestImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  async function parseFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Solo se aceptan archivos .xlsx o .xls')
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      let mode: 'conteo' | 'estimacion' = importMode

      if (isBellavistaDashboardWorkbook(wb)) {
        mode = 'conteo'
        setImportMode('conteo')
        toast.info('Libro de conteo detectado', {
          description: 'Se importará como muestras y promedios por cuartel.',
        })
      }

      const parsed = mode === 'conteo' ? parseCountWorkbook(buffer) : parseHarvestWorkbook(buffer)
      setImportPreview(parsed)
      setImportMode(mode)
      setLastResult(null)
      toast.success(mode === 'conteo' ? 'Excel de conteo leído' : 'Excel de estimación leído', {
        description: `${parsed.fields.length} campos · ${parsed.blocks.length} cuarteles · ${parsed.estimates.length} registros · ${parsed.season_label}`,
      })
    } catch (err) {
      setImportPreview(null)
      toast.error('No se pudo leer el Excel', {
        description: err instanceof Error ? err.message : 'Formato no válido',
      })
    }
  }

  function handleFile(file: File) {
    void parseFile(file)
  }

  function handleImport() {
    if (!importPreview) return
    startTransition(async () => {
      const result = importMode === 'conteo'
        ? await importCountFromExcelAction(importPreview, replaceExisting, undefined, clienteId)
        : await importEstimationFromExcelAction(importPreview, replaceExisting, undefined, clienteId)

      if (!result.ok) {
        setLastResult(result)
        toast.error('Error al importar', { description: result.error })
        return
      }

      if (importMode === 'conteo') {
        const sync = await syncEstimationsFromCountAction(importPreview.season_label, clienteId)
        if (sync.ok && sync.updated > 0) {
          toast.success('Estimaciones calculadas', {
            description: `${sync.updated} cuarteles actualizados desde el conteo.`,
          })
        }
      }

      setLastResult(result)
      setImportPreview(null)
      toast.success(importMode === 'conteo' ? 'Conteo importado' : 'Estimación importada', {
        description: `${result.fields} campos · ${result.blocks} cuarteles · ${result.estimates} registros · temporada ${result.season}`,
      })
    })
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all select-none',
          dragging
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-border/50 hover:border-emerald-500/40 hover:bg-emerald-500/5',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />

        {isPending ? (
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
        ) : (
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50 mb-3" />
        )}

        <p className="font-medium text-sm text-foreground">
          {isPending ? 'Importando…' : 'Importar Excel de estimación de cosecha'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 text-center max-w-md">
          Arrastra aquí o haz clic. Acepta libros de conteo (muestras por árbol) o de estimación por cuartel.
          Los datos quedan en la cuenta del cliente.
        </p>

        {!isPending && (
          <Button size="sm" variant="outline" className="mt-4 pointer-events-none">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Seleccionar archivo
          </Button>
        )}
      </div>

      {importPreview && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3 text-sm">
          <p className="font-medium">Vista previa</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>Hoja: {importPreview.sheetName}</li>
            <li>Temporada: {importPreview.season_label}</li>
            <li>{importPreview.fields.length} campos · {importPreview.blocks.length} cuarteles · {importPreview.estimates.length} registros</li>
            <li>Tipo detectado: {importMode === 'conteo' ? 'Conteo' : 'Estimación'}</li>
          </ul>
          <div className="flex items-center gap-2">
            <Checkbox
              id="harvest-admin-replace"
              checked={replaceExisting}
              onCheckedChange={(v) => setReplaceExisting(v === true)}
            />
            <Label htmlFor="harvest-admin-replace" className="text-sm font-normal cursor-pointer">
              Reemplazar datos existentes del cliente antes de importar
            </Label>
          </div>
          <Button onClick={handleImport} disabled={isPending} className="w-full sm:w-auto">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Importar a cuenta del cliente
          </Button>
        </div>
      )}

      {lastResult && (
        <div className={cn(
          'rounded-lg border p-4 text-sm flex items-start gap-3',
          lastResult.ok
            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
            : 'border-red-500/40 bg-red-950/20 text-red-200',
        )}>
          {lastResult.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          }
          <div>
            {lastResult.ok ? (
              <>
                <p className="font-medium">Importación completada</p>
                <p className="text-xs mt-1 opacity-90">
                  {lastResult.fields} campos · {lastResult.blocks} cuarteles · {lastResult.estimates} registros · {lastResult.season}
                </p>
              </>
            ) : (
              <p className="font-medium">{lastResult.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
