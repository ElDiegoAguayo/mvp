'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Plus,
  Loader2,
  Database,
  Search,
  FileSpreadsheet,
  ArrowLeft,
  BarChart3,
  Pencil,
  Trash2,
  MoreHorizontal,
  Columns,
  ChevronRight,
  Users,
  FolderOpen,
  ArrowUp,
  Upload,
  Palette,
  ArrowDown,
  LineChart,
  AreaChart,
  PieChart,
  Globe2,
  Table2,
  Check,
  Filter,
  Eye,
  ShieldCheck,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logAudit } from '@/lib/audit-log'
import Link from 'next/link'
import { ChartPreview } from './chart-preview'
import { ExcelImporter, ColumnDef } from './excel-importer'
import { getModuleIcon, getIconShape, resolveIconContainerStyle, resolveIconStyle, resolveTextStyle } from '@/lib/module-icons'
import { cn } from '@/lib/utils'
import { InventoryManager } from '@/components/admin/inventory-manager'

// Preset options for select columns
const PRESET_OPTIONS = [
  { label: 'Sí / No', options: ['Sí', 'No'] },
  { label: 'Reservado / Disponible', options: ['Reservado', 'Disponible'] },
  { label: 'Pagado / No Pagado', options: ['Pagado', 'No Pagado'] },
  { label: 'Activo / Inactivo', options: ['Activo', 'Inactivo'] },
  { label: 'Pendiente / Completado', options: ['Pendiente', 'Completado'] },
  { label: 'Aprobado / Rechazado', options: ['Aprobado', 'Rechazado'] },
] as const

// Default chart colors
const CHART_COLORS = [
  '#4A6CF7', // Primary blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
]

// Column types supported
const COLUMN_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda (CLP)' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'country', label: 'País' },
  { value: 'countdown', label: 'Cuenta regresiva (días)' },
  { value: 'linked', label: 'Vinculada a otra tabla' },
  { value: 'formula', label: 'Fórmula (calculado)' },
] as const

// Predefined colors for select options
const OPTION_COLORS = [
  { value: '#10b981', label: 'Verde' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#f59e0b', label: 'Amarillo' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#8b5cf6', label: 'Morado' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#6b7280', label: 'Gris' },
]

// Formula operations
const FORMULA_OPERATIONS = [
  { value: 'add', label: 'Suma (+)', symbol: '+' },
  { value: 'subtract', label: 'Resta (-)', symbol: '-' },
  { value: 'multiply', label: 'Multiplicación (×)', symbol: '×' },
  { value: 'divide', label: 'División (÷)', symbol: '÷' },
  { value: 'percentage', label: 'Porcentaje (%)', symbol: '%' },
] as const

const CHART_TYPES = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'pie', label: 'Torta' },
  { value: 'donut', label: 'Dona' },
  { value: 'map', label: 'Mapa de países' },
  { value: 'data_table', label: 'Tabla de datos' },
] as const

type ColumnType = (typeof COLUMN_TYPES)[number]['value']
type ChartType = (typeof CHART_TYPES)[number]['value']

interface Column {
  id: string
  name: string
  type: ColumnType
  options?: string[]
  optionColors?: Record<string, string>
  required?: boolean
  isFilter?: boolean
  clientEditable?: boolean
  countdownDays?: number
  // Linked column - references another table
  linkedTableId?: string
  linkedColumnId?: string
  // Formula fields
  formula?: {
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage'
    column1: string
    column2: string
  }
}

interface DynamicTable {
  id: string
  module_id: string
  user_id: string | null
  name: string
  description: string | null
  columns: Column[]
  created_at: string
}

interface DynamicChart {
  id: string
  module_id: string
  table_id: string
  user_id: string | null
  name: string
  chart_type: ChartType
  config: {
    xAxis?: string | string[]
    yAxis?: string | string[]
    groupBy?: string
    columns?: string[]
    editableColumns?: string[]  // Columns client can edit in data_table
    colors?: string[]  // Custom colors for chart
  }
  display_order: number
  filters_config: string[]
  created_at: string
  table?: { id: string; name: string; columns: Column[] }
}

interface ClientProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  parent_user_id?: string | null
}

interface Module {
  id: string
  name: string
  slug: string
  icon: string
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
}

type ViewLevel = 'clients' | 'modules' | 'module-detail'

interface ClientDataManagerProps {
  initialClientId?: string
  initialModuleId?: string
}

