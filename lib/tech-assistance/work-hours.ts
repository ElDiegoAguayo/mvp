/** Jornada ordinaria de referencia para separar horas regulares y extras. */
export const STANDARD_REGULAR_HOURS = 8

export type WorkHoursBreakdown = {
  totalHours: number
  regularHours: number
  overtimeHours: number
}

export function computeWorkHoursFromTimestamps(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  standardRegularHours = STANDARD_REGULAR_HOURS,
): WorkHoursBreakdown | null {
  if (!startedAt || !endedAt) return null

  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null

  const totalHours = roundHours((end - start) / 3_600_000)
  const regularHours = roundHours(Math.min(totalHours, standardRegularHours))
  const overtimeHours = roundHours(Math.max(0, totalHours - standardRegularHours))

  return { totalHours, regularHours, overtimeHours }
}

export function hoursBreakdownToFormValues(
  breakdown: WorkHoursBreakdown | null,
): { regular_hours: string; overtime_hours: string } {
  if (!breakdown) return { regular_hours: '', overtime_hours: '' }
  return {
    regular_hours: String(breakdown.regularHours),
    overtime_hours: String(breakdown.overtimeHours),
  }
}

export function formatHoursValue(hours: number, locale: 'es' | 'en' = 'es'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(hours)
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}
