export function formatKg(kg: number): string {
  if (!Number.isFinite(kg)) return '0 kg'
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(2)} mil t`
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(1)} t`
  return `${Math.round(kg).toLocaleString('es-CL')} kg`
}

export function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.min(100, Math.round((value / total) * 100))}%`
}

export function currentSeasonLabel(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}
