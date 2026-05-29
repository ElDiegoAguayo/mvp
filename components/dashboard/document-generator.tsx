'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, FileText, FileSpreadsheet, FileType, ChevronUp, ChevronDown } from 'lucide-react'
import type { DocumentFormat, DocumentKind } from '@/lib/documents/document-utils'

interface TableOption {
  id: string
  name: string
  moduleName?: string | null
}

interface TableRow {
  id: string
  data: Record<string, unknown>
  created_at?: string
}

interface TableColumn {
  id: string
  name: string
}

const DOC_TYPES: Array<{ label: string; value: DocumentKind }> = [
  { label: 'Contrato', value: 'contract' },
  { label: 'Reporte', value: 'report' },
  { label: 'Factura', value: 'invoice' },
]

const FORMATS: Array<{ label: string; value: DocumentFormat }> = [
  { label: 'PDF', value: 'pdf' },
  { label: 'DOCX', value: 'docx' },
]

const ROW_LABEL_KEYS = [
  'nombre',
  'cliente',
  'empresa',
  'embarque',
  'factura',
  'contrato',
  'referencia',
]

function formatTableLabel(table: TableOption) {
  return `${table.name}${table.moduleName ? ` (${table.moduleName})` : ''}`
}

const selectTriggerClass =
  'w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate'

