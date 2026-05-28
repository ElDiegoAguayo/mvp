'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
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
  Database,
  TableIcon,
  Columns,
  Search,
  FileSpreadsheet,
  User,
} from 'lucide-react'
import { logAudit } from '@/lib/audit-log'
import Link from 'next/link'

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
  { value: 'formula', label: 'Fórmula' },
] as const

type ColumnType = (typeof COLUMN_TYPES)[number]['value']

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

interface Column {
  id: string
  name: string
  type: ColumnType
  options?: string[]
  optionColors?: Record<string, string> // Map option value -> color hex
  required?: boolean
  isFilter?: boolean // Can be used as filter in charts
  countdownDays?: number // Initial days for countdown columns
  formula?: {
    column1: string
    column2: string
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage'
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
  module?: { name: string; slug: string }
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

export function DynamicTablesManager() {
  const supabase = useMemo(() => createClient(), [])
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
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<DynamicTable | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formModuleId, setFormModuleId] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formColumns, setFormColumns] = useState<Column[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    
    const [tablesRes, modulesRes, clientsRes] = await Promise.all([
      supabase
        .from('dynamic_tables')
        .select('*, module:modules(name, slug), profile:profiles!dynamic_tables_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('modules')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('role', 'admin')
        .order('full_name'),
    ])

    if (tablesRes.data) {
      setTables(tablesRes.data as DynamicTable[])
    }
    if (modulesRes.data) {
      setModules(modulesRes.data)
    }
    if (clientsRes.data) {
      setClients(clientsRes.data)
    }
    
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter tables
  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      const matchesSearch =
        table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesModule = filterModuleId === 'all' || table.module_id === filterModuleId
      const matchesClient = filterClientId === 'all' || table.user_id === filterClientId
      return matchesSearch && matchesModule && matchesClient
    })
  }, [tables, searchTerm, filterModuleId, filterClientId])

  // Create table
  const handleCreate = async () => {
    if (!formName.trim() || !formModuleId || !formClientId) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('dynamic_tables')
      .insert({
        name: formName.trim(),
        description: formDescription.trim() || null,
        module_id: formModuleId,
        user_id: formClientId,
        columns: [],
      })
      .select()
      .single()

    if (error) {
      toast.error('Error al crear tabla: ' + error.message)
    } else {
      toast.success('Tabla creada exitosamente')
      await logAudit(supabase, {
        action_type: 'CREATE_DYNAMIC_TABLE',
        target_type: 'dynamic_table',
        target_id: data.id,
        target_label: formName,
        description: `Creó la tabla dinámica "${formName}"`,
        metadata: { table_id: data.id, name: formName },
      })
      setCreateDialogOpen(false)
      resetForm()
      loadData()
    }
    setIsSaving(false)
  }

  // Update table
  const handleUpdate = async () => {
    if (!selectedTable || !formName.trim() || !formModuleId || !formClientId) return

    setIsSaving(true)
    const { error } = await supabase
      .from('dynamic_tables')
      .update({
        name: formName.trim(),
        description: formDescription.trim() || null,
        module_id: formModuleId,
        user_id: formClientId,
      })
      .eq('id', selectedTable.id)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
    } else {
      toast.success('Tabla actualizada')
      await logAudit(supabase, {
        action_type: 'UPDATE_DYNAMIC_TABLE',
        target_type: 'dynamic_table',
        target_id: selectedTable.id,
        target_label: formName,
        description: `Actualizó la tabla dinámica "${formName}"`,
        metadata: { table_id: selectedTable.id },
      })
      setEditDialogOpen(false)
      loadData()
    }
    setIsSaving(false)
  }

  // Delete table
  const handleDelete = async () => {
    if (!selectedTable) return

    setIsSaving(true)
    const { error } = await supabase
      .from('dynamic_tables')
      .delete()
      .eq('id', selectedTable.id)

    if (error) {
      toast.error('Error al eliminar: ' + error.message)
    } else {
      toast.success('Tabla eliminada')
      await logAudit(supabase, {
        action_type: 'DELETE_DYNAMIC_TABLE',
        target_type: 'dynamic_table',
        target_id: selectedTable.id,
        target_label: selectedTable.name,
        description: `Eliminó la tabla dinámica "${selectedTable.name}"`,
        metadata: { table_id: selectedTable.id, name: selectedTable.name },
      })
      setDeleteDialogOpen(false)
      setSelectedTable(null)
      loadData()
    }
    setIsSaving(false)
  }

  // Save columns
  const handleSaveColumns = async () => {
    if (!selectedTable) return

    setIsSaving(true)
    const { error } = await supabase
      .from('dynamic_tables')
      .update({ columns: formColumns })
      .eq('id', selectedTable.id)

    if (error) {
      toast.error('Error al guardar columnas: ' + error.message)
    } else {
      toast.success('Columnas guardadas')
      await logAudit(supabase, {
        action_type: 'UPDATE_TABLE_COLUMNS',
        target_type: 'dynamic_table',
        target_id: selectedTable.id,
        target_label: selectedTable.name,
        description: `Actualizó las columnas de la tabla (count: ${formColumns.length})`,
        metadata: { table_id: selectedTable.id, columns_count: formColumns.length },
      })
      setColumnsDialogOpen(false)
      loadData()
    }
    setIsSaving(false)
  }

  // Add column
  const addColumn = () => {
    setFormColumns([
      ...formColumns,
      { id: crypto.randomUUID(), name: '', type: 'text', isFilter: false },
    ])
  }

  // Remove column
  const removeColumn = (id: string) => {
    setFormColumns(formColumns.filter((c) => c.id !== id))
  }

  // Update column
  const updateColumn = (id: string, updates: Partial<Column>) => {
    setFormColumns(formColumns.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  // Dialog openers
  const openEditDialog = (table: DynamicTable) => {
    setSelectedTable(table)
    setFormName(table.name)
    setFormDescription(table.description || '')
    setFormModuleId(table.module_id)
    setFormClientId(table.user_id || '')
    setEditDialogOpen(true)
  }

  const openColumnsDialog = (table: DynamicTable) => {
    setSelectedTable(table)
    setFormColumns(table.columns || [])
    setColumnsDialogOpen(true)
  }

  const openDeleteDialog = (table: DynamicTable) => {
    setSelectedTable(table)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormModuleId('')
    setFormClientId('')
    setFormColumns([])
    setSelectedTable(null)
  }

  // Get client name
  const getClientName = (table: DynamicTable) => {
    if (table.profile) {
      return table.profile.full_name || table.profile.email
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
            <Database className="w-5 h-5 text-primary" />
            Tablas de Datos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea tablas dinámicas tipo Excel para cada cliente
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tabla
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tablas..."
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

      {/* Tables list */}
      {filteredTables.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <TableIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay tablas creadas</p>
          <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Crear primera tabla
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Columnas</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{table.name}</p>
                      {table.description && (
                        <p className="text-xs text-muted-foreground">{table.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {table.module?.name || 'Sin módulo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{getClientName(table)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {table.columns?.length || 0} columnas
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/tabla/${table.id}`}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Editar datos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openColumnsDialog(table)}>
                          <Columns className="w-4 h-4 mr-2" />
                          Editar columnas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(table)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar tabla
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(table)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tabla de Datos</DialogTitle>
            <DialogDescription>
              Crea una tabla para almacenar datos de un cliente específico
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la tabla *</Label>
              <Input
                placeholder="Ej: Embarques 2024"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción opcional"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Módulo *</Label>
              <Select value={formModuleId} onValueChange={setFormModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un módulo" />
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
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo este cliente podrá ver esta tabla y sus datos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear tabla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tabla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Módulo *</Label>
              <Select value={formModuleId} onValueChange={setFormModuleId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger>
                  <SelectValue />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Columns Dialog */}
      <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Columnas de {selectedTable?.name}</DialogTitle>
            <DialogDescription>
              Define las columnas y sus tipos. Marca como filtro las columnas que el cliente podrá usar para filtrar datos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {formColumns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay columnas definidas
              </p>
            ) : (
              formColumns.map((col, index) => (
                <div key={col.id} className="flex items-start gap-2 p-3 border rounded-lg">
                  <span className="text-xs text-muted-foreground mt-2">
                    {index + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Nombre de columna"
                      value={col.name}
                      onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Select
                        value={col.type}
                        onValueChange={(v) => updateColumn(col.id, { type: v as ColumnType })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLUMN_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant={col.isFilter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateColumn(col.id, { isFilter: !col.isFilter })}
                        className="text-xs"
                      >
                        {col.isFilter ? 'Es filtro' : 'No es filtro'}
                      </Button>
                    </div>
                    {col.type === 'select' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Opciones separadas por coma"
                          value={col.options?.join(', ') || ''}
                          onChange={(e) =>
                            updateColumn(col.id, {
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
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
                                        updateColumn(col.id, {
                                          optionColors: {
                                            ...(col.optionColors || {}),
                                            [opt]: color.value,
                                          },
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
                    {col.type === 'countdown' && (
                      <div className="space-y-1.5">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Días iniciales (ej: 30)"
                          value={col.countdownDays || ''}
                          onChange={(e) =>
                            updateColumn(col.id, {
                              countdownDays: Number.parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Los días se descontarán automáticamente cada día desde la fecha de creación del registro.
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeColumn(col.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" onClick={addColumn} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Agregar columna
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColumnsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveColumns} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar columnas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tabla</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la tabla &ldquo;{selectedTable?.name}&rdquo; y
              todos sus datos. Esta acción no se puede deshacer.
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
