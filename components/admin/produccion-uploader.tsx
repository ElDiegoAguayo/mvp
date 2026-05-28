'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importarExcelProduccion } from '@/app/actions/produccion'
import type { ImportResult } from '@/types/produccion'
import { cn } from '@/lib/utils'

interface Props {
  clienteId: string
}

export function ProduccionUploader({ clienteId }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setResult({ ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: 'Solo se aceptan archivos .xlsx o .xls' })
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await importarExcelProduccion(fd, clienteId)
      setResult(res)
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
            ? 'border-primary bg-primary/10'
            : 'border-border/50 hover:border-primary/50 hover:bg-white/5',
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
          }}
        />

        {isPending ? (
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
        ) : (
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50 mb-3" />
        )}

        <p className="font-medium text-sm text-foreground">
          {isPending ? 'Procesando archivo…' : 'Importar Excel de Embalaje'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Arrastra aquí o haz clic · Hojas: "CODIGOS EMBALAJE" + "INVENTARIO"
        </p>

        {!isPending && (
          <Button size="sm" variant="outline" className="mt-4 pointer-events-none">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Seleccionar archivo
          </Button>
        )}
      </div>

      {result && (
        <div className={cn(
          'rounded-lg border p-4 text-sm flex items-start gap-3',
          result.ok
            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
            : 'border-red-500/40 bg-red-950/20 text-red-200',
        )}>
          {result.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            : <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          }
          <div>
            <p className="font-medium">{result.message}</p>
            {result.ok && (
              <ul className="text-xs mt-1 opacity-80 space-y-0.5 list-disc list-inside">
                <li>{result.materiales_creados} materiales</li>
                <li>{result.recetas_creadas} códigos de embalaje (recetas)</li>
                <li>{result.detalles_creados} líneas BOM</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
