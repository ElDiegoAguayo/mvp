'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Pencil, ImageIcon, Plus, Trash2, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCropHeaderStyle } from '@/lib/agronomy/constants'
import { OfflinePendingBadge } from '@/components/dashboard/offline-pending-badge'
import { useLocale } from '@/components/i18n/locale-provider'

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

type TimelineRowKey =
  | 'season'
  | 'date'
  | 'variety'
  | 'phenologyState'
  | 'row'
  | 'tree'
  | 'notes'
  | 'images'

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
  const { t } = useLocale()
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

  const rows = useMemo(() => {
    const defs: Array<{
      key: TimelineRowKey
      label: string
      className?: string
      isImageRow?: boolean
      render: (obs: PhenologyTimelineObservation) => ReactNode
    }> = [
      {
        key: 'season',
        label: t('estadosFenologicos.timeline.season'),
        className: 'text-muted-foreground',
        render: (o) => o.season_label || seasonLabel,
      },
      {
        key: 'date',
        label: t('estadosFenologicos.timeline.date'),
        className: 'font-medium',
        render: (o) => (
          <div className="flex flex-col items-start gap-1">
            <span>{fmtObsDate(o.observed_at)}</span>
            <OfflinePendingBadge recordId={o.id} />
          </div>
        ),
      },
      {
        key: 'variety',
        label: t('estadosFenologicos.timeline.variety'),
        render: (o) => o.variety ?? '—',
      },
      {
        key: 'phenologyState',
        label: t('estadosFenologicos.timeline.phenologyState'),
        render: (o) => (
          <span className="whitespace-pre-wrap leading-snug">{o.stage_name}</span>
        ),
      },
      {
        key: 'row',
        label: t('estadosFenologicos.timeline.row'),
        render: (o) => o.hilera ?? '—',
      },
      {
        key: 'tree',
        label: t('estadosFenologicos.timeline.tree'),
        render: (o) => o.arbol ?? '—',
      },
      {
        key: 'notes',
        label: t('estadosFenologicos.timeline.notes'),
        render: (o) => (
          <span className="whitespace-pre-wrap leading-snug text-muted-foreground">
            {o.notes?.trim() ? o.notes : '—'}
          </span>
        ),
      },
      {
        key: 'images',
        label: t('estadosFenologicos.timeline.images'),
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
                  <span className="text-xs font-medium">{t('estadosFenologicos.timeline.addPhotos')}</span>
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
                {imgs.length === 0
                  ? t('estadosFenologicos.timeline.uploadPhotos')
                  : t('estadosFenologicos.timeline.editPhotos')}
              </Button>
            </div>
          )
        },
      },
    ]
    return defs
  }, [t, seasonLabel, onEdit, imageUrls])

  if (observations.length === 0) {
    return (
      <div className={cn('rounded-xl border border-dashed p-6 text-center text-muted-foreground', compact && 'p-4')}>
        <p className="font-medium text-foreground">{blockName}</p>
        <p className="text-xs mt-1 mb-3">{t('estadosFenologicos.timeline.noReadings', { season: seasonLabel })}</p>
        <Button variant="outline" size="sm" onClick={onAddWeek}>{t('estadosFenologicos.timeline.addWeek')}</Button>
      </div>
    )
  }

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
              {t('estadosFenologicos.timeline.seasonLabel', { crop, season: seasonLabel })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onRenameBlock && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/15"
                onClick={onRenameBlock}
                title={t('estadosFenologicos.timeline.renameBlock')}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAddWeek} className="gap-1 h-8 bg-background/90 border-background/20">
              <Plus className="w-3.5 h-3.5" /> {t('estadosFenologicos.timeline.week')}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px] border-collapse">
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold text-muted-foreground border-r min-w-[130px] whitespace-nowrap align-top">
                    {row.label}
                  </td>
                  {observations.map((obs) => (
                    <td
                      key={`${row.key}-${obs.id}`}
                      className={cn(
                        'px-3 py-2 align-top border-r last:border-r-0',
                        row.className,
                        row.isImageRow
                          ? 'min-w-[400px] w-[400px]'
                          : row.key === 'phenologyState'
                            ? 'min-w-[180px] max-w-[260px]'
                            : 'min-w-[130px] max-w-[200px]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 group">
                        <div className="flex-1 min-w-0">{row.render(obs)}</div>
                        {(row.key === 'date' || row.key === 'phenologyState') && (
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => onEdit(obs)}
                              title={t('estadosFenologicos.timeline.editWeek')}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {row.key === 'date' && onDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onDelete(obs)}
                                title={t('estadosFenologicos.timeline.deleteDate')}
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
            alt={t('estadosFenologicos.timeline.enlargedView')}
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
              {t('estadosFenologicos.timeline.editPhotos')}
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>
              {t('common.actions.close')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
