'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  type CountryTimezoneInfo,
  type SavedTimezone,
  SAVED_TIMEZONE_STORAGE_KEY,
  formatTimeInTimezone,
  formatTimeOnly,
  resolveCountryTimezone,
  resolveTimezoneFromCoordinates,
} from '@/lib/timezone/country-timezones'
import { getCountryFlagUrl } from '@/lib/timezone/country-flags'
import { CountryFlag } from '@/components/admin/country-flag'
import { Clock, Globe2, Loader2, MapPin, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const GlobeMap = dynamic(
  () => import('@/components/admin/timezone-globe-map').then(m => m.TimezoneGlobeMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] items-center justify-center rounded-2xl border border-border bg-[#0a0e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  },
)

interface TimezoneGlobePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SelectedLocation {
  country: CountryTimezoneInfo
  countryKey: string
  clickLabel?: string
}

function readSavedTimezone(): SavedTimezone | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SAVED_TIMEZONE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedTimezone
  } catch {
    return null
  }
}

export function TimezoneGlobePanel({ open, onOpenChange }: TimezoneGlobePanelProps) {
  const [rotation, setRotation] = useState<[number, number, number]>([-72, -33, 0])
  const [selected, setSelected] = useState<SelectedLocation | null>(null)
  const [resolving, setResolving] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saved, setSaved] = useState<SavedTimezone | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setSaved(readSavedTimezone())
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setTick(n => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [open, saveDialogOpen])

  const handleCountryClick = useCallback((countryName: string) => {
    const country = resolveCountryTimezone(countryName)
    setSelected({ country, countryKey: countryName })
  }, [])

  const handleOceanClick = useCallback(async (latitude: number, longitude: number) => {
    setResolving(true)
    try {
      const { timezone, label } = await resolveTimezoneFromCoordinates(latitude, longitude)
      const pseudo: CountryTimezoneInfo = {
        flag: '🌊',
        nameEs: 'Océano / mar abierto',
        nameEn: 'Open ocean',
        defaultTimezone: timezone,
        regions: [{ label: `Coordenadas ${label}`, timezone }],
      }
      setSelected({
        country: pseudo,
        countryKey: `coord:${latitude.toFixed(2)},${longitude.toFixed(2)}`,
        clickLabel: label,
      })
    } finally {
      setResolving(false)
    }
  }, [])

  const handleSaveTimezone = useCallback(() => {
    if (!selected) return
    const payload: SavedTimezone = {
      countryKey: selected.countryKey,
      flag: selected.country.flag,
      nameEs: selected.country.nameEs,
      defaultTimezone: selected.country.defaultTimezone,
      regions: selected.country.regions,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(SAVED_TIMEZONE_STORAGE_KEY, JSON.stringify(payload))
    setSaved(payload)
    setSaveDialogOpen(true)
    toast.success('Zona horaria guardada')
  }, [selected])

  const displayCountry = selected?.country ?? null
  const selectedCountryName =
    selected && !selected.countryKey.startsWith('coord:') ? selected.countryKey : null
  const selectedFlagUrl = selectedCountryName ? getCountryFlagUrl(selectedCountryName, 80) : null
  const savedCountryName =
    saved && !saved.countryKey.startsWith('coord:') ? saved.countryKey : null

  const mainTime = useMemo(
    () => (displayCountry ? formatTimeInTimezone(displayCountry.defaultTimezone) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayCountry, tick],
  )

  if (!open) return null

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Globe2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Zona horaria</h3>
              <p className="text-xs text-muted-foreground">
                Gira el planeta, haz clic en un país y guarda la zona horaria de referencia.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CountryFlag
                  countryName={savedCountryName}
                  emoji={saved.flag}
                  size="xs"
                  className="rounded-[2px]"
                />
                {saved.nameEs}
              </span>
            )}
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setRotation([-72, -33, 0])}>
              <RotateCcw className="h-3.5 w-3.5" />
              Centrar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_280px]">
          <div className="relative overflow-hidden rounded-2xl border border-[#1e293b] bg-[#050810] shadow-inner">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(64,99,202,0.2),transparent_55%)]" />
            <GlobeMap
              geoUrl={GEO_URL}
              rotation={rotation}
              onRotationChange={setRotation}
              selectedCountryKey={selected?.countryKey}
              selectedFlagUrl={selectedFlagUrl}
              onCountryClick={handleCountryClick}
              onOceanClick={handleOceanClick}
            />
            {resolving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-center text-[10px] text-slate-400/90">
              Arrastra para girar · Clic en un país u océano
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {!displayCountry ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-10 text-center">
                <Globe2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Selecciona un lugar en el planeta</p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Verás la hora local y podrás guardar la zona horaria
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-start gap-3">
                  <CountryFlag
                    countryName={selectedCountryName}
                    emoji={displayCountry.flag}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground">{displayCountry.nameEs}</p>
                    {selected?.clickLabel && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {selected.clickLabel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hora actual
                  </p>
                  <p className="flex items-center gap-2 text-2xl font-bold tabular-nums text-primary">
                    <Clock className="h-5 w-5 shrink-0" />
                    {formatTimeOnly(displayCountry.defaultTimezone)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{mainTime}</p>
                </div>

                {displayCountry.regions.length > 1 && (
                  <div className="max-h-36 space-y-1.5 overflow-y-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Regiones del país
                    </p>
                    {displayCountry.regions.map(region => (
                      <div
                        key={region.timezone + region.label}
                        className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2 py-1.5 text-xs"
                      >
                        <span className="truncate text-muted-foreground">{region.label}</span>
                        <span className="shrink-0 font-mono font-semibold tabular-nums text-foreground">
                          {formatTimeOnly(region.timezone)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full gap-2 bg-[#4A6CF7] hover:bg-[#3a5ce6] text-white"
                  onClick={handleSaveTimezone}
                >
                  <Save className="h-4 w-4" />
                  ¿Guardar zona horaria?
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <CountryFlag
                countryName={savedCountryName}
                emoji={saved?.flag}
                size="lg"
              />
              <span>Zona horaria guardada</span>
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1">
              <CountryFlag
                countryName={savedCountryName}
                emoji={saved?.flag}
                size="sm"
              />
              <span>{saved?.nameEs} — referencia para programar notificaciones</span>
            </DialogDescription>
          </DialogHeader>

          {saved && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <CountryFlag
                  countryName={savedCountryName}
                  emoji={saved.flag}
                  size="xl"
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{saved.nameEs}</p>
                  <p className="text-xs text-muted-foreground">Zona horaria de referencia</p>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hora principal
                </p>
                <p className="text-3xl font-bold tabular-nums text-primary">
                  {formatTimeOnly(saved.defaultTimezone)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTimeInTimezone(saved.defaultTimezone)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Horas en distintas regiones
                </p>
                <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                  {saved.regions.map(region => (
                    <div
                      key={region.timezone + region.label}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm',
                        region.timezone === saved.defaultTimezone
                          ? 'border border-primary/20 bg-primary/10'
                          : 'bg-secondary/40',
                      )}
                    >
                      <span className="truncate text-muted-foreground">{region.label}</span>
                      <span className="shrink-0 font-mono font-semibold tabular-nums">
                        {formatTimeOnly(region.timezone)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
