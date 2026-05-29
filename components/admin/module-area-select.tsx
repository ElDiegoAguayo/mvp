'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { ModuleArea } from '@/lib/modules/areas'

interface ModuleAreaSelectProps {
  value: string | null
  onChange: (areaId: string | null) => void
  disabled?: boolean
}

export function ModuleAreaSelect({ value, onChange, disabled }: ModuleAreaSelectProps) {
  const supabase = useMemo(() => createClient(), [])
  const [areas, setAreas] = useState<ModuleArea[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [showNewArea, setShowNewArea] = useState(false)

  const loadAreas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('module_areas')
      .select('id, name, display_order')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('[module-area-select]', error.message)
      setAreas([])
    } else {
      setAreas((data ?? []) as ModuleArea[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadAreas()
  }, [loadAreas])

  const handleCreateArea = async () => {
    const name = newAreaName.trim()
    if (!name) {
      toast.error('Escribe un nombre para el área')
      return
    }

    setCreating(true)
    const nextOrder =
      areas.length > 0 ? Math.max(...areas.map((a) => a.display_order)) + 1 : 0

    const { data, error } = await supabase
      .from('module_areas')
      .insert({ name, display_order: nextOrder })
      .select('id, name, display_order')
      .single()

    setCreating(false)

    if (error) {
      toast.error('No se pudo crear el área', { description: error.message })
      return
    }

    const created = data as ModuleArea
    setAreas((prev) => [...prev, created].sort((a, b) => a.display_order - b.display_order))
    onChange(created.id)
    setNewAreaName('')
    setShowNewArea(false)
    toast.success(`Área "${name}" creada`)
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        <Label>Área</Label>
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-secondary/40 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando áreas...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Área / categoría</Label>
      <p className="text-xs text-muted-foreground -mt-1">
        Agrupa módulos similares en el menú del cliente y en el panel admin
      </p>
      <div className="flex gap-2">
        <Select
          value={value ?? '__none__'}
          onValueChange={(v) => onChange(v === '__none__' ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger className="bg-secondary border-border flex-1">
            <SelectValue placeholder="Seleccionar área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin área (General)</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || creating}
          onClick={() => setShowNewArea((v) => !v)}
          title="Crear nueva área"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {showNewArea && (
        <div className="flex gap-2">
          <Input
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="Ej: Logística"
            disabled={disabled || creating}
            className="bg-secondary border-border"
          />
          <Button type="button" onClick={() => void handleCreateArea()} disabled={disabled || creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
          </Button>
        </div>
      )}
    </div>
  )
}
