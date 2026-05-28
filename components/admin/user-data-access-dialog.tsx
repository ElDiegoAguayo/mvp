'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Database, BarChart3, Eye } from 'lucide-react'
import { logAudit } from '@/lib/audit-log'

interface DynamicTable {
  id: string
  name: string
  module_id: string
  module?: { name: string }
}

interface DynamicChart {
  id: string
  name: string
  module_id: string
  chart_type: string
  module?: { name: string }
}

interface UserDataAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
}

export function UserDataAccessDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: UserDataAccessDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tables, setTables] = useState<DynamicTable[]>([])
  const [charts, setCharts] = useState<DynamicChart[]>([])
  const [tableAccess, setTableAccess] = useState<Set<string>>(new Set())
  const [chartAccess, setChartAccess] = useState<Set<string>>(new Set())

  // Load data
  const loadData = useCallback(async () => {
    if (!open || !userId) return
    
    setLoading(true)

    const [tablesRes, chartsRes, tableAccessRes, chartAccessRes] = await Promise.all([
      supabase
        .from('dynamic_tables')
        .select('id, name, module_id, module:modules(name)')
        .order('name'),
      supabase
        .from('dynamic_charts')
        .select('id, name, module_id, chart_type, module:modules(name)')
        .order('name'),
      supabase
        .from('user_table_access')
        .select('table_id')
        .eq('user_id', userId)
        .eq('can_view', true),
      supabase
        .from('user_chart_access')
        .select('chart_id')
        .eq('user_id', userId)
        .eq('can_view', true),
    ])

    if (tablesRes.data) setTables(tablesRes.data as DynamicTable[])
    if (chartsRes.data) setCharts(chartsRes.data as DynamicChart[])
    if (tableAccessRes.data) {
      setTableAccess(new Set(tableAccessRes.data.map((a) => a.table_id)))
    }
    if (chartAccessRes.data) {
      setChartAccess(new Set(chartAccessRes.data.map((a) => a.chart_id)))
    }

    setLoading(false)
  }, [supabase, open, userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Toggle table access
  const toggleTableAccess = (tableId: string) => {
    const newAccess = new Set(tableAccess)
    if (newAccess.has(tableId)) {
      newAccess.delete(tableId)
    } else {
      newAccess.add(tableId)
    }
    setTableAccess(newAccess)
  }

  // Toggle chart access
  const toggleChartAccess = (chartId: string) => {
    const newAccess = new Set(chartAccess)
    if (newAccess.has(chartId)) {
      newAccess.delete(chartId)
    } else {
      newAccess.add(chartId)
    }
    setChartAccess(newAccess)
  }

  // Save changes
  const handleSave = async () => {
    setSaving(true)

    try {
      // Delete existing table access
      await supabase
        .from('user_table_access')
        .delete()
        .eq('user_id', userId)

      // Insert new table access
      if (tableAccess.size > 0) {
        const tableInserts = Array.from(tableAccess).map((tableId) => ({
          user_id: userId,
          table_id: tableId,
          can_view: true,
        }))
        const { error: tableError } = await supabase
          .from('user_table_access')
          .insert(tableInserts)
        if (tableError) throw tableError
      }

      // Delete existing chart access
      await supabase
        .from('user_chart_access')
        .delete()
        .eq('user_id', userId)

      // Insert new chart access
      if (chartAccess.size > 0) {
        const chartInserts = Array.from(chartAccess).map((chartId) => ({
          user_id: userId,
          chart_id: chartId,
          can_view: true,
        }))
        const { error: chartError } = await supabase
          .from('user_chart_access')
          .insert(chartInserts)
        if (chartError) throw chartError
      }

      await logAudit(supabase, {
        action_type: 'UPDATE_DATA_ACCESS',
        target_type: 'user',
        target_id: userId,
        target_label: userName,
        description: `Actualizó permisos de datos de "${userName}": ${tableAccess.size} tablas, ${chartAccess.size} gráficos.`,
        metadata: {
          tables: Array.from(tableAccess),
          charts: Array.from(chartAccess),
        },
      })

      toast.success('Permisos actualizados correctamente')
      onOpenChange(false)
    } catch (error) {
      toast.error('Error al guardar permisos', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      })
    } finally {
      setSaving(false)
    }
  }

  // Group tables by module
  const tablesByModule = useMemo(() => {
    const grouped = new Map<string, DynamicTable[]>()
    tables.forEach((table) => {
      const moduleName = table.module?.name || 'Sin módulo'
      if (!grouped.has(moduleName)) {
        grouped.set(moduleName, [])
      }
      grouped.get(moduleName)!.push(table)
    })
    return grouped
  }, [tables])

  // Group charts by module
  const chartsByModule = useMemo(() => {
    const grouped = new Map<string, DynamicChart[]>()
    charts.forEach((chart) => {
      const moduleName = chart.module?.name || 'Sin módulo'
      if (!grouped.has(moduleName)) {
        grouped.set(moduleName, [])
      }
      grouped.get(moduleName)!.push(chart)
    })
    return grouped
  }, [charts])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Acceso a Datos de {userName}
          </DialogTitle>
          <DialogDescription>
            Selecciona las tablas y gráficos que este usuario puede ver en sus módulos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tables Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Tablas de Datos</h3>
                <span className="text-xs text-muted-foreground">
                  ({tableAccess.size} seleccionadas)
                </span>
              </div>

              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay tablas creadas aún.
                </p>
              ) : (
                <div className="space-y-4">
                  {Array.from(tablesByModule.entries()).map(([moduleName, moduleTables]) => (
                    <div key={moduleName} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {moduleName}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {moduleTables.map((table) => (
                          <div
                            key={table.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              tableAccess.has(table.id)
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-secondary/50 hover:bg-secondary'
                            }`}
                            onClick={() => toggleTableAccess(table.id)}
                          >
                            <Checkbox
                              checked={tableAccess.has(table.id)}
                              onCheckedChange={() => toggleTableAccess(table.id)}
                            />
                            <Label className="cursor-pointer flex-1 text-sm">
                              {table.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charts Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Gráficos</h3>
                <span className="text-xs text-muted-foreground">
                  ({chartAccess.size} seleccionados)
                </span>
              </div>

              {charts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay gráficos creados aún.
                </p>
              ) : (
                <div className="space-y-4">
                  {Array.from(chartsByModule.entries()).map(([moduleName, moduleCharts]) => (
                    <div key={moduleName} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {moduleName}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {moduleCharts.map((chart) => (
                          <div
                            key={chart.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              chartAccess.has(chart.id)
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-secondary/50 hover:bg-secondary'
                            }`}
                            onClick={() => toggleChartAccess(chart.id)}
                          >
                            <Checkbox
                              checked={chartAccess.has(chart.id)}
                              onCheckedChange={() => toggleChartAccess(chart.id)}
                            />
                            <Label className="cursor-pointer flex-1 text-sm">
                              {chart.name}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({chart.chart_type})
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar permisos'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