export function ClientDataManager({ initialClientId, initialModuleId }: ClientDataManagerProps) {
  const supabase = createClient()
  
  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('clients')
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null)
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [initialNavDone, setInitialNavDone] = useState(false)
  
  // Data state
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [clientModules, setClientModules] = useState<Module[]>([])
  const [moduleTables, setModuleTables] = useState<DynamicTable[]>([])
  const [allClientTables, setAllClientTables] = useState<DynamicTable[]>([])
  const [moduleCharts, setModuleCharts] = useState<DynamicChart[]>([])
  const [subusers, setSubusers] = useState<ClientProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAdmins, setShowAdmins] = useState(false)
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [loadingModules, setLoadingModules] = useState(false)
  const [loadingModuleData, setLoadingModuleData] = useState(false)
  
  // Dialog states
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false)
  const [showCreateChartDialog, setShowCreateChartDialog] = useState(false)
  const [showEditChartDialog, setShowEditChartDialog] = useState(false)
  const [showExcelImporter, setShowExcelImporter] = useState(false)
  const [editingChart, setEditingChart] = useState<DynamicChart | null>(null)
  const [showColumnsDialog, setShowColumnsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Form states
  const [newTableName, setNewTableName] = useState('')
  const [newTableDescription, setNewTableDescription] = useState('')
  const [newTableColumns, setNewTableColumns] = useState<Column[]>([])
  
  const [newChartName, setNewChartName] = useState('')
  const [newChartType, setNewChartType] = useState<ChartType>('bar')
  const [newChartTableId, setNewChartTableId] = useState('')
  const [newChartXAxis, setNewChartXAxis] = useState<string[]>([])  // Multiple X columns
  const [newChartYAxis, setNewChartYAxis] = useState<string[]>([])  // Multiple Y columns
  const [newChartFilters, setNewChartFilters] = useState<string[]>([])
  const [newChartColumns, setNewChartColumns] = useState<string[]>([])
  const [newChartEditableColumns, setNewChartEditableColumns] = useState<string[]>([])
  const [newChartAllowAddRows, setNewChartAllowAddRows] = useState(false)
  const [newChartAllowAddColumns, setNewChartAllowAddColumns] = useState(false)
  const [newChartAllowEditColumns, setNewChartAllowEditColumns] = useState(false)
  const [newChartAllowDeleteColumns, setNewChartAllowDeleteColumns] = useState(false)
  const [newChartColors, setNewChartColors] = useState<string[]>([CHART_COLORS[0]])
  
  const [editingTable, setEditingTable] = useState<DynamicTable | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'table' | 'chart'; item: DynamicTable | DynamicChart } | null>(null)
  
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load clients on mount and when showAdmins changes
  useEffect(() => {
    loadClients()
  }, [showAdmins])

  // Handle initial navigation from URL params
  useEffect(() => {
    if (!initialNavDone && clients.length > 0 && initialClientId) {
      const client = clients.find(c => c.id === initialClientId)
      if (client) {
        // Navigate to client
        handleInitialNavigation(client)
      }
      setInitialNavDone(true)
    }
  }, [clients, initialClientId, initialNavDone])

  const handleInitialNavigation = async (client: ClientProfile) => {
    setSelectedClient(client)
    setLoadingModules(true)
    setViewLevel('modules')

    const { data: accessData } = await supabase
      .from('user_module_access')
      .select('module_id, enabled, module:modules(id, name, slug, icon, color, text_color, icon_shape)')
      .eq('user_id', client.id)
      .eq('enabled', true)

    const modules = (accessData || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => a.module !== null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => a.module as Module)
    
    setClientModules(modules)
    setLoadingModules(false)

    // If there's a moduleId in URL, navigate to it
    if (initialModuleId) {
      const mod = modules.find(m => m.id === initialModuleId)
      if (mod) {
        setSelectedModule(mod)
        setViewLevel('module-detail')
        loadModuleData(mod.id, client.id)
      }
    }

    // Clear URL params after navigation
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/admin?tab=clientes')
    }
    // Load subusers for this client
    loadSubusers(client.id)
  }

  const loadClients = async () => {
    setLoading(true)
    const q = supabase
      .from('profiles')
      .select('id, email, full_name, role, parent_user_id')
      .order('full_name', { ascending: true })

    // When listing clients (not admins) only show primary clients (no parent)
    const query = showAdmins ? q.eq('role', 'admin') : q.eq('role', 'user').is('parent_user_id', null)
    const { data, error } = await query

    if (error) {
      toast.error('Error al cargar usuarios')
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  // Load modules for selected client
  const loadClientModules = async (client: ClientProfile) => {
    setLoadingModules(true)
    setSelectedClient(client)
    setViewLevel('modules')

    // Modules activation is per-user. Do NOT use parent's id here so that
    // subusers only see modules explicitly enabled for them.
    const dataUserId = client.id
    const { data: accessData } = await supabase
      .from('user_module_access')
      .select('module_id, enabled, module:modules(id, name, slug, icon, color, text_color, icon_shape)')
      .eq('user_id', dataUserId)
      .eq('enabled', true)

    const modules = (accessData || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => a.module !== null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => a.module as Module)
    
    setClientModules(modules)
    setLoadingModules(false)
    // Load subusers for this client (children of the primary client)
    loadSubusers(client.id)
  }

  const loadSubusers = async (clientId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, parent_user_id')
        .eq('parent_user_id', clientId)
        .order('full_name', { ascending: true })

      setSubusers((data || []) as ClientProfile[])
    } catch (err) {
      console.error('Error loading subusers', err)
      setSubusers([])
    }
  }

  // Load tables and charts for selected module
  const loadModuleData = async (moduleOrId: Module | string, clientId?: string) => {
    // Prefer explicit clientId when provided. Otherwise, if selectedClient is a subuser,
    // use its parent id so the subuser inherits the parent's data and settings.
    let cId = clientId
    if (!cId && selectedClient) {
      cId = selectedClient.parent_user_id ?? selectedClient.id
    }
    if (!cId) return
    
    const moduleId = typeof moduleOrId === 'string' ? moduleOrId : moduleOrId.id
    
    setLoadingModuleData(true)
    if (typeof moduleOrId !== 'string') {
      setSelectedModule(moduleOrId)
    }
    setViewLevel('module-detail')

    // Load tables for this client + module
    const { data: tablesData } = await supabase
      .from('dynamic_tables')
      .select('*')
      .eq('user_id', cId)
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false })

    setModuleTables(tablesData || [])

    // Load ALL client tables (across all modules) for linked columns
    const { data: allTablesData } = await supabase
      .from('dynamic_tables')
      .select('*')
      .eq('user_id', cId)
      .order('name', { ascending: true })
    
    setAllClientTables(allTablesData || [])

    // Load charts for this client + module
    const { data: chartsData } = await supabase
      .from('dynamic_charts')
      .select('*, table:dynamic_tables(id, name, columns)')
      .eq('user_id', cId)
      .eq('module_id', moduleId)
      .order('display_order', { ascending: true })

    setModuleCharts(chartsData || [])
    setLoadingModuleData(false)
  }

  // Navigation
  const goBackToClients = async () => {
    // If current selectedClient is a subuser, go back to its parent client
    if (selectedClient?.parent_user_id) {
      try {
        const parentId = selectedClient.parent_user_id
        const { data: parent, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, parent_user_id')
          .eq('id', parentId)
          .single()

        if (!error && parent) {
          // load modules for parent (this will set viewLevel to 'modules')
          await loadClientModules(parent as ClientProfile)
          return
        }
      } catch (err) {
        console.error('Error loading parent profile', err)
      }
    }

    // Default: go back to clients list
    setSelectedClient(null)
    setSelectedModule(null)
    setClientModules([])
    setModuleTables([])
    setModuleCharts([])
    setViewLevel('clients')
  }

  const goBackToModules = () => {
    setSelectedModule(null)
    setModuleTables([])
    setModuleCharts([])
    setViewLevel('modules')
  }

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients
    const term = searchTerm.toLowerCase()
    return clients.filter(
      c => c.full_name?.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
    )
  }, [clients, searchTerm])

  // Get columns from selected table for chart
  const selectedTableForChart = useMemo(() => {
    return moduleTables.find(t => t.id === newChartTableId)
  }, [moduleTables, newChartTableId])

  // Create table (auto-assigned to current client + module)
  const handleCreateTable = async () => {
    if (!newTableName || !selectedClient || !selectedModule) return
    if (newTableColumns.length === 0) {
      toast.error('Agrega al menos una columna')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('dynamic_tables')
      .insert({
        name: newTableName,
        description: newTableDescription || null,
        module_id: selectedModule.id,
        user_id: selectedClient.id,
        columns: newTableColumns,
      })

    if (error) {
      toast.error('Error al crear tabla')
    } else {
      toast.success('Tabla creada')
      await logAudit(supabase, {
        action_type: 'CREATE_DYNAMIC_TABLE',
        target_type: 'dynamic_table',
        target_id: selectedClient.id,
        target_label: newTableName,
        description: `Tabla ${newTableName} creada para ${selectedClient.full_name || selectedClient.email}`,
      })
      loadModuleData(selectedModule)
      resetTableForm()
      setShowCreateTableDialog(false)
    }
    setSaving(false)
  }

  // Import from Excel - creates table with columns and rows
  const handleExcelImport = async (columns: ColumnDef[], rows: Record<string, unknown>[]) => {
    if (!selectedClient || !selectedModule) return
    
    setSaving(true)
    try {
      // Create table with imported columns
      const tableName = `Importación ${new Date().toLocaleDateString('es-CL')}`
      const { data: tableData, error: tableError } = await supabase
        .from('dynamic_tables')
        .insert({
          name: tableName,
          description: `Importado desde Excel - ${rows.length} filas`,
          module_id: selectedModule.id,
          user_id: selectedClient.id,
          columns: columns,
        })
        .select()
        .single()

      if (tableError) throw tableError

      // Insert rows in batches of 100
      const batchSize = 100
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((rowData, index) => ({
          table_id: tableData.id,
          data: rowData,
          row_order: i + index,
        }))
        
        const { error: rowError } = await supabase
          .from('dynamic_table_rows')
          .insert(batch)
        
        if (rowError) throw rowError
      }

      toast.success(`Tabla importada con ${columns.length} columnas y ${rows.length} filas`)
      await logAudit(supabase, {
        action_type: 'IMPORT_EXCEL',
        target_type: 'dynamic_table',
        target_id: selectedClient.id,
        target_label: tableName,
        description: `Tabla importada desde Excel para ${selectedClient.full_name || selectedClient.email}`,
      })
      loadModuleData(selectedModule)
    } catch (error) {
      console.error('Error importing:', error)
      toast.error('Error al importar datos')
    } finally {
      setSaving(false)
    }
  }

  // Create chart (auto-assigned to current client + module)
  const handleCreateChart = async () => {
    if (!newChartName || !newChartTableId || !selectedClient || !selectedModule) return

    setSaving(true)
    
    const config: DynamicChart['config'] = {
      colors: newChartColors,
    }
    if (newChartType === 'data_table') {
      config.columns = newChartColumns
      config.editableColumns = newChartEditableColumns
      config.allowAddRows = newChartAllowAddRows
      config.allowAddColumns = newChartAllowAddColumns
      config.allowEditColumns = newChartAllowEditColumns
      config.allowDeleteColumns = newChartAllowDeleteColumns
      // Support multiple columns in X and Y axes
      config.xAxis = newChartXAxis.length === 1 ? newChartXAxis[0] : newChartXAxis
      config.yAxis = newChartYAxis.length === 1 ? newChartYAxis[0] : newChartYAxis
    } else {
      // Use xAxis / yAxis for consistency with ChartPreview
      config.xAxis = newChartXAxis.length === 1 ? newChartXAxis[0] : newChartXAxis
      config.yAxis = newChartYAxis.length === 1 ? newChartYAxis[0] : newChartYAxis
      config.groupBy = newChartXAxis[0] || '' // keep for maps / backward compat
    }

    const maxOrder = moduleCharts.length > 0 
      ? Math.max(...moduleCharts.map(c => c.display_order)) 
      : 0

    const { error } = await supabase
      .from('dynamic_charts')
      .insert({
        name: newChartName,
        chart_type: newChartType,
        table_id: newChartTableId,
        module_id: selectedModule.id,
        user_id: selectedClient.id,
        config,
        filters_config: newChartFilters,
        display_order: maxOrder + 1,
      })

    if (error) {
      toast.error('Error al crear gráfico')
    } else {
      toast.success('Gráfico creado')
      await logAudit(supabase, {
        action_type: 'CREATE_CHART',
        target_type: 'dynamic_chart',
        target_id: selectedClient.id,
        target_label: newChartName,
        description: `Gráfico ${newChartName} creado para ${selectedClient.full_name || selectedClient.email}`,
      })
      loadModuleData(selectedModule)
      resetChartForm()
      setShowCreateChartDialog(false)
    }
    setSaving(false)
  }

  // Update table columns
  const handleUpdateColumns = async () => {
    if (!editingTable || !selectedModule) return

    setSaving(true)
    const { error } = await supabase
      .from('dynamic_tables')
      .update({ columns: newTableColumns })
      .eq('id', editingTable.id)

    if (error) {
      toast.error('Error al actualizar columnas')
    } else {
      toast.success('Columnas actualizadas')
      loadModuleData(selectedModule)
      setShowColumnsDialog(false)
      setEditingTable(null)
    }
    setSaving(false)
  }

  // Delete table or chart
  const handleDelete = async () => {
    if (!deleteTarget || !selectedModule) return

    setDeleting(true)
    
    try {
      // If deleting a table, first delete associated charts and rows
      if (deleteTarget.type === 'table') {
        // Delete associated charts first
        await supabase
          .from('dynamic_charts')
          .delete()
          .eq('table_id', deleteTarget.item.id)
        
        // Delete associated rows
        await supabase
          .from('dynamic_table_rows')
          .delete()
          .eq('table_id', deleteTarget.item.id)
      }
      
      const tableName = deleteTarget.type === 'table' ? 'dynamic_tables' : 'dynamic_charts'
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', deleteTarget.item.id)

      if (error) {
        console.error('Delete error:', error)
        toast.error(`Error al eliminar: ${error.message}`)
      } else {
        toast.success(`${deleteTarget.type === 'table' ? 'Tabla' : 'Gráfico'} eliminado`)
        await logAudit(supabase, {
          action_type: deleteTarget.type === 'table' ? 'DELETE_DYNAMIC_TABLE' : 'DELETE_CHART',
          target_type: deleteTarget.type === 'table' ? 'dynamic_table' : 'dynamic_chart',
          target_id: deleteTarget.item.id,
          target_label: deleteTarget.item.name,
          description: `${deleteTarget.item.name} eliminado`,
        })
        loadModuleData(selectedModule)
      }
    } catch (err) {
      console.error('Delete exception:', err)
      toast.error('Error inesperado al eliminar')
    }
    
    setDeleting(false)
    setDeleteTarget(null)
    setShowDeleteDialog(false)
  }

  // Reorder charts
  const moveChart = async (chartId: string, direction: 'up' | 'down') => {
    if (!selectedModule) return
    
    const currentIndex = moduleCharts.findIndex(c => c.id === chartId)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= moduleCharts.length) return
    
    const currentChart = moduleCharts[currentIndex]
    const targetChart = moduleCharts[targetIndex]
    
    // Swap display_order
    await supabase
      .from('dynamic_charts')
      .update({ display_order: targetChart.display_order })
      .eq('id', currentChart.id)
    
    await supabase
      .from('dynamic_charts')
      .update({ display_order: currentChart.display_order })
      .eq('id', targetChart.id)
    
    loadModuleData(selectedModule)
  }

  // Reset forms
  const resetTableForm = () => {
    setNewTableName('')
    setNewTableDescription('')
    setNewTableColumns([])
  }

  const resetChartForm = () => {
    setNewChartName('')
    setNewChartType('bar')
    setNewChartTableId('')
    setNewChartXAxis([])
    setNewChartYAxis([])
    setNewChartFilters([])
    setNewChartColumns([])
    setNewChartEditableColumns([])
    setNewChartAllowAddRows(false)
    setNewChartAllowAddColumns(false)
    setNewChartAllowEditColumns(false)
    setNewChartAllowDeleteColumns(false)
    setNewChartColors([CHART_COLORS[0]])
  }

  // Column helpers
  const addColumn = () => {
    setNewTableColumns([
      ...newTableColumns,
      { id: crypto.randomUUID(), name: '', type: 'text', required: false, isFilter: false },
    ])
  }

  const updateColumn = (index: number, updates: Partial<Column>) => {
    setNewTableColumns(cols => cols.map((col, i) => (i === index ? { ...col, ...updates } : col)))
  }

  const removeColumn = (index: number) => {
    setNewTableColumns(cols => cols.filter((_, i) => i !== index))
  }

  // Open dialogs
  const openCreateTableDialog = () => {
    resetTableForm()
    setShowCreateTableDialog(true)
  }

  const openCreateChartDialog = () => {
    resetChartForm()
    setShowCreateChartDialog(true)
  }

  const openEditChartDialog = (chart: DynamicChart) => {
    setEditingChart(chart)
    setNewChartName(chart.name)
    setNewChartType(chart.chart_type)
    setNewChartTableId(chart.table_id)
    // Handle both array and string formats
    const xAxis = chart.config?.xAxis || chart.config?.groupBy
    const yAxis = chart.config?.yAxis
    setNewChartXAxis(Array.isArray(xAxis) ? xAxis : xAxis ? [xAxis] : [])
    setNewChartYAxis(Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : [])
    setNewChartFilters(chart.filters_config || [])
    setNewChartColumns(chart.config?.columns || [])
    setNewChartEditableColumns(chart.config?.editableColumns || [])
    setNewChartAllowAddRows(Boolean((chart.config as Record<string, unknown> | undefined)?.allowAddRows))
    setNewChartAllowAddColumns(Boolean((chart.config as Record<string, unknown> | undefined)?.allowAddColumns))
    setNewChartAllowEditColumns(Boolean((chart.config as Record<string, unknown> | undefined)?.allowEditColumns))
    setNewChartAllowDeleteColumns(Boolean((chart.config as Record<string, unknown> | undefined)?.allowDeleteColumns))
    setNewChartColors(chart.config?.colors || [CHART_COLORS[0]])
    setShowEditChartDialog(true)
  }

  const handleUpdateChart = async () => {
    if (!editingChart || !newChartName || !newChartTableId) return
    setSaving(true)
    try {
      const config: Record<string, unknown> = {
        colors: newChartColors,
      }
      if (newChartType === 'data_table') {
        config.columns = newChartColumns
        config.editableColumns = newChartEditableColumns
        config.allowAddRows = newChartAllowAddRows
        config.allowAddColumns = newChartAllowAddColumns
        config.allowEditColumns = newChartAllowEditColumns
        config.allowDeleteColumns = newChartAllowDeleteColumns
        config.xAxis = newChartXAxis.length === 1 ? newChartXAxis[0] : newChartXAxis
        config.yAxis = newChartYAxis.length === 1 ? newChartYAxis[0] : newChartYAxis
        config.groupBy = newChartXAxis[0] || ''
      } else {
        // Regular charts (bar, line, pie, etc.)
        config.xAxis = newChartXAxis.length === 1 ? newChartXAxis[0] : newChartXAxis
        config.yAxis = newChartYAxis.length === 1 ? newChartYAxis[0] : newChartYAxis
        config.groupBy = newChartXAxis[0] || ''
      }
      
      const { error } = await supabase
        .from('dynamic_charts')
        .update({
          name: newChartName,
          chart_type: newChartType,
          table_id: newChartTableId,
          config,
          filters_config: newChartFilters,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingChart.id)
      
      if (error) throw error
      
      toast.success('Gráfico actualizado')
      
      // Reload module data
      if (selectedClient && selectedModule) {
        await loadModuleData(selectedModule.id, selectedClient.id)
      }
      setShowEditChartDialog(false)
      setEditingChart(null)
      resetChartForm()
    } catch (error) {
      console.error('Error updating chart:', error)
      toast.error('Error al actualizar gráfico')
    } finally {
      setSaving(false)
    }
  }

  const openColumnsDialog = (table: DynamicTable) => {
    setEditingTable(table)
    setNewTableColumns([...table.columns])
    setShowColumnsDialog(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  // =====================
  // VIEW: Clients List
  // =====================
  if (viewLevel === 'clients') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {showAdmins ? 'Administradores (Pruebas)' : 'Gestión por Cliente'}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {showAdmins 
                ? 'Selecciona un administrador para crear datos de prueba'
                : 'Selecciona un cliente para gestionar sus datos y gráficos'}
            </p>
          </div>

          {/* Toggle Admins/Clientes */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border">
            <button
              onClick={() => setShowAdmins(false)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !showAdmins 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Clientes
            </button>
            <button
              onClick={() => setShowAdmins(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showAdmins 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Administradores
            </button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={showAdmins ? "Buscar administrador..." : "Buscar cliente..."}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map(client => (
            <button
              key={client.id}
              onClick={() => loadClientModules(client)}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
            >
              <div className={`w-12 h-12 rounded-full ${showAdmins ? 'bg-amber-500/10 border-amber-500/20' : 'bg-primary/10 border-primary/20'} border flex items-center justify-center shrink-0`}>
                <span className={`text-lg font-semibold ${showAdmins ? 'text-amber-500' : 'text-primary'}`}>
                  {(client.full_name || client.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {client.full_name || 'Sin nombre'}
                </p>
                <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                {showAdmins && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-600">
                    Admin
                  </span>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {showAdmins ? 'No se encontraron administradores' : 'No se encontraron clientes'}
            </div>
          )}
        </div>
      </div>
    )
  }

  // =====================
  // VIEW: Client Modules
  // =====================
  if (viewLevel === 'modules' && selectedClient) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBackToClients}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedClient.full_name || selectedClient.email}
            </h1>
            <p className="text-muted-foreground">Selecciona un módulo para ver sus datos</p>
          </div>
        </div>

        {/* Subusers list */}
        {subusers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {subusers.map(s => (
              <button
                key={s.id}
                onClick={() => loadClientModules(s)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border text-sm hover:bg-accent/50"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">{(s.full_name || s.email || 'U')[0]?.toUpperCase()}</div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-medium text-foreground truncate">{s.full_name || 'Sin nombre'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {loadingModules ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : clientModules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Este cliente no tiene módulos asignados</p>
            <p className="text-sm">Asigna módulos en la pestaña Usuarios</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientModules.map(module => {
              const Icon = getModuleIcon(module.icon)
              const shapeCfg = getIconShape(module.icon_shape)
              const iconContainer = resolveIconContainerStyle(module.color, shapeCfg.className)
              const iconStyle = resolveIconStyle(module.color)
              const textStyle = resolveTextStyle(module.text_color ?? null, module.color)
              return (
                <button
                  key={module.id}
                  onClick={() => loadModuleData(module)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-all text-left group"
                >
                  <div
                    className={cn('w-12 h-12 border-2 flex items-center justify-center shrink-0', iconContainer.className)}
                    style={iconContainer.style}
                  >
                    <Icon className={cn('w-6 h-6', iconStyle.className)} style={iconStyle.style} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold', textStyle.className)} style={textStyle.style}>{module.name}</p>
                    <p className="text-sm text-muted-foreground">/{module.slug}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // =====================
  // VIEW: Module Detail (Tables + Charts)
  // =====================
  if (viewLevel === 'module-detail' && selectedClient && selectedModule) {
    const ModuleIcon = getModuleIcon(selectedModule.icon)
    const isInventoryModule = selectedModule.slug.toLowerCase().includes('inventario')
    
    return (
      <div className="space-y-6">
        {/* Header with breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={goBackToClients} className="hover:text-foreground transition-colors">
            Clientes
          </button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={goBackToModules} className="hover:text-foreground transition-colors">
            {selectedClient.full_name || selectedClient.email}
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{selectedModule.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={goBackToModules}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ModuleIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{selectedModule.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedClient.full_name || selectedClient.email}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowExcelImporter(true)} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Importar Excel
            </Button>
            <Button onClick={openCreateTableDialog} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tabla
            </Button>
            <Button onClick={openCreateChartDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Gráfico
            </Button>
          </div>
        </div>

        {loadingModuleData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {isInventoryModule && (
              <InventoryManager clientId={selectedClient.id} />
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Tables Section */}
              <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Tablas de Datos ({moduleTables.length})</h2>
              </div>
              
              {moduleTables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No hay tablas creadas</p>
                  <Button variant="link" onClick={openCreateTableDialog} className="mt-2">
                    Crear primera tabla
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {moduleTables.map(table => (
                    <div
                      key={table.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{table.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {table.columns.length} columnas
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tabla/${table.id}`}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar datos
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openColumnsDialog(table)}>
                            <Columns className="w-4 h-4 mr-2" />
                            Editar columnas
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteTarget({ type: 'table', item: table })
                              setShowDeleteDialog(true)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
              </div>

              {/* Charts Section */}
              <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Gráficos ({moduleCharts.length})</h2>
              </div>
              
              {moduleCharts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No hay gráficos creados</p>
                  {moduleTables.length > 0 ? (
                    <Button variant="link" onClick={openCreateChartDialog} className="mt-2">
                      Crear primer gráfico
                    </Button>
                  ) : (
                    <p className="text-sm mt-2">Crea una tabla primero</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {moduleCharts.map((chart, index) => (
                    <div
                      key={chart.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => moveChart(chart.id, 'up')}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === moduleCharts.length - 1}
                            onClick={() => moveChart(chart.id, 'down')}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{chart.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {CHART_TYPES.find(t => t.value === chart.chart_type)?.label}
                            {chart.table && ` • ${chart.table.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditChartDialog(chart)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteTarget({ type: 'chart', item: chart })
                            setShowDeleteDialog(true)
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* Create Table Dialog */}
        <Dialog open={showCreateTableDialog} onOpenChange={setShowCreateTableDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Tabla de Datos</DialogTitle>
              <DialogDescription>
                Para {selectedClient.full_name || selectedClient.email} en {selectedModule.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la tabla</Label>
                  <Input
                    value={newTableName}
                    onChange={e => setNewTableName(e.target.value)}
                    placeholder="Ej: Ventas 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción (opcional)</Label>
                  <Input
                    value={newTableDescription}
                    onChange={e => setNewTableDescription(e.target.value)}
                    placeholder="Descripción breve"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Columnas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar columna
                  </Button>
                </div>
                
                {newTableColumns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Agrega columnas para definir la estructura
                  </p>
                ) : (
                  <div className="space-y-3">
                    {newTableColumns.map((col, index) => (
                      <div key={col.id} className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 grid gap-2 sm:grid-cols-3">
                            <Input
                              placeholder="Nombre"
                              value={col.name}
                              onChange={e => updateColumn(index, { name: e.target.value })}
                            />
                            <Select
                              value={col.type}
                              onValueChange={v => updateColumn(index, { 
                                type: v as ColumnType, 
                                formula: v === 'formula' ? { operation: 'add', column1: '', column2: '' } : undefined,
                                countdownDays: v === 'countdown' ? 30 : undefined,
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COLUMN_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={col.isFilter}
                                  onCheckedChange={v => updateColumn(index, { isFilter: !!v })}
                                />
                                Es filtro
                              </label>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeColumn(index)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Formula configuration */}
                        {col.type === 'formula' && (
                          <div className="pl-2 pt-2 border-t border-border/50 space-y-2">
                            <p className="text-xs text-muted-foreground font-medium">Configurar fórmula:</p>
                            {newTableColumns.filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency')).length < 2 ? (
                              <p className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                                Necesitas al menos 2 columnas numéricas o de moneda para crear una fórmula. Agrega las columnas primero.
                              </p>
                            ) : (
                              <>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <Select
                                    value={col.formula?.column1 || ''}
                                    onValueChange={v => updateColumn(index, { formula: { ...col.formula!, column1: v } })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Columna 1" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {newTableColumns
                                        .filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency'))
                                        .map(c => (
                                          <SelectItem key={c.id} value={c.id}>{c.name || 'Sin nombre'}</SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={col.formula?.operation || 'add'}
                                    onValueChange={v => updateColumn(index, { formula: { ...col.formula!, operation: v as 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage' } })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FORMULA_OPERATIONS.map(op => (
                                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={col.formula?.column2 || ''}
                                    onValueChange={v => updateColumn(index, { formula: { ...col.formula!, column2: v } })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue placeholder="Columna 2" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {newTableColumns
                                        .filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency'))
                                        .map(c => (
                                          <SelectItem key={c.id} value={c.id}>{c.name || 'Sin nombre'}</SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2 px-2 py-1 bg-secondary/50 rounded text-xs">
                                  <span className="text-muted-foreground">Vista previa:</span>
                                  <span className="font-medium text-foreground">
                                    {col.formula?.column1 && col.formula?.column2 
                                      ? `${newTableColumns.find(c => c.id === col.formula?.column1)?.name || '?'} ${FORMULA_OPERATIONS.find(op => op.value === col.formula?.operation)?.symbol || '+'} ${newTableColumns.find(c => c.id === col.formula?.column2)?.name || '?'}`
                                      : 'Selecciona las columnas'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Select options with colors */}
                        {col.type === 'select' && (
                          <div className="pl-2 pt-2 border-t border-border/50 space-y-2">
                            <Input
                              placeholder="Opciones separadas por coma (ej: Opción 1, Opción 2)"
                              value={col.options?.join(', ') || ''}
                              onChange={e => updateColumn(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              className="text-sm"
                            />
                            {col.options && col.options.length > 0 && (
                              <div className="space-y-1.5 p-2 rounded-md bg-muted/30 border border-border">
                                <p className="text-xs text-muted-foreground mb-2">Asigna un color a cada opción:</p>
                                {col.options.map((opt) => (
                                  <div key={opt} className="flex items-center gap-2">
                                    <span className="text-xs flex-1 truncate">{opt}</span>
                                    <div className="flex gap-1">
                                      {OPTION_COLORS.map((color) => (
                                        <button
                                          key={color.value}
                                          type="button"
                                          onClick={() =>
                                            updateColumn(index, {
                                              optionColors: { ...(col.optionColors || {}), [opt]: color.value },
                                            })
                                          }
                                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                                            col.optionColors?.[opt] === color.value
                                              ? 'border-foreground scale-110'
                                              : 'border-transparent hover:scale-105'
                                          }`}
                                          style={{ backgroundColor: color.value }}
                                          title={color.label}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Countdown days */}
                        {col.type === 'countdown' && (
                          <div className="pl-2 pt-2 border-t border-border/50 space-y-1.5">
                            <Input
                              type="number"
                              min={1}
                              placeholder="Días iniciales (ej: 30)"
                              value={col.countdownDays || ''}
                              onChange={e => updateColumn(index, { countdownDays: Number.parseInt(e.target.value) || 0 })}
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Los días se descontarán automáticamente cada día desde la creación del registro.
                            </p>
                          </div>
                        )}

                        {/* Linked column from another table */}
                        {col.type === 'linked' && (
                          <div className="pl-2 pt-2 border-t border-border/50 space-y-2">
                            <p className="text-xs text-muted-foreground">Vincula esta columna a otra tabla del cliente:</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Select
                                value={col.linkedTableId || ''}
                                onValueChange={v => updateColumn(index, { linkedTableId: v, linkedColumnId: '' })}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Tabla origen" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allClientTables.length === 0 ? (
                                    <div className="p-2 text-xs text-muted-foreground">No hay otras tablas</div>
                                  ) : (
                                    allClientTables.map(t => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <Select
                                value={col.linkedColumnId || ''}
                                onValueChange={v => updateColumn(index, { linkedColumnId: v })}
                                disabled={!col.linkedTableId}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Columna" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(allClientTables.find(t => t.id === col.linkedTableId)?.columns as Column[] | undefined)?.map(lc => (
                                    <SelectItem key={lc.id} value={lc.id}>{lc.name}</SelectItem>
                                  )) || null}
                                </SelectContent>
                              </Select>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Se mostrarán los valores actualizados de la tabla origen automáticamente.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateTableDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTable} disabled={saving || !newTableName || newTableColumns.length === 0}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear Tabla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Chart Dialog */}
        <Dialog open={showCreateChartDialog} onOpenChange={setShowCreateChartDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Gráfico</DialogTitle>
              <DialogDescription>
                Para {selectedClient.full_name || selectedClient.email} en {selectedModule.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre del gráfico</Label>
                  <Input
                    value={newChartName}
                    onChange={e => setNewChartName(e.target.value)}
                    placeholder="Ej: Ventas por mes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de gráfico</Label>
                  <Select value={newChartType} onValueChange={v => setNewChartType(v as ChartType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tabla de datos</Label>
                <Select value={newChartTableId} onValueChange={setNewChartTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una tabla" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleTables.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTableForChart && newChartType === 'data_table' && (
                <div className="space-y-2">
                  <Label>Columnas a mostrar</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTableForChart.columns.map(col => (
                      <label key={col.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30">
                        <Checkbox
                          checked={newChartColumns.includes(col.id)}
                          onCheckedChange={checked => {
                            setNewChartColumns(
                              checked
                                ? [...newChartColumns, col.id]
                                : newChartColumns.filter(c => c !== col.id)
                            )
                          }}
                        />
                        <span className="text-sm">{col.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedTableForChart && newChartType !== 'data_table' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{newChartType === 'map' ? 'Columna de país' : 'Eje X (categorías) - Selecciona una o más'}</Label>
                    <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                      {selectedTableForChart.columns.map(col => (
                        <label key={col.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          newChartXAxis.includes(col.id) 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border bg-card hover:bg-accent'
                        }`}>
                          <Checkbox
                            checked={newChartXAxis.includes(col.id)}
                            onCheckedChange={checked => {
                              setNewChartXAxis(
                                checked
                                  ? [...newChartXAxis, col.id]
                                  : newChartXAxis.filter(c => c !== col.id)
                              )
                            }}
                          />
                          <span className="text-sm">{col.name}</span>
                        </label>
                      ))}
                    </div>
                    {newChartXAxis.length > 0 && (
                      <p className="text-xs text-muted-foreground">{newChartXAxis.length} columna(s) seleccionada(s)</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Eje Y - Selecciona una o más columnas</Label>
                    <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                      {selectedTableForChart.columns
                        .map(col => (
                          <label key={col.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            newChartYAxis.includes(col.id) 
                              ? 'border-primary bg-primary/10 text-primary' 
                              : 'border-border bg-card hover:bg-accent'
                          }`}>
                            <Checkbox
                              checked={newChartYAxis.includes(col.id)}
                              onCheckedChange={checked => {
                                setNewChartYAxis(
                                  checked
                                    ? [...newChartYAxis, col.id]
                                    : newChartYAxis.filter(c => c !== col.id)
                                )
                              }}
                            />
                            <span className="text-sm">{col.name}</span>
                            <span className="text-xs text-muted-foreground">({col.type})</span>
                          </label>
                        ))}
                    </div>
                    {newChartYAxis.length > 0 && (
                      <p className="text-xs text-muted-foreground">{newChartYAxis.length} columna(s) seleccionada(s)</p>
                    )}
                  </div>
                </div>
              )}

              {selectedTableForChart && (
                <div className="space-y-2">
                  <Label>Filtros disponibles para el cliente</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTableForChart.columns
                      .filter(col => col.isFilter)
                      .map(col => (
                        <label key={col.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30">
                          <Checkbox
                            checked={newChartFilters.includes(col.id)}
                            onCheckedChange={checked => {
                              setNewChartFilters(
                                checked
                                  ? [...newChartFilters, col.id]
                                  : newChartFilters.filter(f => f !== col.id)
                              )
                            }}
                          />
                          <span className="text-sm">{col.name}</span>
                        </label>
                      ))}
                    {selectedTableForChart.columns.filter(col => col.isFilter).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No hay columnas marcadas como filtro en la tabla
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Editable columns for data_table */}
              {selectedTableForChart && newChartType === 'data_table' && (
                <div className="space-y-2">
                  <Label>Columnas editables por el cliente</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    El cliente podrá modificar estas columnas desde su dashboard
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTableForChart.columns
                      .filter(col => col.type === 'select' || col.type === 'boolean' || col.type === 'country')
                      .map(col => (
                        <label key={col.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          newChartEditableColumns.includes(col.id) 
                            ? 'border-amber-500 bg-amber-500/10 text-amber-600' 
                            : 'border-border bg-card hover:bg-accent'
                        }`}>
                          <Checkbox
                            checked={newChartEditableColumns.includes(col.id)}
                            onCheckedChange={checked => {
                              setNewChartEditableColumns(
                                checked
                                  ? [...newChartEditableColumns, col.id]
                                  : newChartEditableColumns.filter(c => c !== col.id)
                              )
                            }}
                          />
                          <span className="text-sm">{col.name}</span>
                          {col.type === 'country' && (
                            <span className="text-xs text-muted-foreground">(País)</span>
                          )}
                          {col.options && (
                            <span className="text-xs text-muted-foreground">({col.options.join('/')})</span>
                          )}
                        </label>
                      ))}
                    {selectedTableForChart.columns.filter(col => col.type === 'select' || col.type === 'boolean' || col.type === 'country').length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No hay columnas editables en la tabla
                      </p>
                    )}
                  </div>

                  {/* Permisos del cliente */}
                  <div className="space-y-2 pt-4 border-t mt-4">
                    <Label className="text-sm">Permisos del cliente sobre esta tabla</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Define qué puede hacer el cliente desde la vista del módulo.
                    </p>
                    <div className="flex flex-col gap-3 p-3 rounded-md bg-secondary/30 border">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="new-allow-add-rows"
                          checked={newChartAllowAddRows}
                          onCheckedChange={(checked) => setNewChartAllowAddRows(!!checked)}
                        />
                        <div className="flex-1">
                          <Label htmlFor="new-allow-add-rows" className="text-sm font-normal cursor-pointer">
                            Permitir agregar filas
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            El cliente podrá insertar nuevas filas directamente en la tabla.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="new-allow-add-columns"
                          checked={newChartAllowAddColumns}
                          onCheckedChange={(checked) => setNewChartAllowAddColumns(!!checked)}
                        />
                        <div className="flex-1">
                          <Label htmlFor="new-allow-add-columns" className="text-sm font-normal cursor-pointer">
                            Permitir agregar columnas
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            El cliente podrá crear nuevas columnas (texto, número, fecha, lista, etc.) en la tabla.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="new-allow-edit-columns"
                          checked={newChartAllowEditColumns}
                          onCheckedChange={(checked) => setNewChartAllowEditColumns(!!checked)}
                        />
                        <div className="flex-1">
                          <Label htmlFor="new-allow-edit-columns" className="text-sm font-normal cursor-pointer">
                            Permitir editar columnas existentes
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            El cliente podrá renombrar columnas y modificar las opciones de listas. No podrá eliminarlas ni cambiar el tipo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="new-allow-delete-columns"
                          checked={newChartAllowDeleteColumns}
                          onCheckedChange={(checked) => setNewChartAllowDeleteColumns(!!checked)}
                        />
                        <div className="flex-1">
                          <Label htmlFor="new-allow-delete-columns" className="text-sm font-normal cursor-pointer">
                            Permitir eliminar columnas
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            El cliente podrá eliminar columnas existentes. Se le pedirá confirmación antes de borrar.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart colors */}
              {newChartType !== 'data_table' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Colores del gráfico
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {CHART_COLORS.map((color, i) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          const yCount = newChartYAxis.length || 1
                          if (yCount === 1) {
                            setNewChartColors([color])
                          } else {
                            const newColors = [...newChartColors]
                            if (!newColors.includes(color)) {
                              if (newColors.length < yCount) {
                                newColors.push(color)
                              } else {
                                newColors[newColors.length - 1] = color
                              }
                              setNewChartColors(newColors)
                            }
                          }
                        }}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          newChartColors.includes(color) 
                            ? 'border-foreground scale-110' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {newChartYAxis.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newChartYAxis.map((yCol, i) => {
                        const col = selectedTableForChart?.columns.find(c => c.id === yCol)
                        return (
                          <div key={yCol} className="flex items-center gap-2 text-sm">
                            <div 
                              className="w-4 h-4 rounded" 
                              style={{ backgroundColor: newChartColors[i] || CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span>{col?.name || yCol}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateChartDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateChart} disabled={saving || !newChartName || !newChartTableId}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear Gráfico
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Chart Dialog */}
        <Dialog open={showEditChartDialog} onOpenChange={(open) => {
          setShowEditChartDialog(open)
          if (!open) {
            setEditingChart(null)
            resetChartForm()
          }
        }}>
          <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

            {/* ── Header ── */}
            <div className="relative flex-shrink-0 px-7 pt-6 pb-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">Editar Gráfico</DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm">{editingChart?.name}</DialogDescription>
                </div>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-7 py-6 space-y-6">

                {/* ── Bloque 1: Info básica ── */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre del gráfico</p>
                    <Input
                      value={newChartName}
                      onChange={e => setNewChartName(e.target.value)}
                      placeholder="Ej: Exportaciones 2024"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tabla de datos</p>
                    <Select value={newChartTableId} onValueChange={setNewChartTableId}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Selecciona una tabla" />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleTables.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              <Database className="w-3.5 h-3.5 text-muted-foreground" />
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── Bloque 2: Tipo de gráfico ── */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de visualización</p>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {([
                      { value: 'bar',        label: 'Barras',   Icon: BarChart3   },
                      { value: 'line',       label: 'Líneas',   Icon: LineChart   },
                      { value: 'area',       label: 'Área',     Icon: AreaChart   },
                      { value: 'pie',        label: 'Torta',    Icon: PieChart    },
                      { value: 'donut',      label: 'Dona',     Icon: PieChart    },
                      { value: 'map',        label: 'Mapa',     Icon: Globe2      },
                      { value: 'data_table', label: 'Tabla',    Icon: Table2      },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNewChartType(value as ChartType)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                          newChartType === value
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Bloque 3: Columnas a mostrar (data_table) ── */}
                {selectedTableForChart && newChartType === 'data_table' && (
                  <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-secondary/40 border-b border-border">
                      <Eye className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Columnas a mostrar</p>
                        <p className="text-xs text-muted-foreground">{newChartColumns.length} de {selectedTableForChart.columns.length} seleccionadas</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = selectedTableForChart.columns.map(c => c.id)
                          setNewChartColumns(newChartColumns.length === allIds.length ? [] : allIds)
                        }}
                        className="ml-auto text-xs text-primary hover:underline font-medium"
                      >
                        {newChartColumns.length === selectedTableForChart.columns.length ? 'Deselect. todas' : 'Select. todas'}
                      </button>
                    </div>
                    <div className="px-5 py-4 flex flex-wrap gap-2">
                      {selectedTableForChart.columns.map(col => {
                        const active = newChartColumns.includes(col.id)
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => setNewChartColumns(active ? newChartColumns.filter(c => c !== col.id) : [...newChartColumns, col.id])}
                            className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 flex-shrink-0" />}
                            {col.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Bloque 3b: Ejes X/Y (non-data_table) ── */}
                {selectedTableForChart && newChartType !== 'data_table' && (
                  <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-secondary/40 border-b border-border">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">Ejes del gráfico</p>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          {newChartType === 'map' ? 'Columna de país' : 'Eje X — categorías'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTableForChart.columns.map(col => {
                            const active = newChartXAxis.includes(col.id)
                            return (
                              <button key={col.id} type="button"
                                onClick={() => setNewChartXAxis(active ? newChartXAxis.filter(c => c !== col.id) : [...newChartXAxis, col.id])}
                                className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                  active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                }`}
                              >
                                {active && <Check className="w-3 h-3 flex-shrink-0" />}
                                {col.name}
                              </button>
                            )
                          })}
                        </div>
                        {newChartXAxis.length > 0 && <p className="text-xs text-muted-foreground mt-2">{newChartXAxis.length} seleccionada(s)</p>}
                      </div>
                      <div className="pt-3 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Eje Y — valores</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTableForChart.columns.map(col => {
                            const active = newChartYAxis.includes(col.id)
                            return (
                              <button key={col.id} type="button"
                                onClick={() => setNewChartYAxis(active ? newChartYAxis.filter(c => c !== col.id) : [...newChartYAxis, col.id])}
                                className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                  active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                }`}
                              >
                                {active && <Check className="w-3 h-3 flex-shrink-0" />}
                                {col.name}
                                <span className="text-[10px] opacity-60">({col.type})</span>
                              </button>
                            )
                          })}
                        </div>
                        {newChartYAxis.length > 0 && <p className="text-xs text-muted-foreground mt-2">{newChartYAxis.length} seleccionada(s)</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Bloque 4: Filtros ── */}
                {selectedTableForChart && (
                  <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-secondary/40 border-b border-border">
                      <Filter className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Filtros para el cliente</p>
                        <p className="text-xs text-muted-foreground">El cliente podrá filtrar los datos usando estas columnas</p>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      {selectedTableForChart.columns.filter(col => col.isFilter).length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Ninguna columna está marcada como filtro en esta tabla.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedTableForChart.columns.filter(col => col.isFilter).map(col => {
                            const active = newChartFilters.includes(col.id)
                            return (
                              <button key={col.id} type="button"
                                onClick={() => setNewChartFilters(active ? newChartFilters.filter(f => f !== col.id) : [...newChartFilters, col.id])}
                                className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                  active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                }`}
                              >
                                {active && <Check className="w-3 h-3 flex-shrink-0" />}
                                {col.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Bloque 5: Columnas editables + Permisos (data_table) ── */}
                {selectedTableForChart && newChartType === 'data_table' && (
                  <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                    {/* Editables */}
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-amber-500/5 border-b border-border">
                      <Pencil className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold">Columnas editables por el cliente</p>
                        <p className="text-xs text-muted-foreground">El cliente podrá modificar estas columnas desde su dashboard</p>
                      </div>
                    </div>
                    <div className="px-5 py-4 border-b border-border/60">
                      {selectedTableForChart.columns.filter(col => col.type === 'select' || col.type === 'boolean' || col.type === 'country').length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No hay columnas editables disponibles en esta tabla.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedTableForChart.columns
                            .filter(col => col.type === 'select' || col.type === 'boolean' || col.type === 'country')
                            .map(col => {
                              const active = newChartEditableColumns.includes(col.id)
                              return (
                                <button key={col.id} type="button"
                                  onClick={() => setNewChartEditableColumns(active ? newChartEditableColumns.filter(c => c !== col.id) : [...newChartEditableColumns, col.id])}
                                  className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                    active ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-background border-border text-muted-foreground hover:border-amber-400/60 hover:text-foreground'
                                  }`}
                                >
                                  {active && <Check className="w-3 h-3 flex-shrink-0" />}
                                  {col.name}
                                  {col.type === 'country' && <span className="text-[10px] opacity-70 ml-0.5">(País)</span>}
                                  {col.options && <span className="text-[10px] opacity-70 ml-0.5 truncate max-w-[80px]">({col.options.slice(0,2).join('/')}…)</span>}
                                </button>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {/* Permisos */}
                    <div className="px-5 py-4 bg-muted/10">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permisos sobre la tabla</p>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {[
                          { id: 'edit-allow-add-rows',     checked: newChartAllowAddRows,     setter: setNewChartAllowAddRows,     label: 'Agregar filas',     desc: 'Insertar nuevas filas en la tabla' },
                          { id: 'edit-allow-add-columns',  checked: newChartAllowAddColumns,  setter: setNewChartAllowAddColumns,  label: 'Agregar columnas',  desc: 'Crear nuevas columnas' },
                          { id: 'edit-allow-edit-columns', checked: newChartAllowEditColumns, setter: setNewChartAllowEditColumns, label: 'Editar columnas',    desc: 'Renombrar y modificar opciones' },
                          { id: 'edit-allow-delete-columns',checked: newChartAllowDeleteColumns,setter: setNewChartAllowDeleteColumns,label: 'Eliminar columnas',desc: 'Borrar columnas con confirmación' },
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => item.setter(!item.checked)}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                              item.checked
                                ? 'border-primary bg-primary/8 shadow-sm'
                                : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/30'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              item.checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                            }`}>
                              {item.checked && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold leading-tight ${item.checked ? 'text-primary' : 'text-foreground'}`}>{item.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Bloque 6: Colores ── */}
                {newChartType !== 'data_table' && (
                  <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-secondary/40 border-b border-border">
                      <Palette className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">Colores del gráfico</p>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex flex-wrap gap-2.5">
                        {CHART_COLORS.map((color) => {
                          const selected = newChartColors.includes(color)
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                const yCount = newChartYAxis.length || 1
                                if (yCount === 1) {
                                  setNewChartColors([color])
                                } else {
                                  const newColors = [...newChartColors]
                                  if (!newColors.includes(color)) {
                                    if (newColors.length < yCount) newColors.push(color)
                                    else newColors[newColors.length - 1] = color
                                    setNewChartColors(newColors)
                                  }
                                }
                              }}
                              className={`relative w-9 h-9 rounded-xl transition-all ${
                                selected ? 'ring-2 ring-offset-2 ring-foreground scale-110 shadow-md' : 'hover:scale-105 hover:shadow-sm opacity-80 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {selected && (
                                <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {newChartYAxis.length > 1 && (
                        <div className="flex flex-wrap gap-3 pt-1 border-t border-border/40">
                          {newChartYAxis.map((yCol, i) => {
                            const col = selectedTableForChart?.columns.find(c => c.id === yCol)
                            return (
                              <div key={yCol} className="flex items-center gap-1.5 text-xs">
                                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: newChartColors[i] || CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="text-muted-foreground">{col?.name || yCol}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 px-7 py-4 border-t border-border bg-secondary/20 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {!newChartName && <span className="text-amber-500">Nombre requerido · </span>}
                {!newChartTableId && <span className="text-amber-500">Tabla requerida</span>}
                {newChartName && newChartTableId && <span className="text-emerald-600 font-medium">Listo para guardar</span>}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditChartDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateChart} disabled={saving || !newChartName || !newChartTableId} className="min-w-[140px] gap-1.5">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Columns Dialog */}
        <Dialog open={showColumnsDialog} onOpenChange={setShowColumnsDialog}>
          <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0">
            {/* Fixed header */}
            <div className="px-7 pt-6 pb-5 border-b border-border flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-semibold">Editar Columnas</DialogTitle>
                  <DialogDescription className="mt-1 flex items-center gap-2">
                    <span>{editingTable?.name}</span>
                    {newTableColumns.length > 0 && (
                      <span className="px-2 py-0.5 bg-secondary rounded-full text-xs font-medium text-foreground">
                        {newTableColumns.length} {newTableColumns.length === 1 ? 'columna' : 'columnas'}
                      </span>
                    )}
                  </DialogDescription>
                </div>
                <Button type="button" size="sm" onClick={addColumn} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" />
                  Agregar columna
                </Button>
              </div>
            </div>

            {/* Scrollable columns list */}
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-3 min-h-0">
              {newTableColumns.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                    <Columns className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No hay columnas definidas todavía</p>
                  <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Agregar primera columna
                  </Button>
                </div>
              )}
              {newTableColumns.map((col, index) => (
                <div
                  key={col.id}
                  className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  {/* Main row */}
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <Input
                      placeholder="Nombre de columna"
                      value={col.name}
                      onChange={e => updateColumn(index, { name: e.target.value })}
                      className="flex-1 h-9 text-sm font-medium min-w-0"
                    />
                    <Select
                      value={col.type}
                      onValueChange={v => updateColumn(index, {
                        type: v as ColumnType,
                        options: v === 'select' ? ['Opción 1', 'Opción 2'] : undefined,
                        formula: v === 'formula' ? { operation: 'add', column1: '', column2: '' } : undefined,
                        countdownDays: v === 'countdown' ? 30 : undefined,
                      })}
                    >
                      <SelectTrigger className="w-52 h-9 text-sm flex-shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Toggle: Filtro */}
                    <button
                      type="button"
                      onClick={() => updateColumn(index, { isFilter: !col.isFilter })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${
                        col.isFilter
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-transparent border-border text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${col.isFilter ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                        {col.isFilter && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                      Filtro
                    </button>
                    {/* Toggle: Editable */}
                    <button
                      type="button"
                      onClick={() => updateColumn(index, { clientEditable: !col.clientEditable })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${
                        col.clientEditable
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-600'
                          : 'bg-transparent border-border text-muted-foreground hover:border-amber-400/30'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${col.clientEditable ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground/40'}`}>
                        {col.clientEditable && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                      Editable
                    </button>
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
                      className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Select options section */}
                  {col.type === 'select' && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/20 space-y-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Opciones de lista</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_OPTIONS.map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => updateColumn(index, { options: [...preset.options] })}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                              JSON.stringify(col.options) === JSON.stringify(preset.options)
                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                : 'border-border bg-background hover:border-primary/40 hover:bg-secondary/60 text-foreground'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <Input
                        placeholder="O escribe opciones separadas por coma…"
                        value={col.options?.join(', ') || ''}
                        onChange={e => updateColumn(index, {
                          options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                        })}
                        className="text-sm h-8"
                      />
                      {col.options && col.options.length > 0 && (
                        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Color por opción</p>
                          {col.options.map((opt) => {
                            const assignedColor = col.optionColors?.[opt]
                            return (
                              <div key={opt} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
                                    style={assignedColor ? {
                                      backgroundColor: `${assignedColor}22`,
                                      color: assignedColor,
                                      border: `1px solid ${assignedColor}55`,
                                    } : undefined}
                                  >
                                    {assignedColor && (
                                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: assignedColor }} />
                                    )}
                                    <span className="truncate">{opt}</span>
                                  </span>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  {OPTION_COLORS.map((color) => (
                                    <button
                                      key={color.value}
                                      type="button"
                                      onClick={() =>
                                        updateColumn(index, {
                                          optionColors: { ...(col.optionColors || {}), [opt]: color.value },
                                        })
                                      }
                                      className={`w-5 h-5 rounded-full transition-all ${
                                        col.optionColors?.[opt] === color.value
                                          ? 'ring-2 ring-offset-1 ring-foreground scale-110'
                                          : 'hover:scale-110 opacity-75 hover:opacity-100'
                                      }`}
                                      style={{ backgroundColor: color.value }}
                                      title={color.label}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Countdown section */}
                  {col.type === 'countdown' && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/20">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Días iniciales</p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Ej: 30"
                          value={col.countdownDays || ''}
                          onChange={e => updateColumn(index, { countdownDays: Number.parseInt(e.target.value) || 0 })}
                          className="text-sm h-8 w-28"
                        />
                        <p className="text-xs text-muted-foreground">días contados desde la creación del registro</p>
                      </div>
                    </div>
                  )}

                  {/* Linked column section */}
                  {col.type === 'linked' && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/20 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vinculada a</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select
                          value={col.linkedTableId || ''}
                          onValueChange={v => updateColumn(index, { linkedTableId: v, linkedColumnId: '' })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Tabla origen" />
                          </SelectTrigger>
                          <SelectContent>
                            {allClientTables.length === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground">No hay otras tablas</div>
                            ) : (
                              allClientTables.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={col.linkedColumnId || ''}
                          onValueChange={v => updateColumn(index, { linkedColumnId: v })}
                          disabled={!col.linkedTableId}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Columna" />
                          </SelectTrigger>
                          <SelectContent>
                            {(allClientTables.find(t => t.id === col.linkedTableId)?.columns as Column[] | undefined)?.map(lc => (
                              <SelectItem key={lc.id} value={lc.id}>{lc.name}</SelectItem>
                            )) || null}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">Los valores se actualizan automáticamente.</p>
                    </div>
                  )}

                  {/* Formula section */}
                  {col.type === 'formula' && (
                    <div className="px-5 py-4 border-t border-border/50 bg-muted/20 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fórmula</p>
                      {newTableColumns.filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency')).length < 2 ? (
                        <p className="text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                          Necesitas al menos 2 columnas numéricas o de moneda para crear una fórmula.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Select
                              value={col.formula?.column1 || ''}
                              onValueChange={v => updateColumn(index, { formula: { ...col.formula!, column1: v } })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Columna 1" />
                              </SelectTrigger>
                              <SelectContent>
                                {newTableColumns
                                  .filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency'))
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name || 'Sin nombre'}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={col.formula?.operation || 'add'}
                              onValueChange={v => updateColumn(index, { formula: { ...col.formula!, operation: v as 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage' } })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FORMULA_OPERATIONS.map(op => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={col.formula?.column2 || ''}
                              onValueChange={v => updateColumn(index, { formula: { ...col.formula!, column2: v } })}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Columna 2" />
                              </SelectTrigger>
                              <SelectContent>
                                {newTableColumns
                                  .filter(c => c.id !== col.id && (c.type === 'number' || c.type === 'currency'))
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name || 'Sin nombre'}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 rounded-lg text-xs">
                            <span className="text-muted-foreground">Vista previa:</span>
                            <span className="font-mono font-semibold text-foreground">
                              {col.formula?.column1 && col.formula?.column2
                                ? `${newTableColumns.find(c => c.id === col.formula?.column1)?.name || '?'} ${FORMULA_OPERATIONS.find(op => op.value === col.formula?.operation)?.symbol || '+'} ${newTableColumns.find(c => c.id === col.formula?.column2)?.name || '?'}`
                                : 'Selecciona las columnas'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Fixed footer */}
            <div className="px-7 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {newTableColumns.length} {newTableColumns.length === 1 ? 'columna definida' : 'columnas definidas'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowColumnsDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateColumns} disabled={saving} className="gap-1.5 min-w-[120px]">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Eliminar {deleteTarget?.type === 'table' ? 'tabla' : 'gráfico'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente{' '}
                <strong>{deleteTarget?.item.name}</strong>.
                {deleteTarget?.type === 'table'
                  ? ' También se eliminarán todos los datos y gráficos asociados.'
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Excel Importer */}
        <ExcelImporter
          open={showExcelImporter}
          onOpenChange={setShowExcelImporter}
          onImport={handleExcelImport}
        />
      </div>
    )
  }

  return null
}
