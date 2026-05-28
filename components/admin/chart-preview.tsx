'use client'

import { useState, useEffect, useMemo, useCallback, useId, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SatelliteMap } from './satellite-map'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Check, ChevronsUpDown, Plus, Pencil, Pin, X, Trash2, Undo2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CLIENT_CREATABLE_COLUMN_TYPES } from '@/lib/column-types'
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

// Chart colors
const CHART_COLORS = [
  '#4A6CF7', // Primary blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
]

// Map colors (gradient from light to dark)
const MAP_COLORS = {
  min: '#E0F2FE',
  max: '#0369A1',
  default: '#E5E7EB',
}

// GeoJSON for world map
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Country name mapping (Spanish to English ISO names)
const COUNTRY_NAME_MAP: Record<string, string> = {
  'estados unidos': 'United States of America',
  'eeuu': 'United States of America',
  'usa': 'United States of America',
  'china': 'China',
  'japon': 'Japan',
  'japón': 'Japan',
  'alemania': 'Germany',
  'francia': 'France',
  'reino unido': 'United Kingdom',
  'españa': 'Spain',
  'italia': 'Italy',
  'brasil': 'Brazil',
  'mexico': 'Mexico',
  'méxico': 'Mexico',
  'argentina': 'Argentina',
  'chile': 'Chile',
  'peru': 'Peru',
  'perú': 'Peru',
  'colombia': 'Colombia',
  'canada': 'Canada',
  'canadá': 'Canada',
  'australia': 'Australia',
  'india': 'India',
  'rusia': 'Russia',
  'corea del sur': 'South Korea',
  'corea': 'South Korea',
  'vietnam': 'Vietnam',
  'tailandia': 'Thailand',
  'indonesia': 'Indonesia',
  'malasia': 'Malaysia',
  'singapur': 'Singapore',
  'filipinas': 'Philippines',
  'taiwan': 'Taiwan',
  'hong kong': 'Hong Kong',
  'sudafrica': 'South Africa',
  'sudáfrica': 'South Africa',
  'egipto': 'Egypt',
  'marruecos': 'Morocco',
  'nigeria': 'Nigeria',
  'kenia': 'Kenya',
  'paises bajos': 'Netherlands',
  'países bajos': 'Netherlands',
  'holanda': 'Netherlands',
  'belgica': 'Belgium',
  'bélgica': 'Belgium',
  'suiza': 'Switzerland',
  'austria': 'Austria',
  'suecia': 'Sweden',
  'noruega': 'Norway',
  'dinamarca': 'Denmark',
  'finlandia': 'Finland',
  'polonia': 'Poland',
  'portugal': 'Portugal',
  'grecia': 'Greece',
  'turquia': 'Turkey',
  'turquía': 'Turkey',
  'israel': 'Israel',
  'arabia saudita': 'Saudi Arabia',
  'emiratos arabes': 'United Arab Emirates',
  'emiratos árabes': 'United Arab Emirates',
}

