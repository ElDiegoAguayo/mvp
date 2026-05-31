'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  BarChart3,
  Search,
  User,
  ArrowUp,
  ArrowDown,
  Filter,
  Globe,
  TableIcon,
  LineChart,
  PieChart,
  AreaChart,
  Eye,
} from 'lucide-react'
import { logAudit } from '@/lib/audit-log'
import { ChartPreview } from './chart-preview'

// Chart types available
const CHART_TYPES = [
  { value: 'bar', label: 'Barras', icon: BarChart3, description: 'Comparar valores entre categorías' },
  { value: 'line', label: 'Líneas', icon: LineChart, description: 'Mostrar tendencias en el tiempo' },
  { value: 'area', label: 'Área', icon: AreaChart, description: 'Tendencias con volumen' },
  { value: 'pie', label: 'Circular', icon: PieChart, description: 'Distribución porcentual' },
  { value: 'donut', label: 'Dona', icon: PieChart, description: 'Distribución con espacio central' },
  { value: 'map', label: 'Mapa de países', icon: Globe, description: 'Datos geográficos por país' },
  { value: 'data_table', label: 'Tabla de datos', icon: TableIcon, description: 'Vista tabular tipo Excel' },
] as const

type ChartType = (typeof CHART_TYPES)[number]['value']

interface Column {
  id: string
  name: string
  type: string
  isFilter?: boolean
}

interface DynamicTable {
  id: string
  module_id: string
  user_id: string | null
  name: string
  columns: Column[]
  module?: { name: string }
  profile?: { full_name: string; email: string }
}

interface DynamicChart {
  id: string
  module_id: string
  table_id: string
  user_id: string | null
  name: string
  chart_type: ChartType
  config: {
    x_column?: string
    y_column?: string
    country_column?: string
    value_column?: string
    label_column?: string
    visible_columns?: string[]
    colors?: string[]
  }
  filters_config: Array<{ column_id: string; column_name: string }>
  display_order: number
  created_at: string
  table?: DynamicTable
  module?: { name: string }
  profile?: { full_name: string; email: string }
}

interface Module {
  id: string
  name: string
  slug: string
}

interface Profile {
  id: string
  full_name: string | null
  email: string
}

