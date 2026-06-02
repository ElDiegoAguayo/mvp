export type QuotationStatus = 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired'
export type PurchaseInvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export interface SupplierCompany {
  id: string
  user_id: string
  company_name: string
  tax_id: string
  contact_name: string
  email: string
  phone: string
  address: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuotationLine {
  id: string
  quotation_id: string
  description: string
  quantity: number
  unit: string
  unit_price_net: number
  line_total_net: number
  sort_order: number
}

export interface SupplierQuotation {
  id: string
  user_id: string
  supplier_id: string | null
  reference: string
  title: string
  quote_date: string
  valid_until: string | null
  status: QuotationStatus
  currency: string
  subtotal_net: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes: string
  file_storage_path: string | null
  file_name: string | null
  file_size: number
  file_type: string | null
  file_content_hash: string | null
  created_at: string
  updated_at: string
  supplier?: Pick<SupplierCompany, 'id' | 'company_name' | 'tax_id'>
  lines?: QuotationLine[]
  has_invoice?: boolean
}

export interface PurchaseInvoiceLine {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit: string
  unit_price_net: number
  line_total_net: number
  sort_order: number
}

export interface SupplierPurchaseInvoice {
  id: string
  user_id: string
  supplier_id: string
  quotation_id: string | null
  invoice_number: string
  issue_date: string
  due_date: string | null
  status: PurchaseInvoiceStatus
  currency: string
  subtotal_net: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes: string
  file_storage_path: string | null
  file_name: string | null
  file_size: number
  file_type: string | null
  registro_compras_sii_id: string | null
  created_at: string
  updated_at: string
  supplier?: Pick<SupplierCompany, 'id' | 'company_name' | 'tax_id'>
  quotation?: Pick<SupplierQuotation, 'id' | 'reference' | 'title'>
  lines?: PurchaseInvoiceLine[]
}

export interface QuotationLineInput {
  description: string
  quantity: number
  unit: string
  unit_price_net: number
}

export function computeLineTotals(lines: QuotationLineInput[]): {
  subtotal_net: number
  tax_amount: number
  total_amount: number
  lines: Array<QuotationLineInput & { line_total_net: number }>
} {
  const mapped = lines.map(line => {
    const qty = Number(line.quantity) || 0
    const price = Number(line.unit_price_net) || 0
    return { ...line, line_total_net: Math.round(qty * price * 100) / 100 }
  })
  const subtotal_net = mapped.reduce((s, l) => s + l.line_total_net, 0)
  return {
    subtotal_net,
    tax_amount: 0,
    total_amount: subtotal_net,
    lines: mapped,
  }
}

export function applyTax(subtotal_net: number, tax_rate: number): { tax_amount: number; total_amount: number } {
  const tax_amount = Math.round(subtotal_net * (tax_rate / 100) * 100) / 100
  return { tax_amount, total_amount: Math.round((subtotal_net + tax_amount) * 100) / 100 }
}
