'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  MoreHorizontal,
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Pin,
  Check,
  Undo2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { exportStyledReportExcel } from '@/lib/excel/upcrop-excel-theme'

// Countries list in Spanish
const COUNTRIES = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaiyán', 'Bahamas', 'Bangladés', 'Bélgica', 'Belice', 'Benín', 'Bielorrusia',
  'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso',
  'Burundi', 'Bután', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile',
  'China', 'Chipre', 'Colombia', 'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil',
  'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador',
  'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos',
  'Estonia', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia',
  'Ghana', 'Granada', 'Grecia', 'Guatemala', 'Guinea', 'Guinea Ecuatorial', 'Guinea-Bisáu',
  'Guyana', 'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda',
  'Islandia', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia',
  'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia',
  'Liechtenstein', 'Lituania', 'Luxemburgo', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas',
  'Malí', 'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia',
  'Mónaco', 'Mongolia', 'Montenegro', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
  'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán',
  'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido',
  'República Centroafricana', 'República Checa', 'República del Congo', 'República Democrática del Congo',
  'República Dominicana', 'Ruanda', 'Rumania', 'Rusia', 'Samoa', 'San Cristóbal y Nieves',
  'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka',
  'Suazilandia', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia',
  'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez',
  'Turkmenistán', 'Turquía', 'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu',
  'Vaticano', 'Venezuela', 'Vietnam', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue',
] as const

interface Column {
  id: string
  name: string
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select' | 'country' | 'formula' | 'countdown' | 'linked'
  options?: string[]
  optionColors?: Record<string, string>
  required?: boolean
  countdownDays?: number
  linkedTableId?: string
  linkedColumnId?: string
  formula?: {
    column1: string
    column2: string
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage'
  }
}

interface DynamicTable {
  id: string
  name: string
  description: string | null
  columns: Column[]
  module_id: string
}

interface TableRow {
  id: string
  table_id: string
  data: Record<string, unknown>
  row_order: number
  created_at: string
  updated_at: string
}

interface DataEditorProps {
  tableId: string
}

