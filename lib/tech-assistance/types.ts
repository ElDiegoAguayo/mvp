export const TECH_ASSISTANCE_IVA_RATE = 0.19

export type TechBillingUnit = 'hectare' | 'day'

export type TechProformaStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'

export interface TechAssistanceService {
  id: string
  user_id: string
  name: string
  billing_unit: TechBillingUnit
  unit_price_net: number
  is_active: boolean
  period_start: string | null
  period_end: string | null
  location_label: string | null
  location_id: string | null
  created_at: string
  tech_assistance_locations?: TechAssistanceLocation | null
}

export interface TechAssistanceLocation {
  id: string
  name: string
  lat: number
  lng: number
  radius_meters: number
  search_query?: string | null
}

export interface TechAssistanceEntry {
  id: string
  user_id: string
  service_id: string
  work_date: string
  inspector_name: string
  started_at: string | null
  ended_at: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_out_lat: number | null
  check_out_lng: number | null
  billing_unit: TechBillingUnit
  quantity: number
  unit_price_net: number
  amount_net: number
  amount_iva: number
  amount_total: number
  notes: string | null
  location_label: string | null
  location_id: string | null
  attendance_value: number
  regular_hours: number | null
  overtime_hours: number | null
  proforma_id: string | null
  created_at: string
  tech_assistance_services?: { name: string } | null
}

export interface TechAssistanceProforma {
  id: string
  user_id: string
  proforma_number: string
  period_start: string
  period_end: string
  status: TechProformaStatus
  subtotal_net: number
  iva_amount: number
  total_amount: number
  approved_at: string | null
  notes: string | null
  created_at: string
}

export function calculateTechAmounts(quantity: number, unitPriceNet: number) {
  const amount_net = Math.round(quantity * unitPriceNet * 100) / 100
  const amount_iva = Math.round(amount_net * TECH_ASSISTANCE_IVA_RATE * 100) / 100
  const amount_total = Math.round((amount_net + amount_iva) * 100) / 100
  return { amount_net, amount_iva, amount_total }
}

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function billingUnitLabel(unit: TechBillingUnit, t?: TranslateFn): string {
  if (t) return t(`asistenciaTecnica.billingUnits.${unit}`)
  return unit === 'hectare' ? 'Hectárea' : 'Día'
}

export function proformaStatusLabel(status: TechProformaStatus, t?: TranslateFn): string {
  if (t) return t(`asistenciaTecnica.proformaStatus.${status}`)
  switch (status) {
    case 'draft':
      return 'Borrador'
    case 'pending_approval':
      return 'Pendiente de aprobación'
    case 'approved':
      return 'Aprobada'
    case 'rejected':
      return 'Rechazada'
  }
}

export function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}