export function DocumentGenerator() {
  const supabase = useMemo(() => createClient(), [])
  const [tables, setTables] = useState<TableOption[]>([])
  const [rows, setRows] = useState<TableRow[]>([])
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([])
  const [tableId, setTableId] = useState<string>('')
  const [rowId, setRowId] = useState<string>('')
  const [docType, setDocType] = useState<DocumentKind>('contract')
  const [format, setFormat] = useState<DocumentFormat>('pdf')
  const [isLoadingTables, setIsLoadingTables] = useState(true)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [rowSearch, setRowSearch] = useState('')
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(new Set())

  const loadTables = useCallback(async () => {
    setIsLoadingTables(true)
    try {
      const { effectiveUserId } = await getEffectiveUserId(supabase)
      if (!effectiveUserId) return

      const { data, error } = await supabase
        .from('dynamic_tables')
        .select('id, name, modules:module_id(name)')
        .eq('user_id', effectiveUserId)
        .order('name')

      if (error) throw error

      const options = (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        moduleName: (row.modules as { name: string } | null)?.name ?? null,
      }))

      setTables(options)
    } catch (error) {
      console.error('Error loading tables:', error)
      toast.error('No se pudieron cargar las tablas disponibles.')
    } finally {
      setIsLoadingTables(false)
    }
  }, [supabase])

  const loadRows = useCallback(async () => {
    if (!tableId) return
    setIsLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('dynamic_table_rows')
        .select('id, data, created_at')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      setRows((data ?? []) as TableRow[])
      if (data && data.length > 0) {
        setRowId(data[0].id)
      } else {
        setRowId('')
      }
    } catch (error) {
      console.error('Error loading rows:', error)
      toast.error('No se pudieron cargar los registros de la tabla.')
    } finally {
      setIsLoadingRows(false)
    }
  }, [supabase, tableId])

  const loadTableColumns = useCallback(async () => {
    if (!tableId) {
      setTableColumns([])
      setColumnOrder([])
      setVisibleColumnIds(new Set())
      return
    }

    try {
      const { data, error } = await supabase
        .from('dynamic_tables')
        .select('columns')
        .eq('id', tableId)
        .single()

      if (error) throw error

      const columns = ((data?.columns as TableColumn[]) || []).map((col) => ({
        id: col.id,
        name: col.name,
      }))

      setTableColumns(columns)

      const storageKey = `docColumnPrefs:${tableId}`
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            order?: string[]
            visible?: string[]
          }
          const knownIds = new Set(columns.map((col) => col.id))
          const storedOrder = (parsed.order ?? []).filter((id) => knownIds.has(id))
          const missing = columns.map((col) => col.id).filter((id) => !storedOrder.includes(id))
          const nextOrder = [...storedOrder, ...missing]
          const nextVisible = new Set(
            (parsed.visible ?? columns.map((col) => col.id)).filter((id) => knownIds.has(id)),
          )

          setColumnOrder(nextOrder)
          setVisibleColumnIds(nextVisible)
          return
        } catch {
          // ignore corrupted preference
        }
      }

      const defaultOrder = columns.map((col) => col.id)
      setColumnOrder(defaultOrder)
      setVisibleColumnIds(new Set(defaultOrder))
    } catch (error) {
      console.error('Error loading table columns:', error)
      toast.error('No se pudieron cargar las columnas de la tabla.')
    }
  }, [supabase, tableId])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  useEffect(() => {
    loadTableColumns()
  }, [loadTableColumns])


  const filteredRows = useMemo(() => {
    const normalized = rowSearch.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => {
      const data = row.data ?? {}
      return Object.values(data).some((value) =>
        String(value).toLowerCase().includes(normalized),
      )
    })
  }, [rowSearch, rows])

  const selectedRow = rows.find((row) => row.id === rowId)
  const selectedTable = tables.find((table) => table.id === tableId)
  const selectedTableLabel = selectedTable ? formatTableLabel(selectedTable) : undefined
  const columnLabelMap = useMemo(() => {
    return new Map(tableColumns.map((col) => [col.id, col.name]))
  }, [tableColumns])

  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return tableColumns
    const colById = new Map(tableColumns.map((col) => [col.id, col]))
    return columnOrder
      .map((id) => colById.get(id))
      .filter((col): col is TableColumn => Boolean(col))
  }, [columnOrder, tableColumns])

  const visibleColumns = useMemo(() => {
    const visible = new Set(visibleColumnIds)
    return orderedColumns.filter((col) => visible.has(col.id))
  }, [orderedColumns, visibleColumnIds])

  const persistColumnPrefs = useCallback((nextOrder: string[], nextVisible: Set<string>) => {
    if (!tableId || typeof window === 'undefined') return
    const storageKey = `docColumnPrefs:${tableId}`
    const payload = {
      order: nextOrder,
      visible: Array.from(nextVisible),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [tableId])

  useEffect(() => {
    if (!tableId) return
    if (tableColumns.length > 0) return
    if (!selectedRow) return

    const keys = Object.keys(selectedRow.data || {})
    if (keys.length === 0) return

    const columns = keys.map((key) => ({ id: key, name: key }))
    setTableColumns(columns)
    setColumnOrder(keys)
    const nextVisible = new Set(keys)
    setVisibleColumnIds(nextVisible)
    persistColumnPrefs(keys, nextVisible)
  }, [persistColumnPrefs, selectedRow, tableColumns.length, tableId])

  const toggleColumn = (columnId: string, enabled: boolean) => {
    setVisibleColumnIds((prev) => {
      const next = new Set(prev)
      if (enabled) {
        next.add(columnId)
      } else {
        next.delete(columnId)
      }
      persistColumnPrefs(columnOrder, next)
      return next
    })
  }

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(columnId)
      if (index === -1) return prev
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      persistColumnPrefs(next, visibleColumnIds)
      return next
    })
  }

  const showAllColumns = () => {
    const next = new Set(tableColumns.map((col) => col.id))
    setVisibleColumnIds(next)
    persistColumnPrefs(columnOrder, next)
  }

  const hideAllColumns = () => {
    const next = new Set<string>()
    setVisibleColumnIds(next)
    persistColumnPrefs(columnOrder, next)
  }

  const getRowLabel = (row: TableRow, index: number) => {
    for (const key of ROW_LABEL_KEYS) {
      const value = row.data?.[key]
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value)
      }
    }
    if (row.data?.id) return String(row.data.id)
    return `Registro ${index + 1}`
  }

  const getRowPreview = (row: TableRow) => {
    const candidates = visibleColumns.length > 0
      ? visibleColumns
      : orderedColumns

    const parts: string[] = []
    for (const col of candidates) {
      const rawValue = row.data?.[col.id]
      if (rawValue === undefined || rawValue === null) continue
      const value = String(rawValue).trim()
      if (!value) continue
      parts.push(`${columnLabelMap.get(col.id) ?? col.id}: ${value}`)
      if (parts.length >= 3) break
    }

    return parts.join(' · ')
  }

  const handleGenerate = async () => {
    if (!tableId || !rowId) {
      toast.error('Selecciona una tabla y un registro para continuar.')
      return
    }

    if (visibleColumnIds.size === 0) {
      toast.error('Selecciona al menos una columna para el documento.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: docType,
          format,
          tableId,
          rowId,
          columnOrder,
          visibleColumns: Array.from(visibleColumnIds),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'No se pudo generar el documento.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().slice(0, 10)
      link.download = `${docType}-${timestamp}.${format}`
      link.click()
      window.URL.revokeObjectURL(url)

      toast.success('Documento generado correctamente.')
    } catch (error) {
      console.error('Document generation error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Error al generar el documento.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Generacion de Documentos
          </CardTitle>
          <Badge variant="secondary">Contrato / Reporte / Factura</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Elige un registro de tus tablas y genera un PDF o DOCX listo para descargar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div className="min-w-0">
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <Select value={docType} onValueChange={(value) => setDocType(value as DocumentKind)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="text-xs text-muted-foreground mb-1 block">Formato</label>
            <Select value={format} onValueChange={(value) => setFormat(value as DocumentFormat)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-w-0">
          <label className="text-xs text-muted-foreground mb-1 block">Tabla</label>
          <Select value={tableId} onValueChange={setTableId} disabled={isLoadingTables}>
            <SelectTrigger
              className={selectTriggerClass}
              title={selectedTableLabel}
            >
              <SelectValue placeholder={isLoadingTables ? 'Cargando...' : 'Selecciona tabla'} />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id} title={formatTableLabel(table)}>
                  <span className="block truncate max-w-[min(100vw-3rem,42rem)]">
                    {formatTableLabel(table)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="min-w-0 lg:col-span-3">
            <label className="text-xs text-muted-foreground mb-1 block">Buscar registro</label>
            <Input
              value={rowSearch}
              onChange={(event) => setRowSearch(event.target.value)}
              placeholder="Buscar en registros"
              className="h-9 w-full min-w-0"
            />
          </div>
          <div className="min-w-0 lg:col-span-6">
            <label className="text-xs text-muted-foreground mb-1 block">Registro</label>
            <Select value={rowId} onValueChange={setRowId} disabled={!tableId || isLoadingRows}>
              <SelectTrigger className={`${selectTriggerClass} bg-background`}>
                <SelectValue
                  placeholder={
                    !tableId
                      ? 'Selecciona una tabla primero'
                      : isLoadingRows
                        ? 'Cargando registros...'
                        : 'Selecciona un registro'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredRows.map((row, index) => (
                  <SelectItem key={row.id} value={row.id}>
                    <div className="flex flex-col gap-0.5 min-w-0 max-w-[min(100vw-3rem,36rem)]">
                      <span className="text-sm font-medium truncate">{getRowLabel(row, index)}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {getRowPreview(row) || 'Sin datos visibles'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end lg:col-span-3">
            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || !tableId || !rowId}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  {format === 'pdf' ? (
                    <FileType className="w-4 h-4" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  Generar documento
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-foreground">Columnas del documento</p>
              <p className="text-xs text-muted-foreground">
                Activa las columnas que se incluiran y define el orden.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={showAllColumns}>
                Mostrar todas
              </Button>
              <Button variant="ghost" size="sm" onClick={hideAllColumns}>
                Ocultar todas
              </Button>
            </div>
          </div>

          {tableId && orderedColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay columnas disponibles.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto pr-2 space-y-2">
              {orderedColumns.map((col, index) => {
                const isVisible = visibleColumnIds.has(col.id)
                return (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={(checked) => toggleColumn(col.id, !!checked)}
                    />
                    <span className="text-xs flex-1 truncate">{col.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveColumn(col.id, 'up')}
                        aria-label="Subir columna"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === orderedColumns.length - 1}
                        onClick={() => moveColumn(col.id, 'down')}
                        aria-label="Bajar columna"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          {selectedRow ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">Vista rapida del registro</p>
              <div className="max-h-64 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {visibleColumns.length === 0 ? (
                    <span>No hay columnas seleccionadas para mostrar.</span>
                  ) : (
                    visibleColumns.map((col) => {
                      const rawValue = selectedRow.data?.[col.id]
                      const value = rawValue === undefined || rawValue === null || String(rawValue).trim() === ''
                        ? '—'
                        : String(rawValue)
                      return (
                        <span key={col.id}>
                          <strong>{columnLabelMap.get(col.id) ?? col.id}:</strong> {value}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span>Selecciona un registro para ver un resumen.</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