// Country Combobox Component
function CountryCombobox({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string
  onChange: (value: string) => void
  disabled?: boolean 
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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between text-sm border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
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

interface Column {
  id: string
  name: string
  type: string
  isFilter?: boolean
  options?: string[]
  optionColors?: Record<string, string>
  clientEditable?: boolean
  countdownDays?: number
  linkedTableId?: string
  linkedColumnId?: string
  formula?: {
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage'
    column1: string
    column2: string
  }
}

interface ChartConfig {
  x_column?: string
  y_column?: string
  country_column?: string
  value_column?: string
  label_column?: string
  visible_columns?: string[]
  colors?: string[]
  editableColumns?: string[]
  allowAddRows?: boolean
  allowAddColumns?: boolean
  allowEditColumns?: boolean
  allowDeleteColumns?: boolean
  // Legacy support for old format
  xAxis?: string | string[]
  yAxis?: string | string[]
  groupBy?: string
  columns?: string[]
  labelColumn?: string
  valueColumns?: string[]
  showLegend?: boolean
  showGrid?: boolean
}

type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'map' | 'data_table'

interface ChartPreviewProps {
  chartId?: string
  tableId: string
  chartType: ChartType
  config: ChartConfig
  filters?: Record<string, string>
  refreshKey?: number | string   // Parent can increment this to force refresh all charts
}

export function ChartPreview({ 
  tableId, 
  chartType, 
  config, 
  filters = {}, 
  chartId,
  refreshKey 
}: ChartPreviewProps & { refreshKey?: number | string }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [rowIds, setRowIds] = useState<string[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const instanceId = useId()
  const loadDataRef = useRef<() => void>(() => {})
  const [showAddRow, setShowAddRow] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, unknown>>({})
  const [addingRow, setAddingRow] = useState(false)
  // Add column UI
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<string>('text')
  const [newColumnOptions, setNewColumnOptions] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  // Edit column UI
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editColumnName, setEditColumnName] = useState('')
  const [editColumnOptions, setEditColumnOptions] = useState('')
  const [savingColumn, setSavingColumn] = useState(false)
  // Delete column UI
  const [columnToDelete, setColumnToDelete] = useState<Column | null>(null)
  const [deletingColumn, setDeletingColumn] = useState(false)
  // Undo history (snapshots of last operations)
  type UndoAction =
    | { type: 'cell'; rowId: string; previousData: Record<string, unknown>; description: string }
    | { type: 'column-add'; columnId: string; description: string }
    | { type: 'column-edit'; previousColumns: Column[]; description: string }
    | { type: 'column-delete'; previousColumns: Column[]; description: string }
    | { type: 'row-add'; rowId: string; description: string }
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [undoing, setUndoing] = useState(false)
  // Linked tables data: { tableId: { rowId: rowData } }
  const [linkedTablesData, setLinkedTablesData] = useState<Record<string, Record<string, Record<string, unknown>>>>({})
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const topScrollContentRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({})
  const [pinnedCols, setPinnedCols] = useState<string[]>([])
  const [leftOffsets, setLeftOffsets] = useState<Record<string, number>>({})
  const [tablePage, setTablePage] = useState(1)
  const [tablePageInput, setTablePageInput] = useState('1')
  const tablePageSize = 10

  // Realtime update indicator
  const [isRealtimeUpdating, setIsRealtimeUpdating] = useState(false)

  const allowAddRows = config.allowAddRows === true
  const allowAddColumns = config.allowAddColumns === true
  const allowEditColumns = config.allowEditColumns === true
  const allowDeleteColumns = config.allowDeleteColumns === true

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Get table schema
    const { data: tableData, error: tableError } = await supabase
      .from('dynamic_tables')
      .select('columns')
      .eq('id', tableId)
      .single()

    if (tableError) {
      setError('Error al cargar esquema de tabla')
      setLoading(false)
      return
    }

    setColumns(tableData.columns as Column[])

    // Get table rows (including id for updates)
    const { data: rowsData, error: rowsError } = await supabase
      .from('dynamic_table_rows')
      .select('id, data, created_at')
      .eq('table_id', tableId)
      .order('row_order', { ascending: true })

    if (rowsError) {
      setError('Error al cargar datos')
      setLoading(false)
      return
    }

    // Store row IDs for updates
    const ids = (rowsData || []).map((row) => row.id)
    setRowIds(ids)

    // Transform and filter data - include _created_at for countdown columns
    let transformedData: Array<Record<string, unknown> & { _created_at?: unknown }> = (rowsData || []).map((row) => ({
      ...(row.data as Record<string, unknown>),
      _created_at: row.created_at,
    }))
    let filteredIds = [...ids]

    // Apply filters - exact match (case-insensitive) for single-value selects
    if (filters && Object.keys(filters).length > 0) {
      const filteredResults: { data: Record<string, unknown>; id: string }[] = []
      transformedData.forEach((row, index) => {
        const matches = Object.entries(filters).every(([colId, filterValue]) => {
          if (!filterValue || filterValue === 'all') return true
          const cellValue = String(row[colId] ?? '').trim().toLowerCase()
          const filterLower = filterValue.trim().toLowerCase()
          // Exact match if the cell exactly equals the filter, otherwise allow partial (for free-text searches)
          return cellValue === filterLower || cellValue.includes(filterLower)
        })
        if (matches) {
          filteredResults.push({ data: row, id: ids[index] })
        }
      })
      transformedData = filteredResults.map(r => r.data as Record<string, unknown> & { _created_at?: unknown })
      filteredIds = filteredResults.map(r => r.id)
    }

    setData(transformedData)
    setRowIds(filteredIds)
    setLoading(false)
  }, [supabase, tableId, filters])

  useEffect(() => {
    if (chartType !== 'data_table') return
    const totalPages = Math.max(1, Math.ceil(data.length / tablePageSize))
    setTablePage((prev) => {
      const next = Math.min(Math.max(prev, 1), totalPages)
      setTablePageInput(String(next))
      return next
    })
  }, [chartType, data.length])

  // Keep a ref to the latest loadData to avoid stale closures in Realtime
  loadDataRef.current = loadData

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (chartType !== 'data_table') return
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
  }, [chartType, columns.length, data.length])

  // Load pinned columns from localStorage per table
  useEffect(() => {
    if (!tableId || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(`pinnedCols:${tableId}`)
      if (raw) setPinnedCols(JSON.parse(raw))
    } catch {}
  }, [tableId])

  const persistPinned = (next: string[]) => {
    setPinnedCols(next)
    if (typeof window === 'undefined' || !tableId) return
    try {
      window.localStorage.setItem(`pinnedCols:${tableId}`, JSON.stringify(next))
    } catch {}
  }

  const togglePin = (colId: string) => {
    const next = pinnedCols.includes(colId) ? pinnedCols.filter((c) => c !== colId) : [...pinnedCols, colId]
    persistPinned(next)
  }

  // Compute left offsets for pinned columns by measuring header widths
  useEffect(() => {
    if (pinnedCols.length === 0) {
      setLeftOffsets({})
      return
    }
    const measure = () => {
      const map: Record<string, number> = {}
      let acc = 0
      for (const id of pinnedCols) {
        const el = headerRefs.current[id]
        const w = el?.getBoundingClientRect().width ?? 140
        map[id] = acc
        acc += Math.max(80, Math.ceil(w))
      }
      setLeftOffsets(map)
    }

    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    // observe each pinned header in case its width changes
    if (ro) {
      pinnedCols.forEach(id => {
        const el = headerRefs.current[id]
        if (el) ro.observe(el)
      })
    }

    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [pinnedCols, columns.length, data.length])

  // Centralized refresh from parent (module-data-view.tsx)
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadDataRef.current()
    }
  }, [refreshKey])

  // Realtime subscription for current table's schema and rows
  // Uses ref to always call the latest version of loadData
  useEffect(() => {
    const channel = supabase
      .channel(`chart-table-${tableId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_tables',
          filter: `id=eq.${tableId}`,
        },
        () => {
          setIsRealtimeUpdating(true)
          loadDataRef.current()
          setTimeout(() => setIsRealtimeUpdating(false), 1200)
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
          setIsRealtimeUpdating(true)
          loadDataRef.current()
          setTimeout(() => setIsRealtimeUpdating(false), 1200)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tableId, instanceId]) // loadData is accessed via ref, no need in deps

  // Load and subscribe to linked tables
  useEffect(() => {
    const linkedTableIds = Array.from(
      new Set(
        columns
          .filter(c => c.type === 'linked' && c.linkedTableId)
          .map(c => c.linkedTableId as string)
      )
    )
    if (linkedTableIds.length === 0) return

    let cancelled = false

    const loadLinked = async () => {
      const { data: linkedData } = await supabase
        .from('dynamic_table_rows')
        .select('id, table_id, data')
        .in('table_id', linkedTableIds)
      if (cancelled || !linkedData) return
      const grouped: Record<string, Record<string, Record<string, unknown>>> = {}
      for (const r of linkedData) {
        const tid = r.table_id as string
        if (!grouped[tid]) grouped[tid] = {}
        grouped[tid][r.id as string] = (r.data as Record<string, unknown>) || {}
      }
      setLinkedTablesData(grouped)
    }

    loadLinked()

    const channel = supabase
      .channel(`chart-linked-${tableId}-${linkedTableIds.join('-')}`)
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
  }, [columns, supabase, tableId])

  // Update cell value
  const updateCellValue = async (rowIndex: number, colId: string, newValue: unknown) => {
    const rowId = rowIds[rowIndex]
    if (!rowId) return

    const cellKey = `${rowIndex}-${colId}`
    setSavingCell(cellKey)

    try {
      // Get current row data
      const { data: currentRow, error: fetchError } = await supabase
        .from('dynamic_table_rows')
        .select('data')
        .eq('id', rowId)
        .single()

      if (fetchError) throw fetchError

      const previousData = (currentRow.data as Record<string, unknown>) || {}

      // Update the specific field
      let updatedData = {
        ...previousData,
        [colId]: newValue,
      }
      
      // Recalculate all formula columns
      columns.filter(col => col.type === 'formula' && col.formula).forEach(col => {
        if (col.formula?.column1 === colId || col.formula?.column2 === colId) {
          const result = calculateFormula(updatedData, col)
          if (result !== null) {
            updatedData[col.id] = result
          }
        }
      })

      const { error: updateError } = await supabase
        .from('dynamic_table_rows')
        .update({ data: updatedData })
        .eq('id', rowId)

      if (updateError) throw updateError

      pushUndo({
        type: 'cell',
        rowId,
        previousData,
        description: 'Revertir edición de celda',
      })

      // Update local state
      setData(prev => {
        const newData = [...prev]
        newData[rowIndex] = updatedData
        return newData
      })

      toast.success('Actualizado')
    } catch (err) {
      console.error('Error updating cell:', err)
      toast.error('Error al actualizar')
    } finally {
      setSavingCell(null)
    }
  }

  // Add new row
  const addNewRow = async () => {
    setAddingRow(true)
    try {
      // Calculate formula values before saving
      const dataWithFormulas = { ...newRowData }
      columns.filter(col => col.type === 'formula' && col.formula).forEach(col => {
        const result = calculateFormula(newRowData, col)
        if (result !== null) {
          dataWithFormulas[col.id] = result
        }
      })
      
      const { data: insertedRow, error } = await supabase
        .from('dynamic_table_rows')
        .insert({
          table_id: tableId,
          data: dataWithFormulas,
        })
        .select('id')
        .single()

      if (error) throw error

      // Add to local state
      setData(prev => [...prev, dataWithFormulas])
      setRowIds(prev => [...prev, insertedRow.id])
      setNewRowData({})
      setShowAddRow(false)
      pushUndo({
        type: 'row-add',
        rowId: insertedRow.id,
        description: 'Eliminar fila agregada',
      })
      toast.success('Fila agregada')
    } catch (err) {
      console.error('Error adding row:', err)
      toast.error('Error al agregar fila')
    } finally {
      setAddingRow(false)
    }
  }

  // Undo helpers
  const pushUndo = (action: UndoAction) => {
    setUndoStack(prev => {
      const next = [...prev, action]
      // Cap at 20 entries
      return next.length > 20 ? next.slice(next.length - 20) : next
    })
  }

  const handleUndo = async () => {
    if (undoStack.length === 0 || undoing) return
    const action = undoStack[undoStack.length - 1]
    setUndoing(true)
    try {
      if (action.type === 'cell') {
        const { error } = await supabase
          .from('dynamic_table_rows')
          .update({ data: action.previousData })
          .eq('id', action.rowId)
        if (error) throw error
        toast.success('Cambio revertido')
      } else if (action.type === 'column-add') {
        // Remove the added column
        const updatedColumns = columns.filter(c => c.id !== action.columnId)
        const { error } = await supabase
          .from('dynamic_tables')
          .update({ columns: updatedColumns, updated_at: new Date().toISOString() })
          .eq('id', tableId)
        if (error) throw error
        setColumns(updatedColumns)
        toast.success('Columna eliminada (deshacer)')
      } else if (action.type === 'column-edit' || action.type === 'column-delete') {
        const { error } = await supabase
          .from('dynamic_tables')
          .update({ columns: action.previousColumns, updated_at: new Date().toISOString() })
          .eq('id', tableId)
        if (error) throw error
        setColumns(action.previousColumns)
        toast.success('Columnas restauradas')
      } else if (action.type === 'row-add') {
        const { error } = await supabase
          .from('dynamic_table_rows')
          .delete()
          .eq('id', action.rowId)
        if (error) throw error
        toast.success('Fila eliminada (deshacer)')
      }
      setUndoStack(prev => prev.slice(0, -1))
    } catch (err) {
      console.error('Undo error:', err)
      toast.error('No se pudo deshacer')
    } finally {
      setUndoing(false)
    }
  }

  // Delete column with confirmation
  const requestDeleteColumn = (col: Column) => {
    setColumnToDelete(col)
  }

  const confirmDeleteColumn = async () => {
    if (!columnToDelete) return
    setDeletingColumn(true)
    try {
      const previousColumns = columns
      const updatedColumns = columns.filter(c => c.id !== columnToDelete.id)

      const { error } = await supabase
        .from('dynamic_tables')
        .update({ columns: updatedColumns, updated_at: new Date().toISOString() })
        .eq('id', tableId)

      if (error) throw error

      // If the chart has visible_columns/editableColumns, also clean those up
      if (chartId) {
        const cleanedVisible = (config.visible_columns || config.columns || []).filter(id => id !== columnToDelete.id)
        const cleanedEditable = (config.editableColumns || []).filter(id => id !== columnToDelete.id)
        const updatedConfig = {
          ...config,
          visible_columns: cleanedVisible,
          editableColumns: cleanedEditable,
        }
        await supabase
          .from('dynamic_charts')
          .update({ config: updatedConfig, updated_at: new Date().toISOString() })
          .eq('id', chartId)
      }

      setColumns(updatedColumns)
      pushUndo({
        type: 'column-delete',
        previousColumns,
        description: `Restaurar columna "${columnToDelete.name}"`,
      })
      toast.success(`Columna "${columnToDelete.name}" eliminada`)
      setColumnToDelete(null)
    } catch (err) {
      console.error('Error deleting column:', err)
      toast.error('No se pudo eliminar la columna')
    } finally {
      setDeletingColumn(false)
    }
  }

  // Edit existing column (rename and/or update select options)
  const startEditColumn = (col: Column) => {
    setEditingColumnId(col.id)
    setEditColumnName(col.name)
    setEditColumnOptions(col.type === 'select' && col.options ? col.options.join(', ') : '')
  }

  const cancelEditColumn = () => {
    setEditingColumnId(null)
    setEditColumnName('')
    setEditColumnOptions('')
  }

  const saveColumnEdit = async () => {
    if (!editingColumnId) return
    const trimmedName = editColumnName.trim()
    if (!trimmedName) {
      toast.error('El nombre de la columna no puede estar vacío')
      return
    }

    const target = columns.find(c => c.id === editingColumnId)
    if (!target) return

    // Prevent duplicates (case-insensitive) excluding the column being edited
    const exists = columns.some(c => c.id !== editingColumnId && c.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (exists) {
      toast.error('Ya existe una columna con ese nombre')
      return
    }

    setSavingColumn(true)
    try {
      const updatedColumns = columns.map(c => {
        if (c.id !== editingColumnId) return c
        const next: Column = { ...c, name: trimmedName }
        if (c.type === 'select') {
          const opts = editColumnOptions.split(',').map(s => s.trim()).filter(Boolean)
          if (opts.length === 0) {
            // Keep at least one option
            return c
          }
          next.options = opts
        }
        return next
      })

      const { error } = await supabase
        .from('dynamic_tables')
        .update({ columns: updatedColumns, updated_at: new Date().toISOString() })
        .eq('id', tableId)

      if (error) throw error

      const previousColumns = columns
      setColumns(updatedColumns)
      pushUndo({
        type: 'column-edit',
        previousColumns,
        description: 'Revertir edición de columna',
      })
      cancelEditColumn()
      toast.success('Columna actualizada')
    } catch (err) {
      console.error('Error updating column:', err)
      toast.error('No se pudo actualizar la columna')
    } finally {
      setSavingColumn(false)
    }
  }

  // Add new column to the table (client-side action)
  const addNewColumn = async () => {
    const trimmedName = newColumnName.trim()
    if (!trimmedName) {
      toast.error('Debes ingresar un nombre para la columna')
      return
    }
    if (columns.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error('Ya existe una columna con ese nombre')
      return
    }

    setAddingColumn(true)
    try {
      const newCol: Column = {
        id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName,
        type: newColumnType,
        // Auto-mark as editable so the client can use the new column immediately
        clientEditable: true,
      }
      if (newColumnType === 'select') {
        const opts = newColumnOptions.split(',').map(s => s.trim()).filter(Boolean)
        if (opts.length === 0) {
          toast.error('Debes ingresar al menos una opción')
          setAddingColumn(false)
          return
        }
        newCol.options = opts
      }

      const updatedColumns = [...columns, newCol]
      
      const { error } = await supabase
        .from('dynamic_tables')
        .update({ columns: updatedColumns, updated_at: new Date().toISOString() })
        .eq('id', tableId)

      if (error) throw error

      // Also update the chart config to include the new column as visible AND editable
      if (chartId) {
        const updatedVisible = Array.from(new Set([...(config.visible_columns || config.columns || []), newCol.id]))
        const updatedEditable = Array.from(new Set([...(config.editableColumns || []), newCol.id]))
        const updatedConfig = {
          ...config,
          visible_columns: updatedVisible,
          editableColumns: updatedEditable,
        }
        const { error: chartError } = await supabase
          .from('dynamic_charts')
          .update({ config: updatedConfig, updated_at: new Date().toISOString() })
          .eq('id', chartId)
        if (chartError) {
          console.error('Error updating chart config:', chartError)
        }
      }

      setColumns(updatedColumns)
      setNewColumnName('')
      setNewColumnType('text')
      setNewColumnOptions('')
      setShowAddColumn(false)
      pushUndo({
        type: 'column-add',
        columnId: newCol.id,
        description: 'Eliminar columna recién creada',
      })
      toast.success('Columna agregada')
    } catch (err) {
      console.error('Error adding column:', err)
      toast.error('Error al agregar columna')
    } finally {
      setAddingColumn(false)
    }
  }

  // Calculate formula value
  const calculateFormula = (row: Record<string, unknown>, col: Column): number | null => {
    if (!col.formula) return null
    
    const { column1, column2, operation } = col.formula
    
    // Get values by column ID (primary storage format)
    const val1 = Number(row[column1]) || 0
    const val2 = Number(row[column2]) || 0
    
    switch (operation) {
      case 'add':
        return val1 + val2
      case 'subtract':
        return val1 - val2
      case 'multiply':
        return val1 * val2
      case 'divide':
        return val2 !== 0 ? val1 / val2 : 0
      case 'percentage':
        return val2 !== 0 ? (val1 / val2) * 100 : 0
      default:
        return null
    }
  }

  // Get column name by id
  const getColumnName = (colId: string): string => {
    const col = columns.find((c) => c.id === colId)
    return col?.name || colId
  }

  // Get column type by id
  const getColumnType = (colId: string): string => {
    const col = columns.find((c) => c.id === colId)
    return col?.type || 'text'
  }

  // Format value based on column type
  const formatValue = (value: unknown, colId: string, row?: Record<string, unknown>): string => {
    const col = columns.find((c) => c.id === colId)
    const colType = col?.type || 'text'
    
    // Handle formula columns - ALWAYS calculate dynamically
    if (colType === 'formula' && col?.formula && row) {
      const result = calculateFormula(row, col)
      if (result !== null) {
        if (col.formula.operation === 'percentage') {
          return `${result.toFixed(1)}%`
        }
        return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(result)
      }
      return '-'
    }
    
    if (colType === 'currency') {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(Number(value) || 0)
    }
    if (colType === 'number') {
      return new Intl.NumberFormat('es-CL').format(Number(value) || 0)
    }
    if (colType === 'date' && value) {
      return new Date(String(value)).toLocaleDateString('es-CL')
    }
    if (colType === 'boolean') {
      return value ? 'Sí' : 'No'
    }
    return String(value || '-')
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {getColumnName(entry.dataKey)}: {formatValue(entry.value, entry.dataKey)}
          </p>
        ))}
      </div>
    )
  }

  // Normalize country name for matching
  const normalizeCountryName = (name: string): string => {
    const lower = name.toLowerCase().trim()
    return COUNTRY_NAME_MAP[lower] || name
  }

  // Get color for map based on value
  const getMapColor = (value: number, maxValue: number): string => {
    if (!value || maxValue === 0) return MAP_COLORS.default
    const ratio = Math.min(value / maxValue, 1)
    // Interpolate between min and max colors
    const minRGB = [224, 242, 254] // #E0F2FE
    const maxRGB = [3, 105, 161] // #0369A1
    const r = Math.round(minRGB[0] + (maxRGB[0] - minRGB[0]) * ratio)
    const g = Math.round(minRGB[1] + (maxRGB[1] - minRGB[1]) * ratio)
    const b = Math.round(minRGB[2] + (maxRGB[2] - minRGB[2]) * ratio)
    return `rgb(${r}, ${g}, ${b})`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {error}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Sin datos para mostrar
      </div>
    )
  }

  // Get config values (support both new and legacy formats)
  const firstOf = (v?: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : (v ?? ''))
  const xColumn = firstOf(config.x_column ?? config.xAxis ?? config.labelColumn)
  const yColumn = firstOf(config.y_column ?? config.yAxis ?? (config.valueColumns ? config.valueColumns[0] : undefined))
  const labelColumn = firstOf(config.label_column ?? config.labelColumn ?? xColumn)
  const valueColumn = firstOf(config.value_column ?? (config.valueColumns ? config.valueColumns[0] : undefined) ?? yColumn)
  const countryColumn = firstOf(config.country_column ?? config.groupBy)
  const visibleColumns = (config.visible_columns || config.columns || []) as string[]

  // Filter rows that have actual data in the columns used by this chart
  // (ignore completely empty rows in X/Y so they don't pollute the chart)
  const chartDataSource = data.filter((row: any) => {
    if (chartType === 'data_table') return true

    const xVal = xColumn ? row[xColumn] : null
    const yVal = yColumn ? row[yColumn] : null

    const hasX = xVal != null && String(xVal).trim() !== ''
    const hasY = yVal != null && String(yVal).trim() !== ''

    if (['bar', 'line', 'area'].includes(chartType)) {
      return hasX && hasY
    }
    if (['pie', 'donut'].includes(chartType)) {
      return hasX && hasY
    }
    return hasX || hasY
  })

  // Prepare chart data based on type (using only rows with data)
  const prepareChartData = () => {
    if (chartType === 'bar' || chartType === 'line' || chartType === 'area') {
      return chartDataSource.map((row) => ({
        label: String(row[xColumn]),
        value: Number(row[yColumn]) || 0,
      }))
    }
    if (chartType === 'pie' || chartType === 'donut') {
      return chartDataSource.map((row, index) => ({
        name: String(row[labelColumn] || row[xColumn]),
        value: Number(row[valueColumn] || row[yColumn]) || 0,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }))
    }
    return chartDataSource
  }

  const chartData = prepareChartData()

  // Render chart based on type
  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                  return value
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="value" name={getColumnName(yColumn)} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                  return value
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="value" name={getColumnName(yColumn)} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ fill: CHART_COLORS[0], strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                  return value
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="value" name={getColumnName(yColumn)} stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {(chartData as Array<{ fill: string }>).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {(chartData as Array<{ fill: string }>).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'map':
        // Collect all countries from the country column
        const mapCountries: string[] = []
        data.forEach((row) => {
          const country = String(row[countryColumn] || '').trim()
          if (country) {
            mapCountries.push(country)
          }
        })

        // Get the color from config or use default blue
        const mapColor = config.colors?.[0] || '#4A6CF7'

        return (
          <SatelliteMap 
            countries={mapCountries} 
            markerColor={mapColor}
            height={400}
          />
        )

      case 'data_table':
        // IMPORTANTE: Siempre incluir columnas de fórmula además de las visibles
        const formulaColumnIds = columns.filter(c => c.type === 'formula').map(c => c.id)
        const baseColumns = visibleColumns.length > 0 
          ? columns.filter((c) => visibleColumns.includes(c.id) || formulaColumnIds.includes(c.id))
          : columns
        let displayColumns = baseColumns
        // Reorder so pinned columns are rendered first (preserve pinnedCols order)
        if (pinnedCols.length > 0) {
          const pinnedSet = new Set(pinnedCols)
          const pinnedList = pinnedCols.map(id => baseColumns.find(c => c.id === id)).filter(Boolean) as Column[]
          const rest = baseColumns.filter(c => !pinnedSet.has(c.id))
          displayColumns = [...pinnedList, ...rest]
        }
        const totalPages = Math.max(1, Math.ceil(data.length / tablePageSize))
        const safePage = Math.min(Math.max(tablePage, 1), totalPages)
        const pageStart = (safePage - 1) * tablePageSize
        const pageRows = data.slice(pageStart, pageStart + tablePageSize)

        // Pre-compute satellite map block so it can render ABOVE the table
        const renderSatelliteMap = () => {
          const countryColumns = displayColumns.filter(c => c.type === 'country')
          if (countryColumns.length === 0) return null

          const countriesSet = new Set<string>()
          data.forEach(row => {
            countryColumns.forEach(col => {
              const value = row[col.id]
              if (value && typeof value === 'string') {
                countriesSet.add(value.toLowerCase())
              }
            })
          })
          if (countriesSet.size === 0) return null

          // Get the list of countries for the satellite map
          const countryList: string[] = []
          data.forEach(row => {
            countryColumns.forEach(col => {
              const value = String(row[col.id] || '').trim()
              if (value) {
                countryList.push(value)
              }
            })
          })
          if (countryList.length === 0) return null

          return (
            <div className="mb-4 p-4 border rounded-lg bg-card">
              <p className="text-sm font-medium mb-2">Mapa de destinos ({countriesSet.size} países)</p>
              <SatelliteMap
                countries={countryList}
                markerColor="#4A6CF7"
                height={280}
              />
            </div>
          )
        }

        return (
          <div className="w-full max-w-full min-w-0 space-y-4">
            {/* Map FIRST - above the table */}
            {renderSatelliteMap()}
            <div className="border rounded-lg w-full max-w-full min-w-0 overflow-hidden">
              <div className="sticky top-0 z-20 bg-card">
                <div ref={topScrollRef} className="overflow-x-auto scrollbar-always-visible">
                  <div ref={topScrollContentRef} className="h-2" />
                </div>
              </div>
              <div ref={tableScrollRef} className="max-h-[420px] overflow-x-auto overflow-y-auto scrollbar-always-visible">
                <Table className="min-w-[800px] w-max">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="bg-secondary/50">
                                {displayColumns.map((col) => (
                                  <TableHead
                                    key={col.id}
                                    ref={(el: HTMLTableCellElement | null) => { headerRefs.current[col.id] = el }}
                                    className={cn('font-semibold', pinnedCols.includes(col.id) ? 'z-30' : '')}
                                    style={pinnedCols.includes(col.id) ? { position: 'sticky', left: leftOffsets[col.id] ?? 0, top: 0, zIndex: 40, background: 'var(--card)' } : undefined}
                                  >
                        {editingColumnId === col.id ? (
                          <div className="flex flex-col gap-2 py-2 px-1 min-w-[220px] bg-card rounded-md border-2 border-primary/40 shadow-sm">
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Nombre</label>
                              <Input
                                value={editColumnName}
                                onChange={(e) => setEditColumnName(e.target.value)}
                                placeholder="Nombre de la columna"
                                className="h-8 text-sm bg-background"
                                autoFocus
                              />
                            </div>
                            {col.type === 'select' && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Opciones</label>
                                <Input
                                  value={editColumnOptions}
                                  onChange={(e) => setEditColumnOptions(e.target.value)}
                                  placeholder="Separadas por coma"
                                  className="h-8 text-xs bg-background"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                              <Button
                                size="sm"
                                onClick={saveColumnEdit}
                                disabled={savingColumn}
                                className="h-7 px-3 text-xs flex-1"
                              >
                                {savingColumn ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditColumn}
                                disabled={savingColumn}
                                className="h-7 px-2 text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>{col.name}</span>
                            <button
                              type="button"
                              onClick={() => togglePin(col.id)}
                              className="ml-1 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title={pinnedCols.includes(col.id) ? 'Desanclar columna' : 'Anclar columna'}
                              aria-pressed={pinnedCols.includes(col.id)}
                            >
                              <Pin className={cn('w-3 h-3', pinnedCols.includes(col.id) ? 'text-amber-500' : 'opacity-50')} />
                            </button>
                            {col.clientEditable && (
                              <span className="ml-1 text-xs text-amber-500">(editable)</span>
                            )}
                            {allowEditColumns && (
                              <button
                                type="button"
                                onClick={() => startEditColumn(col)}
                                className="ml-1 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={`Editar columna ${col.name}`}
                                title="Editar columna"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {allowDeleteColumns && (
                              <button
                                type="button"
                                onClick={() => requestDeleteColumn(col)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                aria-label={`Eliminar columna ${col.name}`}
                                title="Eliminar columna"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row, rowIndex) => (
                    <TableRow key={pageStart + rowIndex}>
                      {displayColumns.map((col) => {
                        const isPinned = pinnedCols.includes(col.id)
                        const stickyStyle = isPinned ? { position: 'sticky' as const, left: (leftOffsets[col.id] ?? 0), zIndex: 30, background: 'var(--card)' } : undefined
                        // A column is editable if marked at column level OR included in chart's editableColumns
                        const isEditable = col.clientEditable === true || (config.editableColumns || []).includes(col.id)
                        const cellKey = `${rowIndex}-${col.id}`
                        const isSaving = savingCell === cellKey
                        
                        // Countdown columns - show remaining days
                        if (col.type === 'countdown') {
                          const totalDays = col.countdownDays || 0
                          const createdAt = row._created_at ? new Date(String(row._created_at)) : new Date()
                          const now = new Date()
                          const daysPassed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
                          const remaining = Math.max(0, totalDays - daysPassed)
                          
                          let colorStyle: React.CSSProperties = { backgroundColor: 'rgb(34 197 94 / 0.1)', color: 'rgb(34 197 94)' }
                          if (remaining === 0) {
                            colorStyle = { backgroundColor: 'rgb(239 68 68 / 0.1)', color: 'rgb(239 68 68)' }
                          } else if (remaining <= 7) {
                            colorStyle = { backgroundColor: 'rgb(249 115 22 / 0.1)', color: 'rgb(249 115 22)' }
                          } else if (remaining <= 15) {
                            colorStyle = { backgroundColor: 'rgb(234 179 8 / 0.1)', color: 'rgb(234 179 8)' }
                          }
                          
                          return (
                            <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <div className="h-8 px-3 flex items-center justify-center font-mono font-medium rounded" style={colorStyle}>
                                {remaining === 0 ? 'Vencido' : `${remaining} días`}
                              </div>
                            </TableCell>
                          )
                        }

                        // Linked columns - show value from linked table (auto-updated via realtime)
                        if (col.type === 'linked') {
                          if (!col.linkedTableId || !col.linkedColumnId) {
                            return (
                              <TableCell key={col.id} className="text-muted-foreground italic text-xs" style={stickyStyle}>
                                Sin configurar
                              </TableCell>
                            )
                          }
                          const sourceRows = linkedTablesData[col.linkedTableId] || {}
                          const selectedRowId = String(row[col.id] || '')
                          const selectedData = sourceRows[selectedRowId]
                          const linkedValue = selectedData?.[col.linkedColumnId]
                          const display = linkedValue !== null && linkedValue !== undefined && linkedValue !== ''
                            ? String(linkedValue)
                            : '-'

                          if (isEditable) {
                            return (
                              <TableCell key={col.id} className="p-1" style={stickyStyle}>
                                <Select
                                  value={selectedRowId}
                                  onValueChange={(v) => updateCellValue(rowIndex, col.id, v)}
                                >
                                  <SelectTrigger className="h-8 w-full text-sm border-0 bg-transparent focus:ring-1">
                                    <SelectValue placeholder="Seleccionar...">
                                      {selectedData ? display : <span className="text-muted-foreground italic">Seleccionar...</span>}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(sourceRows).length === 0 ? (
                                      <div className="p-2 text-xs text-muted-foreground">Sin datos</div>
                                    ) : (
                                      Object.entries(sourceRows).map(([rid, rdata]) => {
                                        const v = rdata[col.linkedColumnId as string]
                                        const dv = v !== null && v !== undefined && v !== '' ? String(v) : '(vacío)'
                                        return (
                                          <SelectItem key={rid} value={rid}>{dv}</SelectItem>
                                        )
                                      })
                                    )}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            )
                          }

                            return (
                              <TableCell key={col.id} className="bg-blue-500/5 border-l-2 border-blue-500/30" style={stickyStyle}>
                              {display}
                            </TableCell>
                          )
                        }
                        
                        // Formula columns - always show calculated value
                        if (col.type === 'formula') {
                          const result = calculateFormula(row, col)
                          return (
                            <TableCell key={col.id} className="bg-primary/5 font-medium text-primary border-l-2 border-primary/50" style={stickyStyle}>
                              {result !== null 
                                ? (col.formula?.operation === 'percentage' 
                                    ? `${result.toFixed(1)}%` 
                                    : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(result))
                                : '0'}
                            </TableCell>
                          )
                        }

                        // Editable select/boolean cell
                        if (isEditable && (col.type === 'select' || col.type === 'boolean')) {
                          const options = col.type === 'boolean' 
                            ? ['Sí', 'No'] 
                            : (col.options || ['Opción 1', 'Opción 2'])
                          const currentValue = String(row[col.id] || '')
                          const selectedColor = col.type === 'select' && currentValue && col.optionColors?.[currentValue]
                          
                          return (
                            <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <div className="relative">
                                <Select
                                  value={currentValue}
                                  onValueChange={(value) => updateCellValue(rowIndex, col.id, value)}
                                  disabled={isSaving}
                                >
                                  <SelectTrigger 
                                    className="h-8 text-sm border-amber-500/30 bg-amber-500/5"
                                    style={selectedColor ? { 
                                      backgroundColor: `${selectedColor}20`,
                                      color: selectedColor,
                                      borderLeft: `3px solid ${selectedColor}`,
                                    } : undefined}
                                  >
                                    <SelectValue placeholder="Seleccionar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((opt) => {
                                      const optColor = col.optionColors?.[opt]
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
                                {isSaving && (
                                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )
                        }

                        // Editable country cell with autocomplete
                        if (isEditable && col.type === 'country') {
                            return (
                              <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <CountryCombobox
                                value={String(row[col.id] || '')}
                                onChange={(value) => updateCellValue(pageStart + rowIndex, col.id, value)}
                                disabled={isSaving}
                              />
                              {isSaving && (
                                <Loader2 className="w-4 h-4 animate-spin text-primary absolute right-2 top-1/2 -translate-y-1/2" />
                              )}
                            </TableCell>
                          )
                        }

                        // Editable text cell
                        if (isEditable && (col.type === 'text' || !col.type)) {
                          return (
                            <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <div className="relative">
                                <Input
                                  type="text"
                                  value={String(row[col.id] || '')}
                                  onChange={(e) => updateCellValue(pageStart + rowIndex, col.id, e.target.value)}
                                  disabled={isSaving}
                                  className="h-8 text-sm border-amber-500/30 bg-amber-500/5"
                                />
                                {isSaving && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )
                        }

                        // Editable number/currency cell
                        if (isEditable && (col.type === 'number' || col.type === 'currency')) {
                          return (
                            <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={row[col.id] !== null && row[col.id] !== undefined ? String(row[col.id]) : ''}
                                  onChange={(e) => updateCellValue(pageStart + rowIndex, col.id, e.target.value ? Number(e.target.value) : null)}
                                  disabled={isSaving}
                                  className="h-8 text-sm border-amber-500/30 bg-amber-500/5"
                                />
                                {isSaving && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )
                        }

                        // Editable date cell
                        if (isEditable && col.type === 'date') {
                          return (
                            <TableCell key={col.id} className="p-1" style={stickyStyle}>
                              <div className="relative">
                                <Input
                                  type="date"
                                  value={row[col.id] ? String(row[col.id]).split('T')[0] : ''}
                                  onChange={(e) => updateCellValue(pageStart + rowIndex, col.id, e.target.value)}
                                  disabled={isSaving}
                                  className="h-8 text-sm border-amber-500/30 bg-amber-500/5"
                                />
                                {isSaving && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )
                        }

                        // Normal cell (including formula columns)
                        // For select columns with color, render with colored badge
                        if (col.type === 'select' && col.optionColors) {
                          const cellValue = String(row[col.id] || '')
                          const cellColor = col.optionColors[cellValue]
                          if (cellValue && cellColor) {
                            return (
                              <TableCell key={col.id} style={stickyStyle}>
                                <span 
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                                  style={{ 
                                    backgroundColor: `${cellColor}20`, 
                                    color: cellColor,
                                    borderLeft: `3px solid ${cellColor}`,
                                  }}
                                >
                                  <span 
                                    className="inline-block w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: cellColor }}
                                  />
                                  {cellValue}
                                </span>
                              </TableCell>
                            )
                          }
                        }
                        
                        return (
                          <TableCell key={col.id} style={stickyStyle}>
                            {formatValue(row[col.id], col.id, row)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="px-4 py-2 bg-secondary/30 border-t text-sm text-muted-foreground flex items-center justify-between flex-wrap gap-3">
              <span>
                {data.length} {data.length === 1 ? 'registro' : 'registros'} · página {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTablePage(1)}
                  disabled={safePage === 1}
                >
                  Primero
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTablePage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Ir a</span>
                  <Input
                    value={tablePageInput}
                    onChange={(event) => setTablePageInput(event.target.value)}
                    onBlur={() => {
                      const parsed = Number(tablePageInput)
                      if (!Number.isFinite(parsed)) {
                        setTablePageInput(String(safePage))
                        return
                      }
                      const next = Math.min(Math.max(Math.trunc(parsed), 1), totalPages)
                      setTablePage(next)
                      setTablePageInput(String(next))
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      const parsed = Number(tablePageInput)
                      if (!Number.isFinite(parsed)) {
                        setTablePageInput(String(safePage))
                        return
                      }
                      const next = Math.min(Math.max(Math.trunc(parsed), 1), totalPages)
                      setTablePage(next)
                      setTablePageInput(String(next))
                    }}
                    className="h-8 w-16 text-center"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTablePage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                >
                  Siguiente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTablePage(totalPages)}
                  disabled={safePage === totalPages}
                >
                  Ultimo
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {displayColumns.some(col => col.clientEditable) && (
                  <span className="text-amber-500 text-xs">Las columnas marcadas son editables</span>
                )}
                {(allowAddRows || allowAddColumns || allowEditColumns || allowDeleteColumns) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUndo}
                    disabled={undoing || undoStack.length === 0}
                    className="h-7 text-xs gap-1.5"
                    title={undoStack.length === 0 ? 'No hay cambios para deshacer' : 'Revertir el último cambio'}
                  >
                    {undoing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Undo2 className="w-3 h-3" />
                    )}
                    Deshacer
                    {undoStack.length > 0 && (
                      <span className="ml-0.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
                        {undoStack.length}
                      </span>
                    )}
                  </Button>
                )}
                {allowAddRows && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddRow(!showAddRow)}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar fila
                  </Button>
                )}
                {allowAddColumns && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddColumn(!showAddColumn)}
                    className="h-7 text-xs border-blue-500/40 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar columna
                  </Button>
                )}
              </div>
            </div>
            {/* Add column form */}
            {allowAddColumns && showAddColumn && (
              <div className="px-5 py-4 bg-card border-t-2 border-primary/30 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nueva columna</p>
                    <p className="text-xs text-muted-foreground">Define el nombre y tipo de la columna a agregar</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Nombre</label>
                    <Input
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="Ej: Notas"
                      className="h-9 text-sm bg-background border-border focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Tipo</label>
                    <Select
                      value={newColumnType}
                      onValueChange={(v) => setNewColumnType(v)}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_CREATABLE_COLUMN_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newColumnType === 'select' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Opciones (separadas por coma)</label>
                      <Input
                        value={newColumnOptions}
                        onChange={(e) => setNewColumnOptions(e.target.value)}
                        placeholder="Opción 1, Opción 2"
                        className="h-9 text-sm bg-background"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={addNewColumn}
                    disabled={addingColumn || !newColumnName.trim()}
                    className="h-9"
                  >
                    {addingColumn ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                    Crear columna
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddColumn(false)
                      setNewColumnName('')
                      setNewColumnType('text')
                      setNewColumnOptions('')
                    }}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {/* Add row form */}
            {allowAddRows && showAddRow && (
              <div className="px-5 py-4 bg-card border-t-2 border-amber-500/40 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nueva fila</p>
                    <p className="text-xs text-muted-foreground">Completa los datos de cada columna</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                  {displayColumns.filter(col => col.type !== 'formula').map((col) => (
                    <div key={col.id} className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">{col.name}</label>
                      {col.type === 'select' ? (
                        <Select
                          value={String(newRowData[col.id] || '')}
                          onValueChange={(v) => setNewRowData(prev => ({ ...prev, [col.id]: v }))}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(col.options || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : col.type === 'country' ? (
                        <CountryCombobox
                          value={String(newRowData[col.id] || '')}
                          onChange={(v) => setNewRowData(prev => ({ ...prev, [col.id]: v }))}
                        />
                      ) : col.type === 'number' || col.type === 'currency' ? (
                        <Input
                          type="number"
                          value={newRowData[col.id] !== undefined ? String(newRowData[col.id]) : ''}
                          onChange={(e) => setNewRowData(prev => ({ ...prev, [col.id]: e.target.value ? Number(e.target.value) : null }))}
                          className="h-9 text-sm bg-background"
                          placeholder={col.type === 'currency' ? '0' : '0'}
                        />
                      ) : col.type === 'date' ? (
                        <Input
                          type="date"
                          value={String(newRowData[col.id] || '')}
                          onChange={(e) => setNewRowData(prev => ({ ...prev, [col.id]: e.target.value }))}
                          className="h-9 text-sm bg-background"
                        />
                      ) : col.type === 'boolean' ? (
                        <Select
                          value={String(newRowData[col.id] || '')}
                          onValueChange={(v) => setNewRowData(prev => ({ ...prev, [col.id]: v }))}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sí">Sí</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          value={String(newRowData[col.id] || '')}
                          onChange={(e) => setNewRowData(prev => ({ ...prev, [col.id]: e.target.value }))}
                          className="h-9 text-sm bg-background"
                          placeholder={`Ingresar ${col.name.toLowerCase()}`}
                        />
                      )}
                    </div>
                  ))}
                  
                  {/* Show formula columns with calculated values */}
                  {displayColumns.filter(col => col.type === 'formula').map((col) => {
                    const calculatedValue = calculateFormula(newRowData, col)
                    return (
                      <div key={col.id} className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          {col.name}
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">Fórmula</span>
                        </label>
                        <div className="h-9 px-3 flex items-center bg-muted/50 rounded-md border border-dashed border-border text-sm font-medium text-foreground">
                          {calculatedValue !== null 
                            ? (col.formula?.operation === 'percentage' 
                                ? `${calculatedValue.toFixed(1)}%` 
                                : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(calculatedValue))
                            : '-'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={addNewRow}
                    disabled={addingRow}
                    className="h-9"
                  >
                    {addingRow ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowAddRow(false); setNewRowData({}) }}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return <div>Tipo de gráfico no soportado</div>
    }
  }

  return (
    <div className="w-full">
      {/* Header with manual refresh + Realtime indicator */}
      <div className="flex items-center justify-end gap-2 mb-1.5">
        {isRealtimeUpdating && (
          <span className="text-xs text-primary flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Actualizando...
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadDataRef.current()}
          className="h-7 px-2 text-xs flex items-center gap-1"
          disabled={loading}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </Button>
      </div>

      {renderChart()}

      <AlertDialog open={columnToDelete !== null} onOpenChange={(open) => { if (!open) setColumnToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar columna?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar la columna <strong>&quot;{columnToDelete?.name}&quot;</strong>. Esta acción quitará la columna de la tabla y dejará de mostrar sus datos en todas las filas. Podrás deshacer esta acción con el botón &quot;Deshacer&quot; si te equivocaste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingColumn}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteColumn() }}
              disabled={deletingColumn}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingColumn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar columna'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
