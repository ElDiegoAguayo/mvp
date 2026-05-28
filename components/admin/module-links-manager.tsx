'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Loader2, Save, ExternalLink, Check } from 'lucide-react'
import { getModuleIcon } from '@/lib/module-icons'

interface Module {
  id: string
  slug: string
  name: string
  icon: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
}

interface UserModuleLink {
  user_id: string
  module_slug: string
  embed_url: string | null
}

export function ModuleLinksManager() {
  const supabase = useMemo(() => createClient(), [])
  const [modules, setModules] = useState<Module[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [selectedModuleSlug, setSelectedModuleSlug] = useState('')
  const [loadingModules, setLoadingModules] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Links grid: user_id -> embed_url
  const [links, setLinks] = useState<Record<string, string>>({})

  // Load modules and users on mount
  useEffect(() => {
    loadModulesAndUsers()
  }, [])

  const loadModulesAndUsers = async () => {
    setLoadingModules(true)
    setLoadingUsers(true)

    const [modulesRes, usersRes] = await Promise.all([
      supabase.from('modules').select('id, slug, name, icon').eq('is_active', true),
      supabase.from('profiles').select('id, email, full_name').order('email', { ascending: true }),
    ])

    if (modulesRes.data) {
      setModules(modulesRes.data as Module[])
      if (modulesRes.data.length > 0) {
        setSelectedModuleSlug(modulesRes.data[0].slug)
      }
    }
    if (usersRes.data) {
      setUsers(usersRes.data as UserProfile[])
    }

    setLoadingModules(false)
    setLoadingUsers(false)
  }

  // Load links when module changes
  useEffect(() => {
    if (selectedModuleSlug) {
      loadLinksForModule()
    }
  }, [selectedModuleSlug])

  const loadLinksForModule = async () => {
    if (!selectedModuleSlug) return

    const { data } = await supabase
      .from('user_module_links')
      .select('user_id, embed_url')
      .eq('module_slug', selectedModuleSlug)

    const linksMap: Record<string, string> = {}
    if (data) {
      data.forEach((link: UserModuleLink) => {
        linksMap[link.user_id] = link.embed_url || ''
      })
    }
    setLinks(linksMap)
  }

  const handleLinkChange = (userId: string, value: string) => {
    setLinks(prev => ({
      ...prev,
      [userId]: value,
    }))
  }

  const handleSave = async () => {
    if (!selectedModuleSlug) return

    setIsSaving(true)
    try {
      // Prepare upsert data
      const upsertData = users.map(user => ({
        user_id: user.id,
        module_slug: selectedModuleSlug,
        embed_url: links[user.id] || null,
      }))

      const { error } = await supabase
        .from('user_module_links')
        .upsert(upsertData, { onConflict: 'user_id,module_slug' })

      if (error) {
        toast.error('Error al guardar', { description: error.message })
        return
      }

      toast.success('Enlaces guardados', {
        description: `Se actualizaron los enlaces para ${selectedModuleSlug}`,
      })
    } catch (err) {
      console.error('[v0] Error saving links:', err)
      toast.error('Error inesperado')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedModule = modules.find(m => m.slug === selectedModuleSlug)
  const Icon = selectedModule ? getModuleIcon(selectedModule.icon) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestionar Enlaces de Looker Studio</CardTitle>
        <CardDescription>
          Asigna un enlace de Looker Studio único a cada usuario para cada módulo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Module selector */}
        <div className="space-y-2">
          <Label htmlFor="module-select" className="text-foreground">
            Módulo
          </Label>
          <Select value={selectedModuleSlug} onValueChange={setSelectedModuleSlug} disabled={loadingModules}>
            <SelectTrigger id="module-select" className="bg-secondary border-border">
              <SelectValue placeholder="Cargando módulos..." />
            </SelectTrigger>
            <SelectContent>
              {modules.map(module => {
                const ModuleIcon = getModuleIcon(module.icon)
                return (
                  <SelectItem key={module.id} value={module.slug}>
                    <span className="flex items-center gap-2">
                      <ModuleIcon className="w-4 h-4" />
                      {module.name}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Links grid */}
        {selectedModuleSlug && (
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-4">Enlaces por Usuario</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loadingUsers ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando usuarios...
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay usuarios disponibles</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {user.email}
                        {user.full_name && <span className="text-[11px]"> ({user.full_name})</span>}
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="url"
                          placeholder="https://lookerstudio.google.com/..."
                          value={links[user.id] || ''}
                          onChange={e => handleLinkChange(user.id, e.target.value)}
                          disabled={isSaving}
                          className="bg-background border-border text-sm flex-1"
                        />
                        {links[user.id] && (
                          <a
                            href={links[user.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Abrir enlace"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={isSaving || loadingUsers}
              className="w-full gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Enlaces
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