const PAGE_SIZE = 10

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// Country Combobox Component
function CountryCombobox({ 
  value, 
  onChange, 
  cellClass = ''
}: { 
  value: string
  onChange: (value: string) => void
  cellClass?: string 
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredCountries = search
    ? COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between text-sm font-normal px-2", cellClass)}
        >
          {value || "Seleccionar país..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Buscar país..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No se encontró el país</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {filteredCountries.map((country) => (
                <CommandItem
                  key={country}
                  value={country}
                  onSelect={() => {
                    onChange(country)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {country}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function DataEditor({ tableId }: DataEditorProps) {
  const supabase = useMemo(() => createClient(), [])
  const [table, setTable] = useState<DynamicTable | null>(null)
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [newRows, setNewRows] = useState<string[]>([])
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
  // Undo stack: snapshots taken right BEFORE a successful save, so the user can revert.
  const [undoStack, setUndoStack] = useState<TableRow[][]>([])
  const [undoing, setUndoing] = useState(false)
  // Linked tables data: { tableId: { rowId: rowData } }
  const [linkedTablesData, setLinkedTablesData] = useState<Record<string, Record<string, Record<string, unknown>>>>({})
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const topScrollContentRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [page, setPage] = useState(1)
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([])
  const indexHeaderRef = useRef<HTMLElement | null>(null)
  const headerRefs = useRef<Map<string, HTMLElement | null>>(new Map())
  const [pinnedLefts, setPinnedLefts] = useState<Record<string, number>>({})

  // Load table and data
  const loadData = useCallback(async () => {
    setLoading(true)

    const [tableRes, rowsRes] = await Promise.all([
      supabase
        .from('dynamic_tables')
        .select('id, name, description, columns, module_id')
        .eq('id', tableId)
        .single(),
      supabase
        .from('dynamic_table_rows')
        .select('*')
        .eq('table_id', tableId)
        .order('row_order', { ascending: true }),
    ])

    if (tableRes.data) {
      setTable(tableRes.data as DynamicTable)
    }
    if (rowsRes.data) {
      setRows(rowsRes.data)
    }

    setLoading(false)
    setPendingChanges(new Map())
    setNewRows([])
  }, [supabase, tableId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Compute left offsets for pinned columns based on actual header widths
  useEffect(() => {
    if (!table) return

    const compute = () => {
      const idxWidth = Math.round(indexHeaderRef.current?.getBoundingClientRect().width ?? 50)
      let left = idxWidth
      const lefts: Record<string, number> = {}
      for (const id of pinnedColumns) {
        const el = headerRefs.current.get(id)
        const w = Math.round(el?.getBoundingClientRect().width ?? 120)
        lefts[id] = left
        left += w
      }
      setPinnedLefts(lefts)
    }

    compute()

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => compute())
      if (indexHeaderRef.current) ro.observe(indexHeaderRef.current)
      headerRefs.current.forEach((el) => el && ro?.observe(el))
    }

    window.addEventListener('resize', compute)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [table, pinnedColumns])

  useEffect(() => {
    const topEl = topScrollRef.current
    const topContentEl = topScrollContentRef.current
    const tableEl = tableScrollRef.current
    if (!topEl || !topContentEl || !tableEl) return

    let syncing = false

    const syncTop = () => {
      if (syncing) return
      syncing = true
      topEl.scrollLeft = tableEl.scrollLeft
      syncing = false
    }

    const syncBottom = () => {
      if (syncing) return
      syncing = true
      tableEl.scrollLeft = topEl.scrollLeft
      syncing = false
    }

    const updateWidth = () => {
      topContentEl.style.width = `${tableEl.scrollWidth}px`
    }

    updateWidth()
    tableEl.addEventListener('scroll', syncTop)
    topEl.addEventListener('scroll', syncBottom)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateWidth)
      resizeObserver.observe(tableEl)
    }

    window.addEventListener('resize', updateWidth)

    return () => {
      tableEl.removeEventListener('scroll', syncTop)
      topEl.removeEventListener('scroll', syncBottom)
      window.removeEventListener('resize', updateWidth)
      resizeObserver?.disconnect()
    }
  }, [rows.length, table?.columns.length])

  // Realtime subscription on the main table's schema and rows.
  // Only auto-refresh when there are no unsaved pending changes to avoid clobbering work.
  useEffect(() => {
    const channel = supabase
      .channel(`data-editor-${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_tables',
          filter: `id=eq.${tableId}`,
        },
        () => {
          if (pendingChanges.size === 0) {
            loadData()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_table_rows',
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          if (pendingChanges.size === 0) {
            loadData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tableId, loadData, pendingChanges])

  // Load and subscribe to linked tables data
  useEffect(() => {
    if (!table) return
    const linkedTableIds = Array.from(
      new Set(
        table.columns
          .filter(c => c.type === 'linked' && c.linkedTableId)
          .map(c => c.linkedTableId as string)
      )
    )
    if (linkedTableIds.length === 0) return

    let cancelled = false

    const loadLinked = async () => {
      const { data } = await supabase
        .from('dynamic_table_rows')
        .select('id, table_id, data')
        .in('table_id', linkedTableIds)
      if (cancelled || !data) return
      const grouped: Record<string, Record<string, Record<string, unknown>>> = {}
      for (const r of data) {
        const tid = r.table_id as string
        if (!grouped[tid]) grouped[tid] = {}
        grouped[tid][r.id as string] = (r.data as Record<string, unknown>) || {}
      }
      setLinkedTablesData(grouped)
    }

    loadLinked()

    // Realtime subscription on linked tables
    const channel = supabase
      .channel(`linked-tables-${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_table_rows',
          filter: `table_id=in.(${linkedTableIds.join(',')})`,
        },
        () => {
          loadLinked()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [table, supabase, tableId])

  // Get current value (pending change or original)
  const getValue = (rowId: string, columnId: string): unknown => {
    const pending = pendingChanges.get(rowId)
    if (pending && columnId in pending) {
      return pending[columnId]
    }
    const row = rows.find((r) => r.id === rowId)
    return row?.data?.[columnId] ?? ''
  }

  const togglePinned = (colId: string) => {
    setPinnedColumns((prev) => {
      if (prev.includes(colId)) return prev.filter((c) => c !== colId)
      return [...prev, colId]
    })
  }

  // Update cell value
  const updateCell = (rowId: string, columnId: string, value: unknown) => {
    const current = pendingChanges.get(rowId) || {}
    const updated = { ...current, [columnId]: value }
    setPendingChanges(new Map(pendingChanges.set(rowId, updated)))
  }

  // Add new row
  const addRow = () => {
    const newId = crypto.randomUUID()
    const emptyData: Record<string, unknown> = {}
    table?.columns.forEach((col) => {
      emptyData[col.id] = col.type === 'boolean' ? false : ''
    })

    setRows([
      ...rows,
      {
        id: newId,
        table_id: tableId,
        data: emptyData,
        row_order: rows.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    setNewRows([...newRows, newId])
    setPendingChanges(new Map(pendingChanges.set(newId, emptyData)))
  }

  // Delete row
  const handleDeleteRow = async () => {
    if (!deleteRowId) return

    const isNew = newRows.includes(deleteRowId)

    if (isNew) {
      // Just remove from local state
      setRows(rows.filter((r) => r.id !== deleteRowId))
      setNewRows(newRows.filter((id) => id !== deleteRowId))
      const updated = new Map(pendingChanges)
      updated.delete(deleteRowId)
      setPendingChanges(updated)
    } else {
      // Snapshot before deleting so it can be undone
      const snapshot = rows
        .filter((r) => !newRows.includes(r.id))
        .map((r) => ({ ...r, data: { ...r.data } }))

      // Delete from database
      const { error } = await supabase
        .from('dynamic_table_rows')
        .delete()
        .eq('id', deleteRowId)

      if (error) {
        toast.error('Error al eliminar fila', { description: error.message })
      } else {
        setRows(rows.filter((r) => r.id !== deleteRowId))
        setUndoStack((prev) => {
          const next = [...prev, snapshot]
          return next.length > 10 ? next.slice(next.length - 10) : next
        })
        toast.success('Fila eliminada')
      }
    }

    setDeleteRowId(null)
  }

  // Undo: restore the most recent snapshot of saved rows.
  const handleUndo = async () => {
    if (undoStack.length === 0 || undoing) return
    if (pendingChanges.size > 0) {
      const ok = window.confirm('Tienes cambios sin guardar. Si continúas, los descartaré antes de revertir. ¿Continuar?')
      if (!ok) return
    }
    setUndoing(true)
    const snapshot = undoStack[undoStack.length - 1]

    try {
      // Get the IDs currently persisted in DB (excluding any locally-only new rows)
      const { data: currentDbRows, error: fetchError } = await supabase
        .from('dynamic_table_rows')
        .select('id')
        .eq('table_id', tableId)
      if (fetchError) throw fetchError

      const currentIds = new Set((currentDbRows || []).map((r) => r.id as string))
      const snapshotIds = new Set(snapshot.map((r) => r.id))

      // Rows that exist in DB now but did NOT exist in the snapshot → were inserted; delete them
      const idsToDelete = Array.from(currentIds).filter((id) => !snapshotIds.has(id))
      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('dynamic_table_rows')
          .delete()
          .in('id', idsToDelete)
        if (error) throw error
      }

      // Re-upsert each snapshot row to restore data and presence
      for (const snapRow of snapshot) {
        const { error } = await supabase
          .from('dynamic_table_rows')
          .upsert({
            id: snapRow.id,
            table_id: tableId,
            data: snapRow.data,
            row_order: snapRow.row_order,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
        if (error) throw error
      }

      setUndoStack((prev) => prev.slice(0, -1))
      await loadData()
      toast.success('Cambios revertidos')
    } catch (err) {
      console.error('Undo error:', err)
      toast.error('No se pudo deshacer', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setUndoing(false)
    }
  }

  // Save all changes
  const saveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('No hay cambios pendientes')
      return
    }

    setSaving(true)
    const { data: user } = await supabase.auth.getUser()

    // Snapshot current persisted rows BEFORE applying changes so we can undo
    const snapshot = rows
      .filter((r) => !newRows.includes(r.id))
      .map((r) => ({ ...r, data: { ...r.data } }))

    try {
      // Process new rows (inserts)
      const inserts = newRows
        .filter((id) => pendingChanges.has(id))
        .map((id) => ({
          id,
          table_id: tableId,
          data: pendingChanges.get(id),
          row_order: rows.findIndex((r) => r.id === id),
          created_by: user.user?.id,
        }))

      // Process existing rows (updates)
      const updates = Array.from(pendingChanges.entries())
        .filter(([id]) => !newRows.includes(id))
        .map(([id, changes]) => {
          const row = rows.find((r) => r.id === id)
          return {
            id,
            table_id: tableId,
            data: { ...row?.data, ...changes },
            row_order: row?.row_order ?? 0,
          }
        })

      // Execute inserts
      if (inserts.length > 0) {
        const { error } = await supabase.from('dynamic_table_rows').insert(inserts)
        if (error) throw error
      }

      // Execute updates
      for (const update of updates) {
        const { error } = await supabase
          .from('dynamic_table_rows')
          .update({ data: update.data, updated_at: new Date().toISOString() })
          .eq('id', update.id)
        if (error) throw error
      }

      toast.success('Cambios guardados', {
        description: `${inserts.length} filas nuevas, ${updates.length} filas actualizadas`,
      })

      // Push snapshot for undo (only if anything actually changed in existing rows or new rows were inserted)
      setUndoStack((prev) => {
        const next = [...prev, snapshot]
        return next.length > 10 ? next.slice(next.length - 10) : next
      })

      // Reload data
      await loadData()
    } catch (error) {
      toast.error('Error al guardar', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setSaving(false)
    }
  }

  const exportExcel = async () => {
    if (!table || rows.length === 0) return

    const headers = table.columns.map((c) => c.name)
    const excelRows = rows.map((row) =>
      table.columns.map((col) => {
        const val = row.data[col.id]
        if (val === null || val === undefined) return ''
        if (typeof val === 'boolean') return val ? 'Sí' : 'No'
        return String(val)
      }),
    )

    await exportStyledReportExcel({
      sheetName: table.name.slice(0, 31),
      title: table.name.toUpperCase(),
      moduleLabel: 'Administración — Editor de datos',
      filename: `${table.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      headers,
      rows: excelRows,
      instructions: [
        '1. Exportación de respaldo de la tabla visible en el editor.',
        '2. Los valores booleanos aparecen como Sí/No.',
        '3. Edite en UpCrop y vuelva a exportar para obtener datos actualizados.',
      ],
      summary: `Resumen: ${rows.length} fila${rows.length !== 1 ? 's' : ''} · ${table.columns.length} columna${table.columns.length !== 1 ? 's' : ''}`,
    })

    toast.success('Excel exportado')
  }

  // Render cell input
  const renderCell = (row: TableRow, column: Column) => {
    const value = getValue(row.id, column.id)
    const isNew = newRows.includes(row.id)
    const hasChange = pendingChanges.has(row.id) && column.id in (pendingChanges.get(row.id) || {})

    const cellClass = `${hasChange ? 'bg-yellow-500/10 border-yellow-500/30' : ''} ${isNew ? 'bg-green-500/10' : ''}`

    switch (column.type) {
      case 'text':
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => updateCell(row.id, column.id, e.target.value)}
            className={`h-8 bg-transparent border-0 focus:ring-1 ${cellClass}`}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={value !== '' ? Number(value) : ''}
            onChange={(e) => updateCell(row.id, column.id, e.target.value ? Number(e.target.value) : '')}
            className={`h-8 bg-transparent border-0 focus:ring-1 text-right font-mono ${cellClass}`}
          />
        )

      case 'currency':
        return (
          <Input
            type="number"
            value={value !== '' ? Number(value) : ''}
            onChange={(e) => updateCell(row.id, column.id, e.target.value ? Number(e.target.value) : '')}
            className={`h-8 bg-transparent border-0 focus:ring-1 text-right font-mono ${cellClass}`}
            placeholder="$0"
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={String(value || '')}
            onChange={(e) => updateCell(row.id, column.id, e.target.value)}
            className={`h-8 bg-transparent border-0 focus:ring-1 ${cellClass}`}
          />
        )

      case 'boolean':
        return (
          <div className={`flex items-center justify-center h-8 ${cellClass}`}>
            <Checkbox
              checked={Boolean(value)}
              onCheckedChange={(checked) => updateCell(row.id, column.id, checked)}
            />
          </div>
        )

      case 'select': {
        const selectedColor = value && column.optionColors?.[String(value)]
        return (
          <Select
            value={String(value || '')}
            onValueChange={(v) => updateCell(row.id, column.id, v)}
          >
            <SelectTrigger 
              className={`h-8 bg-transparent border-0 ${cellClass}`}
              style={selectedColor ? { 
                backgroundColor: `${selectedColor}20`,
                color: selectedColor,
                borderLeft: `3px solid ${selectedColor}`,
              } : undefined}
            >
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {column.options?.map((opt) => {
                const optColor = column.optionColors?.[opt]
                return (
                  <SelectItem key={opt} value={opt}>
                    <div className="flex items-center gap-2">
                      {optColor && (
                        <span 
                          className="inline-block w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: optColor }}
                        />
                      )}
                      {opt}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )
      }

      case 'country':
        return (
          <CountryCombobox
            value={String(value || '')}
            onChange={(v) => updateCell(row.id, column.id, v)}
            cellClass={cellClass}
          />
        )

      case 'countdown': {
        // Calculate remaining days based on row's created_at and countdownDays
        const totalDays = column.countdownDays || 0
        const createdAt = row.created_at ? new Date(row.created_at) : new Date()
        const now = new Date()
        const daysPassed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        const remaining = Math.max(0, totalDays - daysPassed)
        
        // Color coding based on remaining days
        let colorClass = 'text-green-500 bg-green-500/10'
        if (remaining === 0) {
          colorClass = 'text-red-500 bg-red-500/10'
        } else if (remaining <= 7) {
          colorClass = 'text-orange-500 bg-orange-500/10'
        } else if (remaining <= 15) {
          colorClass = 'text-yellow-500 bg-yellow-500/10'
        }
        
        return (
          <div className={`h-8 px-3 flex items-center justify-center font-mono font-medium rounded ${colorClass}`}>
            {remaining === 0 ? 'Vencido' : `${remaining} días`}
          </div>
        )
      }

      case 'formula': {
        // Calculate formula value dynamically from the row's data
        if (!column.formula) {
          return <span className="text-muted-foreground italic">-</span>
        }
        // Get values from current row state (including pending changes)
        const val1 = Number(getValue(row.id, column.formula.column1)) || 0
        const val2 = Number(getValue(row.id, column.formula.column2)) || 0
        let result: number | null = null
        switch (column.formula.operation) {
          case 'add':
            result = val1 + val2
            break
          case 'subtract':
            result = val1 - val2
            break
          case 'multiply':
            result = val1 * val2
            break
          case 'divide':
            result = val2 !== 0 ? val1 / val2 : 0
            break
          case 'percentage':
            result = val2 !== 0 ? (val1 / val2) * 100 : 0
            break
        }
        const formatted = result !== null
          ? (column.formula.operation === 'percentage'
              ? `${result.toFixed(1)}%`
              : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(result))
          : '0'
        return (
          <div className="h-8 px-3 flex items-center justify-end font-mono font-medium text-primary bg-primary/5 rounded">
            {formatted}
          </div>
        )
      }

      case 'linked': {
        // Show a dropdown of rows from the linked table; display the linked column value
        if (!column.linkedTableId || !column.linkedColumnId) {
          return <span className="text-muted-foreground italic text-xs">Sin configurar</span>
        }
        const sourceRows = linkedTablesData[column.linkedTableId] || {}
        const selectedRowId = String(value || '')
        const selectedRowData = sourceRows[selectedRowId]
        const displayValue = selectedRowData
          ? selectedRowData[column.linkedColumnId]
          : null

        return (
          <Select
            value={selectedRowId}
            onValueChange={(v) => updateCell(row.id, column.id, v)}
          >
            <SelectTrigger className={`h-8 bg-transparent border-0 ${cellClass}`}>
              <SelectValue placeholder="Seleccionar...">
                {displayValue !== null && displayValue !== undefined && displayValue !== ''
                  ? String(displayValue)
                  : <span className="text-muted-foreground italic">Seleccionar...</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sourceRows).length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">Sin datos en tabla origen</div>
              ) : (
                Object.entries(sourceRows).map(([rid, rdata]) => {
                  const v = rdata[column.linkedColumnId as string]
                  const display = v !== null && v !== undefined && v !== '' ? String(v) : '(vacío)'
                  return (
                    <SelectItem key={rid} value={rid}>
                      {display}
                    </SelectItem>
                  )
                })
              )}
            </SelectContent>
          </Select>
        )
      }

      default:
        return <span>{String(value || '')}</span>
    }
  }

  const getCellText = (row: TableRow) => {
    return table?.columns.map((c) => {
      const v = (row.data || {})[c.id]
      return v === null || v === undefined ? '' : String(v)
    }).join(' ')
  }

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => getCellText(r).toLowerCase().includes(q))
  }, [rows, debouncedSearch, table])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Format display value for currency
  const formatCurrency = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return ''
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(Number(value))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!table) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Tabla no encontrada</p>
        <Link href="/admin">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al admin
          </Button>
        </Link>
      </div>
    )
  }

  const hasChanges = pendingChanges.size > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{table.name}</h2>
          {table.description && (
            <p className="text-sm text-muted-foreground">{table.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {rows.length} filas · {table.columns.length} columnas
            {hasChanges && (
              <span className="ml-2 text-yellow-500">
                ({pendingChanges.size} cambios pendientes)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-auto max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 bg-secondary border-border mr-2"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:inline">Fijar columnas</Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0">
              <Command>
                <CommandInput placeholder="Fijar columnas..." />
                <CommandList>
                  <CommandEmpty>No hay columnas</CommandEmpty>
                  <CommandGroup>
                    {table?.columns.map((col) => (
                      <CommandItem
                        key={col.id}
                        onSelect={() => togglePinned(col.id)}
                      >
                        <Check className={`mr-2 h-4 w-4 ${pinnedColumns.includes(col.id) ? 'opacity-100' : 'opacity-0'}`} />
                        {col.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoStack.length === 0 || undoing}
            title={undoStack.length === 0 ? 'No hay nada que deshacer' : 'Revertir el último guardado'}
          >
            {undoing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4 mr-2" />
            )}
            Deshacer
            {undoStack.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({undoStack.length})</span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportExcel()} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={addRow} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nueva fila
          </Button>
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || saving}
            size="sm"
            className="bg-primary"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar ({pendingChanges.size})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Table */}
      {table.columns.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">
            Esta tabla no tiene columnas definidas.
          </p>
          <Link href="/admin">
            <Button variant="outline">Definir columnas</Button>
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg">
          <div className="sticky top-0 z-20 bg-card">
            <div ref={topScrollRef} className="overflow-x-auto scrollbar-always-visible">
              <div ref={topScrollContentRef} className="h-2" />
            </div>
          </div>
          <div ref={tableScrollRef} className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead ref={(el) => (indexHeaderRef.current = el)} className="w-[50px] text-center sticky left-0 z-40 bg-card">#</TableHead>
                {
                  // Render pinned columns first in the order the user pinned them
                  (() => {
                    if (!table) return null
                    const colsById = new Map(table.columns.map((c) => [c.id, c]))
                    const pinnedCols = pinnedColumns
                      .map((id) => colsById.get(id))
                      .filter(Boolean) as Column[]
                    const unpinnedCols = table.columns.filter((c) => !pinnedColumns.includes(c.id))

                    return (
                      <>
                        {pinnedCols.map((col, i) => {
                          const left = pinnedLefts[col.id] ?? 50 + i * 120
                          return (
                            <TableHead
                              ref={(el) => headerRefs.current.set(col.id, el)}
                              key={col.id}
                              className={`min-w-[120px] sticky top-0 bg-card ${col.type === 'number' || col.type === 'currency' ? 'text-right' : ''} z-30 border-r border-border`}
                              style={{ left: `${left}px` }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{col.name}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">({col.type === 'currency' ? 'CLP' : col.type})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => togglePinned(col.id)}
                                  title="Desfijar columna"
                                  className="p-1 rounded hover:bg-muted"
                                >
                                  <Pin className={cn('w-4 h-4 text-amber-500')} />
                                </button>
                              </div>
                            </TableHead>
                          )
                        })}
                        {unpinnedCols.map((col) => (
                          <TableHead
                            ref={(el) => headerRefs.current.set(col.id, el)}
                            key={col.id}
                            className={`min-w-[120px] ${col.type === 'number' || col.type === 'currency' ? 'text-right' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{col.name}</span>
                                <span className="ml-1 text-xs text-muted-foreground">({col.type === 'currency' ? 'CLP' : col.type})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePinned(col.id)}
                                title={pinnedColumns.includes(col.id) ? 'Desfijar columna' : 'Fijar columna'}
                                className="p-1 rounded hover:bg-muted"
                              >
                                <Pin className={cn('w-4 h-4', pinnedColumns.includes(col.id) ? 'text-amber-500' : 'opacity-50')} />
                              </button>
                            </div>
                          </TableHead>
                        ))}
                      </>
                    )
                  })()
                }
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.columns.length + 2}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Sin datos. Haz clic en &quot;Nueva fila&quot; para agregar datos.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    className={`${
                      newRows.includes(row.id)
                        ? 'bg-green-500/5 border-l-2 border-l-green-500'
                        : pendingChanges.has(row.id)
                        ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500'
                        : ''
                    }`}
                  >
                    <TableCell className="text-center text-muted-foreground font-mono text-xs sticky left-0 z-40 bg-card">
                      {(safePage - 1) * PAGE_SIZE + index + 1}
                    </TableCell>
                    {
                      // Render pinned columns first (same order as header), then the rest
                      (() => {
                        if (!table) return null
                        const colsById = new Map(table.columns.map((c) => [c.id, c]))
                        const pinnedCols = pinnedColumns
                          .map((id) => colsById.get(id))
                          .filter(Boolean) as Column[]
                        const unpinnedCols = table.columns.filter((c) => !pinnedColumns.includes(c.id))

                        return (
                          <>
                            {pinnedCols.map((col, i) => {
                              const left = pinnedLefts[col.id] ?? 50 + i * 120
                              return (
                                <TableCell key={col.id} className="p-1 sticky bg-card z-30" style={{ left: `${left}px` }}>
                                  {renderCell(row, col)}
                                </TableCell>
                              )
                            })}
                            {unpinnedCols.map((col) => (
                              <TableCell key={col.id} className="p-1">
                                {renderCell(row, col)}
                              </TableCell>
                            ))}
                          </>
                        )
                      })()
                    }
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDeleteRowId(row.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar fila
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-secondary/50">
              <div className="text-sm text-muted-foreground">Mostrando {(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <div className="text-sm">{safePage} / {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRowId} onOpenChange={() => setDeleteRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fila</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar esta fila? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRow}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
