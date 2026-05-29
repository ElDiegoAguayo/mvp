'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Loader2, Filter, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartPreview } from '@/components/admin/chart-preview'
import { DocumentGenerator } from '@/components/dashboard/document-generator'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { InventoryOverview } from '@/components/dashboard/inventory-overview'
import { FILTERABLE_COLUMN_TYPES, type ColumnType } from '@/lib/column-types'

// Dynamic import of ShipTrackerWidget with ssr: false to avoid "window is not defined" errors
const ShipTrackerWidget = dynamic(
  () => import('@/components/dashboard/widgets/ship-tracker-widget').then(mod => mod.ShipTrackerWidget),
  { ssr: false, loading: () => <div className="p-6 bg-card border rounded-xl"><Loader2 className="w-6 h-6 animate-spin" /></div> }
)

interface Column {
  id: string
  name: string
  type: string
  isFilter?: boolean
  options?: string[]
  clientEditable?: boolean
}

interface DynamicTable {
  id: string
  name: string
  description: string | null
  columns: Column[]
}

interface FilterConfig {
  column_id: string
  column_name: string
}

interface DynamicChart {
  id: string
  name: string
  chart_type: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'map' | 'data_table'
  config: {
    x_column?: string
    y_column?: string
    xAxis?: string | string[]
    yAxis?: string | string[]
    groupBy?: string
    columns?: string[]
    country_column?: string
    value_column?: string
    label_column?: string
    visible_columns?: string[]
    editableColumns?: string[]
    allowAddRows?: boolean
    allowAddColumns?: boolean
    allowEditColumns?: boolean
    allowDeleteColumns?: boolean
    colors?: string[]
  }
  filters_config: FilterConfig[]
  display_order: number
  table_id: string
  table?: DynamicTable
}

interface ModuleDataViewProps {
  moduleId: string
  moduleName: string
  moduleSlug?: string
  moduleDescription?: string | null
}

