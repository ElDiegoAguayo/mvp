import type { PurchaseInvoiceStatus, QuotationStatus } from '@/lib/proveedores/types'

export function formatMoney(value: number, currency = 'CLP', locale = 'es-CL'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'CLP' ? 0 : 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}

export function quotationStatusClass(status: QuotationStatus): string {
  switch (status) {
    case 'accepted':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    case 'rejected':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
    case 'expired':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
    case 'draft':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    default:
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
  }
}

export function invoiceStatusClass(status: PurchaseInvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    case 'issued':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
    case 'cancelled':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
  }
}
