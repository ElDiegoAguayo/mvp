export interface PhenologyStageRef {
  id: string
  stage_name: string
  stage_code: string | null
  sort_order: number
  typical_days: number | null
}

export interface PhenologyObsRef {
  block_name: string
  stage_name: string
  stage_id: string | null
  observed_at: string
  season_label: string
  images?: unknown[]
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function predictNextStage(
  observation: PhenologyObsRef,
  stages: PhenologyStageRef[],
): { nextStageName: string; expectedDate: string } | null {
  if (stages.length === 0) return null

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  let currentIdx = -1

  if (observation.stage_id) {
    currentIdx = sorted.findIndex((s) => s.id === observation.stage_id)
  }
  if (currentIdx < 0) {
    const normalized = observation.stage_name.trim().toLowerCase()
    currentIdx = sorted.findIndex((s) => s.stage_name.trim().toLowerCase() === normalized)
  }
  if (currentIdx < 0) return null

  const current = sorted[currentIdx]
  const next = sorted[currentIdx + 1]
  if (!next) return null

  const days = current.typical_days ?? next.typical_days
  if (days == null || days <= 0) return null

  return {
    nextStageName: next.stage_name,
    expectedDate: addDaysIso(observation.observed_at, days),
  }
}

export interface PhenologyAlert {
  type: 'no_photo' | 'no_reading' | 'prediction'
  block_name: string
  message: string
}

export function buildPhenologyAlerts(
  observations: PhenologyObsRef[],
  stages: PhenologyStageRef[],
): PhenologyAlert[] {
  const alerts: PhenologyAlert[] = []
  const byBlock = new Map<string, PhenologyObsRef[]>()

  for (const obs of observations) {
    const list = byBlock.get(obs.block_name) ?? []
    list.push(obs)
    byBlock.set(obs.block_name, list)
  }

  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = addDaysIso(today, -7)

  for (const [blockName, list] of byBlock) {
    const sorted = [...list].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    const latest = sorted[0]
    if (!latest) continue

    const recent = sorted.filter((o) => o.observed_at >= weekAgo)
    const recentWithPhoto = recent.some((o) => (o.images?.length ?? 0) > 0)
    if (recent.length > 0 && !recentWithPhoto) {
      alerts.push({
        type: 'no_photo',
        block_name: blockName,
        message: `${blockName}: sin fotos en la última semana`,
      })
    }

    const prediction = predictNextStage(latest, stages)
    if (prediction) {
      alerts.push({
        type: 'prediction',
        block_name: blockName,
        message: `${blockName}: próxima etapa «${prediction.nextStageName}» ~${fmtShortDate(prediction.expectedDate)}`,
      })
    }
  }

  if (observations.length === 0) {
    alerts.push({
      type: 'no_reading',
      block_name: '—',
      message: 'Sin lecturas en esta temporada — registra la primera semana',
    })
  }

  return alerts.slice(0, 8)
}

const HARVEST_HINT_STAGES = [
  'floración',
  'floracion',
  'cuaja',
  'cuajado',
  'fruto',
  'cosecha',
]

export function suggestsHarvestCount(stageName: string, crop: string): boolean {
  if (crop !== 'Cerezo') return false
  const lower = stageName.toLowerCase()
  return HARVEST_HINT_STAGES.some((hint) => lower.includes(hint))
}