export function ModuleDataView({ moduleId, moduleName, moduleSlug }: ModuleDataViewProps) {
  const supabase = useMemo(() => createClient(), [])
  const [charts, setCharts] = useState<DynamicChart[]>([])
  const [tables, setTables] = useState<DynamicTable[]>([])
  const [tableConfigs, setTableConfigs] = useState<Record<string, DynamicChart['config']>>({})
  const [loading, setLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Per-module preference: which filter column ids are currently enabled in
  // the view. When the set is null we fall back to "all available filters".
  const [enabledFilterIds, setEnabledFilterIds] = useState<Set<string> | null>(null)
  const [chartRefreshKey, setChartRefreshKey] = useState(0)
  const enabledFilterStorageKey = `moduleFilters:${moduleId}`
  const isDocumentModule =
    moduleSlug?.toLowerCase().includes('documento') ||
    moduleName?.toLowerCase().includes('documento')
  const isInventoryModule =
    moduleSlug?.toLowerCase().includes('inventario') ||
    moduleName?.toLowerCase().includes('inventario')

  // Hydrate the enabled-filters preference from localStorage once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(enabledFilterStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed)) setEnabledFilterIds(new Set(parsed))
      }
    } catch {
      // ignore corrupted preference
    }
  }, [enabledFilterStorageKey])

  const persistEnabledFilters = (ids: Set<string> | null) => {
    setEnabledFilterIds(ids)
    if (typeof window === 'undefined') return
    if (ids === null) {
      window.localStorage.removeItem(enabledFilterStorageKey)
    } else {
      window.localStorage.setItem(enabledFilterStorageKey, JSON.stringify(Array.from(ids)))
    }
  }

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      // Get current user
      const { userId, effectiveUserId } = await getEffectiveUserId(supabase)
      if (!userId || !effectiveUserId) {
        setLoading(false)
        return
      }

      const accessUserIds =
        userId === effectiveUserId ? [userId] : [userId, effectiveUserId]

      const [chartAccessRes, tableAccessRes] = await Promise.all([
        supabase
          .from('user_chart_access')
          .select('chart_id')
          .in('user_id', accessUserIds)
          .eq('can_view', true),
        supabase
          .from('user_table_access')
          .select('table_id')
          .in('user_id', accessUserIds)
          .eq('can_view', true),
      ])

      const chartIds = (chartAccessRes.data ?? []).map((row) => row.chart_id)
      const tableIds = (tableAccessRes.data ?? []).map((row) => row.table_id)

      // Load charts assigned to this user for this module (with table data)
      let chartsQuery = supabase
        .from('dynamic_charts')
        .select(`
          id, name, chart_type, config, filters_config, display_order, table_id,
          table:dynamic_tables(id, name, description, columns)
        `)
        .eq('module_id', moduleId)
        .order('display_order', { ascending: true })

      if (chartIds.length > 0) {
        chartsQuery = chartsQuery.or(`user_id.eq.${effectiveUserId},id.in.(${chartIds.join(',')})`)
      } else {
        chartsQuery = chartsQuery.eq('user_id', effectiveUserId)
      }

      const { data: chartsData, error: chartsError } = await chartsQuery

      if (chartsError) {
        console.error('Error loading charts:', chartsError)
      }

      const loadedCharts = (chartsData || []) as unknown as DynamicChart[]
      setCharts(loadedCharts)

      // Load tables for fallback display (when no charts exist)
      let tablesQuery = supabase
        .from('dynamic_tables')
        .select('id, name, description, columns')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true })

      if (tableIds.length > 0) {
        tablesQuery = tablesQuery.or(`user_id.eq.${effectiveUserId},id.in.(${tableIds.join(',')})`)
      } else {
        tablesQuery = tablesQuery.eq('user_id', effectiveUserId)
      }

      const { data: tablesData, error: tablesError } = await tablesQuery

      if (tablesError) {
        console.error('Error loading tables:', tablesError)
      }

      const loadedTables = (tablesData || []) as DynamicTable[]
      setTables(loadedTables)

      if (loadedTables.length > 0) {
        const tableIdsForConfig = loadedTables.map((t) => t.id)
        const { data: configCharts } = await supabase
          .from('dynamic_charts')
          .select('table_id, config')
          .eq('chart_type', 'data_table')
          .eq('user_id', effectiveUserId)
          .in('table_id', tableIdsForConfig)

        const configMap: Record<string, DynamicChart['config']> = {}
        ;(configCharts ?? []).forEach((row) => {
          configMap[row.table_id as string] = (row.config as DynamicChart['config']) || {}
        })
        setTableConfigs(configMap)
      } else {
        setTableConfigs({})
      }

      // Load filter options from table data - ALL non-formula columns become potential filters
      if (loadedCharts.length > 0) {
        const tableIds = [...new Set(loadedCharts.map(c => c.table_id))]
        const allFilterOptions: Record<string, string[]> = {}

        for (const tableId of tableIds) {
          const { data: rowsData } = await supabase
            .from('dynamic_table_rows')
            .select('data')
            .eq('table_id', tableId)

          if (rowsData) {
            // Use all columns of this table that are filterable (not formula/number/currency/date)
            const tableCharts = loadedCharts.filter(c => c.table_id === tableId)
            const tableInfo = tableCharts[0]?.table
            if (!tableInfo) continue

            // Only allow text / date / country / select / boolean as filters
            const filterableColumns = (tableInfo.columns || []).filter(c =>
              FILTERABLE_COLUMN_TYPES.has(c.type as ColumnType)
            )

            // Extract unique values for each filterable column
            filterableColumns.forEach(col => {
              const values = new Set<string>()
              rowsData.forEach(row => {
                const data = row.data as Record<string, unknown>
                const value = data[col.id]
                if (value !== null && value !== undefined && value !== '') {
                  values.add(String(value))
                }
              })
              if (values.size >= 1) {
                allFilterOptions[col.id] = Array.from(values).sort()
              }
            })
          }
        }

        setFilterOptions(allFilterOptions)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }

    setLoading(false)
  }, [supabase, moduleId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime: refresh charts when admin updates them or any underlying table schema changes
  useEffect(() => {
    const channel = supabase
      .channel(`module-data-${moduleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dynamic_charts',
          filter: `module_id=eq.${moduleId}`,
        },
        () => {
          loadData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dynamic_tables',
        },
        () => {
          // Schema changes (columns added/removed) - reload charts to refresh table info
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, moduleId, loadData])

  // Get all available filters from all charts (auto: only text/date/country/select/boolean columns)
  const availableFilters = useMemo(() => {
    const filters: Array<{ column_id: string; column_name: string; table?: DynamicTable }> = []
    const seen = new Set<string>()

    charts.forEach(chart => {
      const tableCols = chart.table?.columns || []
      tableCols.forEach(col => {
        if (!FILTERABLE_COLUMN_TYPES.has(col.type as ColumnType)) return
        if (seen.has(col.id)) return
        // Only show as filter if there are options registered (data exists for that column)
        if (!filterOptions[col.id] || filterOptions[col.id].length === 0) return
        seen.add(col.id)
        filters.push({ column_id: col.id, column_name: col.name, table: chart.table })
      })
      // Also keep any explicit filter configured by admin (even if no data yet)
      chart.filters_config?.forEach(f => {
        if (!seen.has(f.column_id)) {
          seen.add(f.column_id)
          filters.push({ ...f, table: chart.table })
        }
      })
    })

    return filters
  }, [charts, filterOptions])

  // Filters actually rendered to the user. By default = all available filters,
  // but the user can hide some via the "Gestionar filtros" panel.
  const visibleFilters = useMemo(() => {
    if (!enabledFilterIds) return availableFilters
    return availableFilters.filter(f => enabledFilterIds.has(f.column_id))
  }, [availableFilters, enabledFilterIds])

  const isFilterEnabled = (columnId: string) => {
    if (!enabledFilterIds) return true
    return enabledFilterIds.has(columnId)
  }

  const toggleFilterEnabled = (columnId: string, enabled: boolean) => {
    // Materialize from "all" to an explicit Set the first time we toggle
    const base = enabledFilterIds ?? new Set(availableFilters.map(f => f.column_id))
    const next = new Set(base)
    if (enabled) {
      next.add(columnId)
    } else {
      next.delete(columnId)
      // If the user disables a filter, also clear its active value
      setActiveFilters(prev => {
        const updated = { ...prev }
        delete updated[columnId]
        return updated
      })
    }
    persistEnabledFilters(next)
  }

  const enableAllFilters = () => persistEnabledFilters(null)

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).filter(v => v && v !== 'all').length
  }, [activeFilters])

  const visualCharts = useMemo(
    () => charts.filter((c) => c.chart_type !== 'data_table'),
    [charts],
  )
  const tableCharts = useMemo(
    () => charts.filter((c) => c.chart_type === 'data_table'),
    [charts],
  )
  const hasTableView = tableCharts.length > 0 || tables.length > 0

  // Clear all filters
  const clearFilters = () => {
    setActiveFilters({})
  }

  // Set filter value
  const setFilter = (columnId: string, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [columnId]: value,
    }))
  }

  // Get column type from table
  const getColumnType = (columnId: string, table?: DynamicTable): string => {
    const col = table?.columns?.find(c => c.id === columnId)
    return col?.type || 'text'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (charts.length === 0 && tables.length === 0 && !isDocumentModule && !isInventoryModule) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Filter className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Sin datos asignados</h3>
        <p className="text-muted-foreground max-w-md">
          No tienes gráficos o tablas asignadas para este módulo. Contacta al administrador para solicitar acceso.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ModuleViewTracker moduleId={moduleId} moduleSlug={moduleSlug} moduleName={moduleName} />
      {/* Filters bar */}
      {availableFilters.length > 0 && (
        <div className="flex flex-col gap-3 p-4 bg-secondary/30 rounded-lg border lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Filtros</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="rounded-full">
                  {activeFilterCount} activo{activeFilterCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Active/visible filters – wrap responsively */}
            <div className="flex items-end gap-3 flex-wrap">
              {visibleFilters.map((filter, index) => {
                const colType = getColumnType(filter.column_id, filter.table)
                const options = filterOptions[filter.column_id] || []
                return (
                  <div key={`${filter.column_id}-${index}`} className="flex flex-col gap-1 min-w-40">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {filter.column_name}
                    </Label>
                    {colType === 'date' ? (
                      <Input
                        type="date"
                        value={activeFilters[filter.column_id] || ''}
                        onChange={(e) => setFilter(filter.column_id, e.target.value)}
                        className="h-9 text-sm bg-background"
                      />
                    ) : (
                      <Select
                        value={activeFilters[filter.column_id] || 'all'}
                        onValueChange={(v) => setFilter(filter.column_id, v)}
                      >
                        <SelectTrigger className="h-9 text-sm w-full bg-background">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {options.map(option => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              })}
              {visibleFilters.length === 0 && (
                <span className="text-xs text-muted-foreground italic">
                  No hay filtros activos. Pulsa &quot;Gestionar filtros&quot; para mostrar.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:self-end">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 gap-1.5 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </Button>
            )}

            {/* Manage filters sheet (only toggle visibility on/off) */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Gestionar filtros</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Gestionar filtros</SheetTitle>
                  <SheetDescription>
                    Activa o desactiva los filtros que quieres mostrar en la barra del módulo
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {visibleFilters.length} de {availableFilters.length} filtros visibles
                    </p>
                    {enabledFilterIds && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={enableAllFilters}
                        className="h-7 text-xs"
                      >
                        Mostrar todos
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                    {availableFilters.map(filter => {
                      const enabled = isFilterEnabled(filter.column_id)
                      return (
                        <label
                          key={`toggle-${filter.column_id}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-secondary/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={enabled}
                            onCheckedChange={(checked) => toggleFilterEnabled(filter.column_id, !!checked)}
                          />
                          <span className="text-sm font-medium">{filter.column_name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {filterOptions[filter.column_id]?.length || 0} opciones
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Refresh button */}
            <Button variant="ghost" size="icon" onClick={loadData} className="h-9 w-9">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters)
            .filter(([, value]) => value && value !== 'all')
            .map(([columnId, value]) => {
              const filter = availableFilters.find(f => f.column_id === columnId)
              return (
                <Badge
                  key={columnId}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="font-medium">{filter?.column_name}:</span>
                  <span>{value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => setFilter(columnId, 'all')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )
            })}
        </div>
      )}

      {/* Ship Tracker - Only shown inside Comercio Exterior module (flexible slug match) */}
      {(moduleSlug?.toLowerCase().includes('comercio') || moduleName?.toLowerCase().includes('comercio')) && (
        <div className="mb-8">
          <ShipTrackerWidget moduleId={moduleId} moduleSlug={moduleSlug} />
        </div>
      )}

      {isDocumentModule && (
        <div className="mb-8">
          <DocumentGenerator />
        </div>
      )}

      {isInventoryModule && (
        <div className="mb-8">
          <InventoryOverview />
        </div>
      )}

      {visualCharts.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Gráficos</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartRefreshKey((k) => k + 1)}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar gráficos
            </Button>
          </div>

          <div className="grid gap-6 min-w-0">
            {[...visualCharts]
              .sort((a, b) => {
                const priority = (type: string) => (type === 'map' ? 0 : 1)
                const pa = priority(a.chart_type)
                const pb = priority(b.chart_type)
                if (pa !== pb) return pa - pb
                return (a.display_order ?? 0) - (b.display_order ?? 0)
              })
              .map((chart) => (
                <div
                  key={chart.id}
                  className="p-6 bg-card border rounded-xl min-w-0 overflow-hidden"
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{chart.name}</h3>
                    {chart.table && (
                      <p className="text-sm text-muted-foreground">
                        Datos de: {chart.table.name}
                      </p>
                    )}
                  </div>
                  <ChartPreview
                    chartId={chart.id}
                    tableId={chart.table_id}
                    chartType={chart.chart_type}
                    config={chart.config}
                    filters={activeFilters}
                    refreshKey={chartRefreshKey}
                  />
                </div>
              ))}
          </div>
        </>
      )}

      {hasTableView && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tablas de datos</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartRefreshKey((k) => k + 1)}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar tablas
            </Button>
          </div>
          <div className="grid gap-6 min-w-0">
            {tableCharts.length > 0
              ? tableCharts.map((chart) => (
                  <div key={chart.id} className="p-6 bg-card border rounded-xl min-w-0 overflow-hidden">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">{chart.name}</h3>
                      {chart.table && (
                        <p className="text-sm text-muted-foreground">{chart.table.name}</p>
                      )}
                    </div>
                    <ChartPreview
                      chartId={chart.id}
                      tableId={chart.table_id}
                      chartType="data_table"
                      config={chart.config}
                      filters={activeFilters}
                      refreshKey={chartRefreshKey}
                    />
                  </div>
                ))
              : tables.map((table) => (
                  <div key={table.id} className="p-6 bg-card border rounded-xl min-w-0 overflow-hidden">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">{table.name}</h3>
                      {table.description && (
                        <p className="text-sm text-muted-foreground">{table.description}</p>
                      )}
                    </div>
                    <ChartPreview
                      tableId={table.id}
                      chartType="data_table"
                      config={{
                        visible_columns: table.columns?.map((col) => col.id) ?? [],
                        editableColumns: tableConfigs[table.id]?.editableColumns ?? [],
                        allowAddRows: tableConfigs[table.id]?.allowAddRows ?? false,
                        allowAddColumns: tableConfigs[table.id]?.allowAddColumns ?? false,
                        allowEditColumns: tableConfigs[table.id]?.allowEditColumns ?? false,
                        allowDeleteColumns: tableConfigs[table.id]?.allowDeleteColumns ?? false,
                      }}
                      filters={activeFilters}
                      refreshKey={chartRefreshKey}
                    />
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  )
}