export function ChartsManager() {
  const supabase = useMemo(() => createClient(), [])
  const [charts, setCharts] = useState<DynamicChart[]>([])
  const [tables, setTables] = useState<DynamicTable[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [clients, setClients] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModuleId, setFilterModuleId] = useState<string>('all')
  const [filterClientId, setFilterClientId] = useState<string>('all')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedChart, setSelectedChart] = useState<DynamicChart | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formChartType, setFormChartType] = useState<ChartType>('bar')
  const [formTableId, setFormTableId] = useState('')
  const [formModuleId, setFormModuleId] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formXColumn, setFormXColumn] = useState('')
  const [formYColumn, setFormYColumn] = useState('')
  const [formCountryColumn, setFormCountryColumn] = useState('')
  const [formValueColumn, setFormValueColumn] = useState('')
  const [formLabelColumn, setFormLabelColumn] = useState('')
  const [formVisibleColumns, setFormVisibleColumns] = useState<string[]>([])
  const [formFilters, setFormFilters] = useState<string[]>([])
  const [formAllowAddRows, setFormAllowAddRows] = useState(false)
  const [formAllowAddColumns, setFormAllowAddColumns] = useState(false)
  const [formDisplayOrder, setFormDisplayOrder] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Get selected table columns
  const selectedTable = useMemo(() => {
    return tables.find((t) => t.id === formTableId)
  }, [tables, formTableId])

  const tableColumns = useMemo(() => {
    return selectedTable?.columns || []
  }, [selectedTable])

  // Filter columns by type for filters (only columns marked as isFilter)
  const filterableColumns = useMemo(() => {
    return tableColumns.filter((c) => c.isFilter)
  }, [tableColumns])

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    
    const [chartsRes, tablesRes, modulesRes, clientsRes] = await Promise.all([
      supabase
        .from('dynamic_charts')
        .select(`
          *,
          table:dynamic_tables(id, name, columns, module_id, user_id),
          module:modules(name),
          profile:profiles!dynamic_charts_user_id_fkey(full_name, email)
        `)
        .order('display_order', { ascending: true }),
      supabase
        .from('dynamic_tables')
        .select('*, module:modules(name), profile:profiles!dynamic_tables_user_id_fkey(full_name, email)')
        .order('name'),
      supabase
        .from('modules')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('role', 'admin')
        .eq('is_tech_inspector', false)
        .order('full_name'),
    ])

    if (chartsRes.data) setCharts(chartsRes.data as DynamicChart[])
    if (tablesRes.data) setTables(tablesRes.data as DynamicTable[])
    if (modulesRes.data) setModules(modulesRes.data)
    if (clientsRes.data) setClients(clientsRes.data)
    
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter charts
  const filteredCharts = useMemo(() => {
    return charts.filter((chart) => {
      const matchesSearch = chart.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesModule = filterModuleId === 'all' || chart.module_id === filterModuleId
      const matchesClient = filterClientId === 'all' || chart.user_id === filterClientId
      return matchesSearch && matchesModule && matchesClient
    })
  }, [charts, searchTerm, filterModuleId, filterClientId])

  // Filter tables by selected module and client
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesModule = !formModuleId || t.module_id === formModuleId
      const matchesClient = !formClientId || t.user_id === formClientId
      return matchesModule && matchesClient
    })
  }, [tables, formModuleId, formClientId])

  // Build config object
  const buildConfig = () => {
    const config: DynamicChart['config'] = {}
    
    if (formChartType === 'map') {
      config.country_column = formCountryColumn
      config.value_column = formValueColumn
    } else if (formChartType === 'data_table') {
      config.visible_columns = formVisibleColumns
      config.allowAddRows = formAllowAddRows
      config.allowAddColumns = formAllowAddColumns
    } else if (formChartType === 'pie' || formChartType === 'donut') {
      config.label_column = formLabelColumn
      config.value_column = formValueColumn
    } else {
      config.x_column = formXColumn
      config.y_column = formYColumn
    }
    
    return config
  }

  // Build filters config
  const buildFiltersConfig = () => {
    return formFilters.map((colId) => {
      const col = tableColumns.find((c) => c.id === colId)
      return { column_id: colId, column_name: col?.name || '' }
    })
  }

  // Create chart
  const handleCreate = async () => {
    if (!formName.trim() || !formTableId || !formModuleId || !formClientId) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    setIsSaving(true)
    
    // Get max display_order for this module/client
    const { data: existingCharts } = await supabase
      .from('dynamic_charts')
      .select('display_order')
      .eq('module_id', formModuleId)
      .eq('user_id', formClientId)
      .order('display_order', { ascending: false })
      .limit(1)
    
    const newOrder = existingCharts && existingCharts.length > 0 
      ? (existingCharts[0].display_order || 0) + 1 
      : 0

    const { data, error } = await supabase
      .from('dynamic_charts')
      .insert({
        name: formName.trim(),
        chart_type: formChartType,
        table_id: formTableId,
        module_id: formModuleId,
        user_id: formClientId,
        config: buildConfig(),
        filters_config: buildFiltersConfig(),
        display_order: newOrder,
      })
      .select()
      .single()

    if (error) {
      toast.error('Error al crear gráfico: ' + error.message)
    } else {
      toast.success('Gráfico creado exitosamente')
      await logAudit(supabase, {
        action_type: 'CREATE_CHART',
        target_type: 'dynamic_chart',
        target_id: data.id,
        target_label: formName,
        description: `Creó el gráfico "${formName}".`,
      })
      setCreateDialogOpen(false)
      resetForm()
      loadData()
    }
    setIsSaving(false)
  }

  // Update chart
  const handleUpdate = async () => {
    if (!selectedChart || !formName.trim() || !formTableId || !formModuleId || !formClientId) return

    setIsSaving(true)
    const { error } = await supabase
      .from('dynamic_charts')
      .update({
        name: formName.trim(),
        chart_type: formChartType,
        table_id: formTableId,
        module_id: formModuleId,
        user_id: formClientId,
        config: buildConfig(),
        filters_config: buildFiltersConfig(),
        display_order: formDisplayOrder,
      })
      .eq('id', selectedChart.id)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
    } else {
      toast.success('Gráfico actualizado')
      await logAudit(supabase, {
        action_type: 'UPDATE_CHART',
        target_type: 'dynamic_chart',
        target_id: selectedChart.id,
        target_label: formName,
        description: `Actualizó el gráfico "${formName}".`,
      })
      setEditDialogOpen(false)
      loadData()
    }
    setIsSaving(false)
  }

  // Delete chart
  const handleDelete = async () => {
    if (!selectedChart) return

    setIsSaving(true)
    const { error } = await supabase
      .from('dynamic_charts')
      .delete()
      .eq('id', selectedChart.id)

    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Gráfico eliminado')
      await logAudit(supabase, {
        action_type: 'DELETE_CHART',
        target_type: 'dynamic_chart',
        target_id: selectedChart.id,
        target_label: selectedChart.name,
        description: `Eliminó el gráfico "${selectedChart.name}".`,
      })
      setDeleteDialogOpen(false)
      setSelectedChart(null)
      loadData()
    }
    setIsSaving(false)
  }

  // Move chart order
  const moveChart = async (chart: DynamicChart, direction: 'up' | 'down') => {
    const sameGroupCharts = charts
      .filter((c) => c.module_id === chart.module_id && c.user_id === chart.user_id)
      .sort((a, b) => a.display_order - b.display_order)
    
    const currentIndex = sameGroupCharts.findIndex((c) => c.id === chart.id)
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    if (swapIndex < 0 || swapIndex >= sameGroupCharts.length) return
    
    const swapChart = sameGroupCharts[swapIndex]
    
    await Promise.all([
      supabase.from('dynamic_charts').update({ display_order: swapChart.display_order }).eq('id', chart.id),
      supabase.from('dynamic_charts').update({ display_order: chart.display_order }).eq('id', swapChart.id),
    ])
    
    loadData()
  }

  // Dialog openers
  const openEditDialog = (chart: DynamicChart) => {
    setSelectedChart(chart)
    setFormName(chart.name)
    setFormChartType(chart.chart_type)
    setFormTableId(chart.table_id)
    setFormModuleId(chart.module_id)
    setFormClientId(chart.user_id || '')
    setFormXColumn(chart.config.x_column || '')
    setFormYColumn(chart.config.y_column || '')
    setFormCountryColumn(chart.config.country_column || '')
    setFormValueColumn(chart.config.value_column || '')
    setFormLabelColumn(chart.config.label_column || '')
    setFormVisibleColumns(chart.config.visible_columns || [])
    setFormAllowAddRows(Boolean((chart.config as Record<string, unknown>).allowAddRows))
    setFormAllowAddColumns(Boolean((chart.config as Record<string, unknown>).allowAddColumns))
    setFormFilters(chart.filters_config?.map((f) => f.column_id) || [])
    setFormDisplayOrder(chart.display_order)
    setEditDialogOpen(true)
  }

  const openPreviewDialog = (chart: DynamicChart) => {
    setSelectedChart(chart)
    setPreviewDialogOpen(true)
  }

  const openDeleteDialog = (chart: DynamicChart) => {
    setSelectedChart(chart)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormChartType('bar')
    setFormTableId('')
    setFormModuleId('')
    setFormClientId('')
    setFormXColumn('')
    setFormYColumn('')
    setFormCountryColumn('')
    setFormValueColumn('')
    setFormLabelColumn('')
    setFormVisibleColumns([])
    setFormFilters([])
    setFormAllowAddRows(false)
    setFormAllowAddColumns(false)
    setFormDisplayOrder(0)
    setSelectedChart(null)
  }

  // Get chart type info
  const getChartTypeInfo = (type: ChartType) => {
    return CHART_TYPES.find((t) => t.value === type)
  }

  // Get client name
  const getClientName = (chart: DynamicChart) => {
    if (chart.profile) {
      return chart.profile.full_name || chart.profile.email
    }
    return 'Sin asignar'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Gráficos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea visualizaciones de datos para cada cliente
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Gráfico
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gráficos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterModuleId} onValueChange={setFilterModuleId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los módulos</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClientId} onValueChange={setFilterClientId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name || c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Charts list */}
      {filteredCharts.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay gráficos creados</p>
          <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Crear primer gráfico
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Filtros</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCharts.map((chart) => {
                const typeInfo = getChartTypeInfo(chart.chart_type)
                const TypeIcon = typeInfo?.icon || BarChart3
                return (
                  <TableRow key={chart.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveChart(chart, 'up')}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <span className="text-xs text-center text-muted-foreground">
                          {chart.display_order + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveChart(chart, 'down')}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{chart.name}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{typeInfo?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {chart.table?.name || 'Sin tabla'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{getClientName(chart)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {chart.filters_config && chart.filters_config.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <Filter className="w-3 h-3 text-primary" />
                          <span className="text-xs text-muted-foreground">
                            {chart.filters_config.length}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPreviewDialog(chart)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Vista previa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(chart)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(chart)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false)
          setEditDialogOpen(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? 'Editar Gráfico' : 'Nuevo Gráfico'}</DialogTitle>
            <DialogDescription>
              Configura el gráfico seleccionando la tabla de datos y el tipo de visualización
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del gráfico *</Label>
                <Input
                  placeholder="Ej: Exportaciones por país"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de gráfico *</Label>
                <Select value={formChartType} onValueChange={(v) => setFormChartType(v as ChartType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" />
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Module and Client */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Módulo *</Label>
                <Select value={formModuleId} onValueChange={(v) => {
                  setFormModuleId(v)
                  setFormTableId('')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente asignado *</Label>
                <Select value={formClientId} onValueChange={(v) => {
                  setFormClientId(v)
                  setFormTableId('')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name || c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table selection */}
            <div className="space-y-2">
              <Label>Tabla de datos *</Label>
              <Select value={formTableId} onValueChange={setFormTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tabla de datos" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.columns?.length || 0} columnas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formModuleId && formClientId && filteredTables.length === 0 && (
                <p className="text-xs text-amber-600">
                  No hay tablas para este módulo y cliente. Crea una primero en la pestaña Datos.
                </p>
              )}
            </div>

            {/* Column configuration based on chart type */}
            {formTableId && tableColumns.length > 0 && (
              <div className="space-y-4 p-4 bg-secondary/30 rounded-lg">
                <h4 className="font-medium text-sm">Configuración de columnas</h4>
                
                {/* Standard charts (bar, line, area) */}
                {['bar', 'line', 'area'].includes(formChartType) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Eje X (Categoría)</Label>
                      <Select value={formXColumn} onValueChange={setFormXColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Eje Y (Valor)</Label>
                      <Select value={formYColumn} onValueChange={setFormYColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.filter((c) => c.type === 'number' || c.type === 'currency').map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Pie/Donut charts */}
                {['pie', 'donut'].includes(formChartType) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Etiqueta</Label>
                      <Select value={formLabelColumn} onValueChange={setFormLabelColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Select value={formValueColumn} onValueChange={setFormValueColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.filter((c) => c.type === 'number' || c.type === 'currency').map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Map chart */}
                {formChartType === 'map' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Columna de país</Label>
                      <Select value={formCountryColumn} onValueChange={setFormCountryColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.filter((c) => c.type === 'country' || c.type === 'text').map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor a mostrar</Label>
                      <Select value={formValueColumn} onValueChange={setFormValueColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {tableColumns.filter((c) => c.type === 'number' || c.type === 'currency').map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Data table */}
                {formChartType === 'data_table' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Columnas visibles</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {tableColumns.map((c) => (
                          <div key={c.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`col-${c.id}`}
                              checked={formVisibleColumns.includes(c.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormVisibleColumns([...formVisibleColumns, c.id])
                                } else {
                                  setFormVisibleColumns(formVisibleColumns.filter((id) => id !== c.id))
                                }
                              }}
                            />
                            <Label htmlFor={`col-${c.id}`} className="text-sm font-normal">
                              {c.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Permisos del cliente */}
                    <div className="space-y-2 pt-3 border-t">
                      <Label className="text-sm">Permisos del cliente sobre esta tabla</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Define qué puede hacer el cliente desde la vista del módulo.
                      </p>
                      <div className="flex flex-col gap-2 p-3 rounded-md bg-secondary/30 border">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="allow-add-rows"
                            checked={formAllowAddRows}
                            onCheckedChange={(checked) => setFormAllowAddRows(!!checked)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="allow-add-rows" className="text-sm font-normal cursor-pointer">
                              Permitir agregar filas
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              El cliente podrá insertar nuevas filas directamente en la tabla.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="allow-add-columns"
                            checked={formAllowAddColumns}
                            onCheckedChange={(checked) => setFormAllowAddColumns(!!checked)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="allow-add-columns" className="text-sm font-normal cursor-pointer">
                              Permitir agregar columnas
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              El cliente podrá crear nuevas columnas (texto, número, fecha, lista, etc.) en la tabla.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                {filterableColumns.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Filtros para el cliente
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Selecciona qué columnas el cliente podrá usar para filtrar los datos
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {filterableColumns.map((c) => (
                        <div key={c.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-${c.id}`}
                            checked={formFilters.includes(c.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormFilters([...formFilters, c.id])
                              } else {
                                setFormFilters(formFilters.filter((id) => id !== c.id))
                              }
                            }}
                          />
                          <Label htmlFor={`filter-${c.id}`} className="text-sm font-normal">
                            {c.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false)
              setEditDialogOpen(false)
              resetForm()
            }}>
              Cancelar
            </Button>
            <Button onClick={editDialogOpen ? handleUpdate : handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editDialogOpen ? 'Guardar' : 'Crear gráfico'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa: {selectedChart?.name}</DialogTitle>
          </DialogHeader>
          {selectedChart && (
            <ChartPreview
              chartType={selectedChart.chart_type}
              config={selectedChart.config}
              tableId={selectedChart.table_id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gráfico</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el gráfico &ldquo;{selectedChart?.name}&rdquo;.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
