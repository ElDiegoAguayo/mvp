'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale } from '@/components/i18n/locale-provider'
import { toGeofenceLocation } from '@/lib/tech-assistance/location-validation'
import type { TechLocationOption } from '@/app/actions/tech-assistance-location-actions'

const TechAssistanceGeofenceMap = dynamic(
  () => import('@/components/dashboard/asistencia-tecnica/tech-assistance-geofence-map'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] animate-pulse rounded-xl border border-border bg-secondary" />
    ),
  },
)

interface ClientLocationsProfileSectionProps {
  locations: TechLocationOption[]
}

export function ClientLocationsProfileSection({ locations }: ClientLocationsProfileSectionProps) {
  const { t } = useLocale()
  const location = locations[0] ?? null
  const geofences = location ? [toGeofenceLocation(location)] : []

  return (
    <Card className="border-border bg-card shadow-sm lg:col-span-2">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          {t('profile.locations.title')}
        </CardTitle>
        <CardDescription>{t('profile.locations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {!location ? (
          <p className="text-sm text-muted-foreground">{t('profile.locations.none')}</p>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <p className="font-semibold text-foreground">{location.name}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
              </p>
              <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-400">
                {t('profile.locations.radius', { meters: location.radius_meters })}
              </p>
            </div>
            <TechAssistanceGeofenceMap
              activeLocation={geofences[0] ?? null}
              clientLocations={geofences}
              userPosition={null}
              statusLabel={t('profile.locations.mapHint')}
              statusTone="neutral"
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
