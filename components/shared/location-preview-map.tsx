'use client'

import dynamic from 'next/dynamic'
import { ExternalLink, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'

const LeafletLocationPreview = dynamic(
  () =>
    import('./location-preview-map-leaflet').then((mod) => mod.LeafletLocationPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        …
      </div>
    ),
  }
)

export type LocationPreviewMapProps = {
  lat: number | string
  lng: number | string
  radiusMeters?: number | string
  displayName?: string | null
  label?: string | null
  className?: string
}

export function LocationPreviewMap({
  lat,
  lng,
  radiusMeters,
  displayName,
  label,
  className,
}: LocationPreviewMapProps) {
  const { t } = useLocale()
  const latN = Number(lat)
  const lngN = Number(lng)
  const radiusN = radiusMeters != null && radiusMeters !== '' ? Number(radiusMeters) : undefined
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latN},${lngN}`
  const embedSrc = googleKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleKey)}&q=${latN},${lngN}&zoom=16&maptype=roadmap`
    : null

  return (
    <div className={cn('space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <MapPin className="h-4 w-4 shrink-0" />
          {t('asistenciaTecnica.locations.mapPreviewTitle')}
        </div>
        {displayName ? (
          <p className="text-sm text-foreground leading-snug">{displayName}</p>
        ) : label ? (
          <p className="text-sm text-foreground leading-snug">{label}</p>
        ) : null}
        <p className="text-xs tabular-nums text-muted-foreground">
          {latN.toFixed(5)}, {lngN.toFixed(5)}
          {radiusN && radiusN > 0 ? ` · ${Math.round(radiusN)} m` : ''}
        </p>
      </div>

      <div className="h-[260px] overflow-hidden rounded-lg border border-border bg-slate-900 shadow-sm">
        {embedSrc ? (
          <iframe
            title={t('asistenciaTecnica.locations.mapPreviewTitle')}
            src={embedSrc}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <LeafletLocationPreview lat={latN} lng={lngN} radiusMeters={radiusN} />
        )}
      </div>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4063ca] hover:text-[#3B5DE7] dark:text-[#6b8cff] dark:hover:text-[#8aa4ff] transition-colors"
      >
        {t('asistenciaTecnica.locations.openInGoogleMaps')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
