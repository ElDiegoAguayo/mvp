'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Pencil, ImageIcon, Plus, Trash2, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCropHeaderStyle } from '@/lib/agronomy/constants'

export interface PhenologyTimelineObservation {
  id: string
  block_name: string
  variety: string | null
  stage_name: string
  observed_at: string
  season_label: string
  hilera: number | null
  arbol: number | null
  notes: string | null
  images?: PhenologyTimelineImage[]
}

export interface PhenologyTimelineImage {
  id: string
  storage_path: string
  file_name: string
  mime_type?: string | null
  url?: string
}

export function fmtObsDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

interface BlockTimelineGridProps {
  blockName: string
  seasonLabel: string
  crop: string
  observations: PhenologyTimelineObservation[]
  onEdit: (obs: PhenologyTimelineObservation) => void
  onDelete?: (obs: PhenologyTimelineObservation) => void
  onAddWeek: () => void
  onRenameBlock?: () => void
  compact?: boolean
}

export function BlockTimelineGrid({
  blockName,
  seasonLabel,
  crop,
  observations,
  onEdit,
  onDelete,
  onAddWeek,
  onRenameBlock,
  compact = false,
}: BlockTimelineGridProps) {
  const supabase = createClient()
  const [preview, setPreview] = useState<{ url: string; obs: PhenologyTimelineObservation } | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function loadUrls() {
      const paths = observations.flatMap((o) =>
        (o.images ?? []).map((img) => ({ id: img.id, path: img.storage_path })),
      )
      const next: Record<string, string> = {}
      await Promise.all(
        paths.map(async ({ id, path }) => {
          const { data } = await supabase.storage.from('fenologia').createSignedUrl(path, 3600)
          if (data?.signedUrl) next[id] = data.signedUrl
        }),
      )
      if (!cancelled) setImageUrls(next)
    }
    if (observations.some((o) => (o.images?.length ?? 0) > 0)) loadUrls()
    else setImageUrls({})
    return () => { cancelled = true }
  }, [observations, supabase])

  if (observations.length === 0) {
    return (
      <div className={cn('rounded-xl border border-dashed p-6 text-center text-muted-foreground', compact && 'p-4')}>
        <p className="font-medium text-foreground">{blockName}</p>
        <p className="text-xs mt-1 mb-3">Sin lecturas en {seasonLabel}</p>
        <Button variant="outline" size="sm" onClick={onAddWeek}>Agregar semana</Button>
      </div>
    )
  }

  const rows: Array<{
    label: string
    className?: string
    isImageRow?: boolean
    render: (obs: PhenologyTimelineObservation) => ReactNode
  }> = [
    {
      label: 'Temporada',
      className: 'text-muted-foreground',
      render: (o) => o.season_label || seasonLabel,
    },
    {
      label: 'Fecha',
      className: 'font-medium',
      render: (o) => fmtObsDate(o.observed_at),
    },
    {
      label: 'Variedad',
      render: (o) => o.variety ?? '—',
    },
    {
      label: 'Estado Fenologico',
      render: (o) => (
        <span className="whitespace-pre-wrap leading-snug">{o.stage_name}</span>
      ),
    },
    {
      label: 'Hilera',
      render: (o) => o.hilera ?? '—',
    },
    {
      label: 'Arbol',
      render: (o) => o.arbol ?? '—',
    },
    {
      label: 'Notas',
      render: (o) => (
        <span className="whitespace-pre-wrap leading-snug text-muted-foreground">
          {o.notes?.trim() ? o.notes : '—'}
        </span>
      ),
    },
    {
      label: 'Imagenes',
      isImageRow: true,
      render: (o) => {
        const imgs = o.images ?? []
        return (
          <div className="space-y-2">
            {imgs.length === 0 ? (
              <button
                type="button"
                className="flex flex-col items-center justify-center w-full min-h-[280px] rounded-lg border border-dashed text-muted-foreground hover:text-foreground hover:border-lime-500/40 hover:bg-muted/30 transition-colors"
                onClick={() => onEdit(o)}
              >
                <ImageIcon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">Agregar fotos</span>
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {imgs.map((img) => {
                  const url = imageUrls[img.id]
                  return (
                    <button
                      key={img.id}
                      type="button"
                      className="group relative w-[280px] h-[280px] rounded-lg overflow-hidden border-2 border-border bg-muted shrink-0 hover:border-lime-500/50 transition-colors"
                      onClick={() => url && setPreview({ url, obs: o })}
                      title={img.file_name}
                    >
                      {url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={img.file_name} className="w-full h-full object-contain bg-muted/50" />
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs w-full"
              onClick={() => onEdit(o)}
            >
              <Pencil className="w-3 h-3 mr-1" />
              {imgs.length === 0 ? 'Subir fotos' : 'Editar fotos'}
            </Button>
          </div>
        )
      },
    },
  ]

  const cropStyle = getCropHeaderStyle(crop)

  return (
    <>
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className={cn(
          'px-4 py-3 border-b flex items-center justify-between gap-2',
          cropStyle.header,
        )}>
          <div>
            <p className={cn('font-bold text-base tracking-tight', cropStyle.title)}>{blockName}</p>
            <p className={cn('text-xs', cropStyle.subtitle)}>
              {crop} · Temporada {seasonLabel}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onRenameBlock && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/15"
                onClick={onRenameBlock}
                title="Renombrar cuartel"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAddWeek} className="gap-1 h-8 bg-background/90 border-background/20">
              <Plus className="w-3.5 h-3.5" /> Semana
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px] border-collapse">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold text-muted-foreground border-r min-w-[130px] whitespace-nowrap align-top">
                    {row.label}
                  </td>
                  {observations.map((obs) => (
                    <td
                      key={`${row.label}-${obs.id}`}
                      className={cn(
                        'px-3 py-2 align-top border-r last:border-r-0',
                        row.className,
                        row.isImageRow
                          ? 'min-w-[400px] w-[400px]'
                          : row.label === 'Estado Fenologico'
                            ? 'min-w-[180px] max-w-[260px]'
                            : 'min-w-[130px] max-w-[200px]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 group">
                        <div className="flex-1 min-w-0">{row.render(obs)}</div>
                        {(row.label === 'Fecha' || row.label === 'Estado Fenologico') && (
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => onEdit(obs)}
                              title="Editar semana"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {row.label === 'Fecha' && onDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onDelete(obs)}
                                title="Eliminar esta fecha"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 gap-4"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
          role="button"
          tabIndex={0}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Vista ampliada"
            className="max-w-[min(96vw,900px)] max-h-[80vh] w-auto h-auto rounded-lg object-contain shadow-2xl bg-black/20"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(null)
                onEdit(preview.obs)
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar fotos
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
