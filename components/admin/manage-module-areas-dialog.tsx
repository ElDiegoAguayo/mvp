'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowDown, ArrowUp, Layers, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { ModuleArea } from '@/lib/modules/areas'

interface ManageModuleAreasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAreasChanged?: () => void
}

export function ManageModuleAreasDialog({
  open,
  onOpenChange,
  onAreasChanged,
}: ManageModuleAreasDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [areas, setAreas] = useState<ModuleArea[]>([])
  const [modulesByArea, setModulesByArea] = useState<Record<string, string[]>>({})
  const [unassignedModules, setUnassignedModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')

  const loadAreas = useCallback(async () => {
    setLoading(true)
    const [{ data, error }, { data: modulesData }] = await Promise.all([
      supabase
        .from('module_areas')
        .select('id, name, display_order')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('modules')
        .select('name, area_id, slug')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (error) {
      toast.error('No se pudieron cargar las áreas', { description: error.message })
      setAreas([])
    } else {
      setAreas((data ?? []) as ModuleArea[])
    }

    const byArea: Record<string, string[]> = {}
    const unassigned: string[] = []
    for (const mod of modulesData ?? []) {
      if (mod.slug?.includes('retired') || mod.slug === 'inicio') continue
      if (mod.area_id) {
        if (!byArea[mod.area_id]) byArea[mod.area_id] = []
        byArea[mod.area_id].push(mod.name)
      } else {
        unassigned.push(mod.name)
      }
    }
    setModulesByArea(byArea)
    setUnassignedModules(unassigned)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (open) void loadAreas()
  }, [open, loadAreas])

  const persistOrder = async (nextAreas: ModuleArea[]) => {
    setSaving(true)
    const updates = nextAreas.map((area, index) => ({
      id: area.id,
      name: area.name,
      display_order: index,
    }))

    const { error } = await supabase.from('module_areas').upsert(updates, { onConflict: 'id' })
    setSaving(false)

    if (error) {
      toast.error('No se pudo guardar el orden', { description: error.message })
      return false
    }
    setAreas(nextAreas.map((a, i) => ({ ...a, display_order: i })))
    onAreasChanged?.()
    return true
  }

  const moveArea = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= areas.length) return
    const next = [...areas]
    ;[next[index], next[target]] = [next[target], next[index]]
    await persistOrder(next)
  }

  const renameArea = async (area: ModuleArea, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === area.name) return
    setSaving(true)
    const { error } = await supabase
      .from('module_areas')
      .update({ name: trimmed })
      .eq('id', area.id)
    setSaving(false)
    if (error) {
      toast.error('No se pudo renombrar el área', { description: error.message })
      return
    }
    setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, name: trimmed } : a)))
    onAreasChanged?.()
  }

  const createArea = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Escribe un nombre para el área')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('module_areas')
      .insert({ name, display_order: areas.length })
      .select('id, name, display_order')
      .single()
    setSaving(false)

    if (error) {
      toast.error('No se pudo crear el área', { description: error.message })
      return
    }

    setAreas((prev) => [...prev, data as ModuleArea])
    setNewName('')
    onAreasChanged?.()
    toast.success(`Área "${name}" creada`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Áreas de módulos</DialogTitle>
              <DialogDescription>
                Categorías para agrupar módulos por área funcional (campo, comercio exterior, costos, etc.)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {areas.map((area, index) => (
                <div
                  key={area.id}
                  className="rounded-xl border-2 border-border bg-secondary/20 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-secondary/40">
                    <Input
                      defaultValue={area.name}
                      disabled={saving}
                      onBlur={(e) => void renameArea(area, e.target.value)}
                      className="h-8 bg-background border-border flex-1 font-semibold"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={saving || index === 0}
                      onClick={() => void moveArea(index, 'up')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={saving || index === areas.length - 1}
                      onClick={() => void moveArea(index, 'down')}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="px-3 py-2.5">
                    {(modulesByArea[area.id]?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {modulesByArea[area.id].map((name) => (
                          <span
                            key={name}
                            className="inline-flex rounded-full bg-background border border-border px-2.5 py-0.5 text-[11px] text-foreground"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Sin módulos — asigna el área al editar un módulo
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {unassignedModules.length > 0 && (
                <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
                    Sin área asignada
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unassignedModules.map((name) => (
                      <span
                        key={name}
                        className="inline-flex rounded-full bg-background border border-amber-500/30 px-2.5 py-0.5 text-[11px] text-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nueva área..."
                disabled={saving}
                className="bg-secondary border-border"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createArea()
                  }
                }}
              />
              <Button type="button" onClick={() => void createArea()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
