'use server'

import React from 'react'
import { createHash } from 'crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { checkVaultUploadAllowedAction } from '@/app/actions/vault-documents-actions'
import {
  isAllowedVaultUpload,
  resolveVaultUploadContentType,
  inferVaultUploadFileType,
  VAULT_MAX_UPLOAD_BYTES,
} from '@/lib/vault-upload'
import {
  applyTax,
  computeLineTotals,
  type PurchaseInvoiceLine,
  type PurchaseInvoiceStatus,
  type QuotationLine,
  type QuotationLineInput,
  type QuotationStatus,
  type SupplierCompany,
  type SupplierPurchaseInvoice,
  type SupplierQuotation,
} from '@/lib/proveedores/types'
import {
  computePurchaseLineTotal,
  type PurchaseOrderLineItemInput,
} from '@/lib/proveedores/purchase-order-lines'
import {
  fetchProfileLogoDataUri,
  resolveProfileLogoUrl,
} from '@/lib/proveedores/resolve-profile-logo'
import {
  PurchaseOrderPdfDocument,
  type PurchaseOrderPdfData,
} from '@/lib/proveedores/purchase-order-pdf'

const REVALIDATE_PATHS = [
  '/dashboard/proveedores',
  '/dashboard/proveedores/empresas',
  '/dashboard/proveedores/cotizaciones',
  '/dashboard/proveedores/facturas',
]

function revalidateProveedores() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function parseLinesJson(raw: string | null | undefined): QuotationLineInput[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as QuotationLineInput[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(l => l.description?.trim())
  } catch {
    return []
  }
}

function mapSupplier(row: Record<string, unknown>): SupplierCompany {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    company_name: String(row.company_name ?? ''),
    tax_id: String(row.tax_id ?? ''),
    contact_name: String(row.contact_name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    notes: String(row.notes ?? ''),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapQuotationLine(row: Record<string, unknown>): QuotationLine {
  return {
    id: String(row.id),
    quotation_id: String(row.quotation_id),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit ?? 'unit'),
    unit_price_net: Number(row.unit_price_net) || 0,
    line_total_net: Number(row.line_total_net) || 0,
    sort_order: Number(row.sort_order) || 0,
  }
}

function mapInvoiceLine(row: Record<string, unknown>): PurchaseInvoiceLine {
  return {
    id: String(row.id),
    invoice_id: String(row.invoice_id),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit ?? 'unit'),
    unit_price_net: Number(row.unit_price_net) || 0,
    line_total_net: Number(row.line_total_net) || 0,
    sort_order: Number(row.sort_order) || 0,
  }
}

function syntheticQuoteLine(quote: Record<string, unknown>): QuotationLine | null {
  const amount = Number(quote.total_amount) || Number(quote.subtotal_net) || 0
  if (amount <= 0) return null
  return {
    id: '__quote_total__',
    quotation_id: String(quote.id),
    description: String(quote.title || quote.reference || 'Total cotización'),
    quantity: 1,
    unit: 'unit',
    unit_price_net: amount,
    line_total_net: amount,
    sort_order: 0,
  }
}

function mapQuotation(
  row: Record<string, unknown>,
  supplier?: Record<string, unknown> | null,
): SupplierQuotation {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    supplier_id: row.supplier_id != null ? String(row.supplier_id) : null,
    reference: String(row.reference ?? ''),
    title: String(row.title ?? ''),
    quote_date: String(row.quote_date ?? ''),
    valid_until: row.valid_until != null ? String(row.valid_until) : null,
    status: String(row.status ?? 'pending') as QuotationStatus,
    currency: String(row.currency ?? 'CLP'),
    subtotal_net: Number(row.subtotal_net) || 0,
    tax_rate: Number(row.tax_rate) || 19,
    tax_amount: Number(row.tax_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    notes: String(row.notes ?? ''),
    file_storage_path: row.file_storage_path != null ? String(row.file_storage_path) : null,
    file_name: row.file_name != null ? String(row.file_name) : null,
    file_size: Number(row.file_size) || 0,
    file_type: row.file_type != null ? String(row.file_type) : null,
    file_content_hash: row.file_content_hash != null ? String(row.file_content_hash) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    supplier: supplier
      ? {
          id: String(supplier.id),
          company_name: String(supplier.company_name ?? ''),
          tax_id: String(supplier.tax_id ?? ''),
        }
      : undefined,
    has_invoice: Boolean(row.has_invoice),
  }
}

function mapInvoice(
  row: Record<string, unknown>,
  supplier?: Record<string, unknown> | null,
  quotation?: Record<string, unknown> | null,
  lines?: PurchaseInvoiceLine[],
): SupplierPurchaseInvoice {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    supplier_id: String(row.supplier_id),
    quotation_id: row.quotation_id != null ? String(row.quotation_id) : null,
    invoice_number: String(row.invoice_number ?? ''),
    issue_date: String(row.issue_date ?? ''),
    due_date: row.due_date != null ? String(row.due_date) : null,
    status: String(row.status ?? 'draft') as PurchaseInvoiceStatus,
    currency: String(row.currency ?? 'CLP'),
    subtotal_net: Number(row.subtotal_net) || 0,
    tax_rate: Number(row.tax_rate) || 19,
    tax_amount: Number(row.tax_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    notes: String(row.notes ?? ''),
    file_storage_path: row.file_storage_path != null ? String(row.file_storage_path) : null,
    file_name: row.file_name != null ? String(row.file_name) : null,
    file_size: Number(row.file_size) || 0,
    file_type: row.file_type != null ? String(row.file_type) : null,
    registro_compras_sii_id:
      row.registro_compras_sii_id != null ? String(row.registro_compras_sii_id) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    supplier: supplier
      ? {
          id: String(supplier.id),
          company_name: String(supplier.company_name ?? ''),
          tax_id: String(supplier.tax_id ?? ''),
        }
      : undefined,
    quotation: quotation
      ? {
          id: String(quotation.id),
          reference: String(quotation.reference ?? ''),
          title: String(quotation.title ?? ''),
        }
      : undefined,
    lines,
  }
}

async function requireOwnerId(): Promise<string | null> {
  const supabase = await createClient()
  return getDataOwnerId(supabase)
}

export async function listSuppliersAction(): Promise<{ ok: true; data: SupplierCompany[] } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_companies')
    .select('*')
    .eq('user_id', ownerId)
    .order('company_name')

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapSupplier(r as Record<string, unknown>)) }
}

export async function saveSupplierAction(input: {
  id?: string
  company_name: string
  tax_id?: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  is_active?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  if (!input.company_name.trim()) return { ok: false, message: 'Company name is required' }

  const supabase = await createClient()
  const payload = {
    user_id: ownerId,
    company_name: input.company_name.trim(),
    tax_id: (input.tax_id ?? '').trim(),
    contact_name: (input.contact_name ?? '').trim(),
    email: (input.email ?? '').trim(),
    phone: (input.phone ?? '').trim(),
    address: (input.address ?? '').trim(),
    notes: (input.notes ?? '').trim(),
    is_active: input.is_active ?? true,
  }

  if (input.id) {
    const { error } = await supabase
      .from('supplier_companies')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', ownerId)
    if (error) return { ok: false, message: error.message }
    revalidateProveedores()
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('supplier_companies')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, message: error?.message ?? 'Insert failed' }
  revalidateProveedores()
  return { ok: true, id: String(data.id) }
}

function normalizeSupplierName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

async function findOrCreateSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  companyName: string,
  taxId?: string,
): Promise<{ ok: true; id: string; created: boolean } | { ok: false; message: string }> {
  const normalized = normalizeSupplierName(companyName)
  if (!normalized) return { ok: false, message: 'Company name is required' }

  const { data: existing } = await supabase
    .from('supplier_companies')
    .select('id, company_name, tax_id')
    .eq('user_id', ownerId)
    .ilike('company_name', normalized)
    .maybeSingle()

  if (existing) {
    if (taxId?.trim() && !existing.tax_id) {
      await supabase
        .from('supplier_companies')
        .update({ tax_id: taxId.trim() })
        .eq('id', existing.id)
        .eq('user_id', ownerId)
    }
    return { ok: true, id: String(existing.id), created: false }
  }

  const { data: all } = await supabase
    .from('supplier_companies')
    .select('id, company_name, tax_id')
    .eq('user_id', ownerId)

  const fuzzy = (all ?? []).find(
    row => normalizeSupplierName(String(row.company_name)).toLowerCase() === normalized.toLowerCase(),
  )
  if (fuzzy) {
    if (taxId?.trim() && !fuzzy.tax_id) {
      await supabase
        .from('supplier_companies')
        .update({ tax_id: taxId.trim() })
        .eq('id', fuzzy.id)
        .eq('user_id', ownerId)
    }
    return { ok: true, id: String(fuzzy.id), created: false }
  }

  const { data: inserted, error } = await supabase
    .from('supplier_companies')
    .insert({
      user_id: ownerId,
      company_name: normalized,
      tax_id: (taxId ?? '').trim(),
    })
    .select('id')
    .single()

  if (error || !inserted) return { ok: false, message: error?.message ?? 'Could not create supplier' }
  return { ok: true, id: String(inserted.id), created: true }
}

export async function deleteSupplierAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('supplier_companies')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateProveedores()
  return { ok: true }
}

export async function listQuotationsAction(): Promise<
  { ok: true; data: SupplierQuotation[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_quotations')
    .select('*, supplier:supplier_id (id, company_name, tax_id)')
    .eq('user_id', ownerId)
    .order('quote_date', { ascending: false })

  if (error) return { ok: false, message: error.message }

  const ids = (data ?? []).map(r => String(r.id))
  let invoiceQuotationIds = new Set<string>()
  if (ids.length > 0) {
    const { data: inv } = await supabase
      .from('supplier_purchase_invoices')
      .select('quotation_id')
      .eq('user_id', ownerId)
      .in('quotation_id', ids)
    invoiceQuotationIds = new Set(
      (inv ?? []).map(i => String(i.quotation_id)).filter(Boolean),
    )
  }

  return {
    ok: true,
    data: (data ?? []).map(row => {
      const r = row as Record<string, unknown>
      const supplier = r.supplier as Record<string, unknown> | null
      return mapQuotation(
        { ...r, has_invoice: invoiceQuotationIds.has(String(r.id)) },
        supplier,
      )
    }),
  }
}

export async function getQuotationDetailAction(
  id: string,
): Promise<
  { ok: true; data: SupplierQuotation & { lines: QuotationLine[] } } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data: quote, error } = await supabase
    .from('supplier_quotations')
    .select('*, supplier:supplier_id (id, company_name, tax_id)')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single()

  if (error || !quote) return { ok: false, message: 'Quotation not found' }

  const { data: lineRows } = await supabase
    .from('supplier_quotation_lines')
    .select('*')
    .eq('quotation_id', id)
    .order('sort_order')

  let lines = (lineRows ?? []).map(r => mapQuotationLine(r as Record<string, unknown>))
  if (lines.length === 0) {
    const synthetic = syntheticQuoteLine(quote as Record<string, unknown>)
    if (synthetic) lines = [synthetic]
  }

  const r = quote as Record<string, unknown>
  const supplier = r.supplier as Record<string, unknown> | null
  return {
    ok: true,
    data: { ...mapQuotation(r, supplier), lines },
  }
}

export async function updateQuotationAction(input: {
  id: string
  supplier_id?: string | null
  reference?: string
  title?: string
  quote_date?: string
  currency?: string
  notes?: string
  lines?: QuotationLineInput[]
  subtotal_net?: number
  total_amount?: number
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('supplier_quotations')
    .select('id')
    .eq('id', input.id)
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!existing) return { ok: false, message: 'Quotation not found' }

  const taxRate = 0
  const lines = (input.lines ?? []).filter(l => l.description?.trim())
  let subtotal_net = Number(input.subtotal_net) || Number(input.total_amount) || 0
  if (lines.length > 0) {
    subtotal_net = computeLineTotals(lines).subtotal_net
  }
  const { tax_amount, total_amount } = applyTax(subtotal_net, taxRate)

  const patch: Record<string, unknown> = {
    subtotal_net,
    tax_rate: taxRate,
    tax_amount,
    total_amount,
    status: 'accepted',
  }
  if (input.supplier_id !== undefined) patch.supplier_id = input.supplier_id || null
  if (input.reference !== undefined) patch.reference = input.reference.trim()
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.quote_date !== undefined) patch.quote_date = input.quote_date
  if (input.currency !== undefined) patch.currency = input.currency.trim() || 'CLP'
  if (input.notes !== undefined) patch.notes = input.notes.trim()

  const { error } = await supabase
    .from('supplier_quotations')
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }

  await supabase.from('supplier_quotation_lines').delete().eq('quotation_id', input.id)

  if (lines.length > 0) {
    const lineRows = computeLineTotals(lines).lines.map((line, idx) => ({
      quotation_id: input.id,
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim() || 'unit',
      unit_price_net: line.unit_price_net,
      line_total_net: line.line_total_net,
      sort_order: idx,
    }))
    await supabase.from('supplier_quotation_lines').insert(lineRows)
  }

  revalidateProveedores()
  return { ok: true }
}

export async function uploadQuotationAction(formData: FormData): Promise<
  { ok: true; id: string } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supplierId = String(formData.get('supplier_id') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const quoteDate = String(formData.get('quote_date') ?? '').trim() || new Date().toISOString().slice(0, 10)
  const validUntil = String(formData.get('valid_until') ?? '').trim() || null
  const taxRate = Number(formData.get('tax_rate') ?? 0) || 0
  const currency = String(formData.get('currency') ?? 'CLP').trim() || 'CLP'
  const notes = String(formData.get('notes') ?? '').trim()
  const status = (String(formData.get('status') ?? 'accepted').trim() || 'accepted') as QuotationStatus
  const lines = parseLinesJson(String(formData.get('lines_json') ?? ''))
  const file = formData.get('file') as File | null

  const supabase = await createClient()

  const resolvedReference =
    reference
    || (file?.name ? file.name.replace(/\.[^.]+$/, '').slice(0, 80) : '')
    || `COT-${Date.now()}`

  if (!file || file.size === 0) {
    return { ok: false, message: 'Quotation file is required' }
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const fileContentHash = createHash('sha256').update(fileBuffer).digest('hex')

  const { data: duplicateByHash } = await supabase
    .from('supplier_quotations')
    .select('reference')
    .eq('user_id', ownerId)
    .eq('file_content_hash', fileContentHash)
    .maybeSingle()

  if (duplicateByHash) {
    return {
      ok: false,
      message: `Este archivo ya está subido (cotización ${duplicateByHash.reference})`,
    }
  }

  const { data: duplicateByLegacyMeta } = await supabase
    .from('supplier_quotations')
    .select('reference')
    .eq('user_id', ownerId)
    .is('file_content_hash', null)
    .eq('file_name', file.name)
    .eq('file_size', file.size)
    .gt('file_size', 0)
    .maybeSingle()

  if (duplicateByLegacyMeta) {
    return {
      ok: false,
      message: `Este archivo ya está subido (cotización ${duplicateByLegacyMeta.reference})`,
    }
  }

  let subtotal_net = Number(formData.get('subtotal_net') ?? 0) || 0
  const totalFromForm = Number(formData.get('total_amount') ?? 0) || 0
  if (lines.length > 0) {
    subtotal_net = computeLineTotals(lines).subtotal_net
  } else if (subtotal_net <= 0 && totalFromForm > 0) {
    subtotal_net = Math.round((totalFromForm / (1 + taxRate / 100)) * 100) / 100
  }
  const { tax_amount, total_amount } = applyTax(subtotal_net, taxRate)

  const { data: inserted, error: insertError } = await supabase
    .from('supplier_quotations')
    .insert({
      user_id: ownerId,
      supplier_id: supplierId,
      reference: resolvedReference,
      title: title || resolvedReference,
      quote_date: quoteDate,
      valid_until: validUntil,
      status,
      currency,
      subtotal_net,
      tax_rate: taxRate,
      tax_amount,
      total_amount,
      notes,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { ok: false, message: insertError?.message ?? 'Could not save quotation' }
  }

  const quotationId = String(inserted.id)

  if (lines.length > 0) {
    const lineRows = computeLineTotals(lines).lines.map((line, idx) => ({
      quotation_id: quotationId,
      description: line.description.trim(),
      quantity: line.quantity,
      unit: line.unit.trim() || 'unit',
      unit_price_net: line.unit_price_net,
      line_total_net: line.line_total_net,
      sort_order: idx,
    }))
    await supabase.from('supplier_quotation_lines').insert(lineRows)
  }

  if (!isAllowedVaultUpload({ name: file.name, type: file.type })) {
    await supabase.from('supplier_quotations').delete().eq('id', quotationId)
    return { ok: false, message: 'File type not allowed' }
  }
  if (file.size > VAULT_MAX_UPLOAD_BYTES) {
    await supabase.from('supplier_quotations').delete().eq('id', quotationId)
    return { ok: false, message: 'File exceeds 10 MB limit' }
  }
  const quota = await checkVaultUploadAllowedAction(file.size)
  if (!quota.ok) {
    await supabase.from('supplier_quotations').delete().eq('id', quotationId)
    return { ok: false, message: quota.message ?? 'Storage quota exceeded' }
  }

  const service = getServiceClient()
  if (!service) {
    await supabase.from('supplier_quotations').delete().eq('id', quotationId)
    return { ok: false, message: 'Storage unavailable' }
  }

  const safeName = file.name.replace(/[^\w.\-()+\s]/g, '_')
  const storagePath = `${ownerId}/proveedores/cotizaciones/${quotationId}/${Date.now()}_${safeName}`
  const { error: uploadError } = await service.storage.from('boveda').upload(storagePath, fileBuffer, {
    contentType: resolveVaultUploadContentType(file),
    upsert: false,
  })

  if (uploadError) {
    await supabase.from('supplier_quotations').delete().eq('id', quotationId)
    return { ok: false, message: uploadError.message }
  }

  await supabase
    .from('supplier_quotations')
    .update({
      file_storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      file_type: inferVaultUploadFileType(file),
      file_content_hash: fileContentHash,
    })
    .eq('id', quotationId)
    .eq('user_id', ownerId)

  revalidateProveedores()
  return { ok: true, id: quotationId }
}

export async function updateQuotationStatusAction(
  id: string,
  status: QuotationStatus,
): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()

  if (status === 'accepted') {
    const { data: quote } = await supabase
      .from('supplier_quotations')
      .select('supplier_id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .maybeSingle()
    if (!quote?.supplier_id) {
      return { ok: false, message: 'Assign a supplier company before accepting the quotation' }
    }
  }

  const { error } = await supabase
    .from('supplier_quotations')
    .update({ status })
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateProveedores()
  return { ok: true }
}

export async function assignSupplierToQuotationsAction(input: {
  quotation_ids: string[]
  supplier_id: string
}): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supplierId = input.supplier_id.trim()
  const ids = [...new Set(input.quotation_ids.map(id => id.trim()).filter(Boolean))]
  if (!supplierId) return { ok: false, message: 'Supplier is required' }
  if (ids.length === 0) return { ok: false, message: 'No quotations selected' }

  const supabase = await createClient()

  const { data: supplier, error: supplierError } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('id', supplierId)
    .eq('user_id', ownerId)
    .maybeSingle()

  if (supplierError || !supplier) {
    return { ok: false, message: 'Supplier company not found' }
  }

  const { data: updatedRows, error } = await supabase
    .from('supplier_quotations')
    .update({ supplier_id: supplierId })
    .eq('user_id', ownerId)
    .in('id', ids)
    .select('id')

  if (error) return { ok: false, message: error.message }

  revalidateProveedores()
  return { ok: true, updated: updatedRows?.length ?? 0 }
}

export async function deleteQuotationAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('supplier_quotations')
    .select('file_storage_path')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle()

  const { error } = await supabase
    .from('supplier_quotations')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }

  const path = row?.file_storage_path
  if (path) {
    const service = getServiceClient()
    await service?.storage.from('boveda').remove([String(path)])
  }

  revalidateProveedores()
  return { ok: true }
}

export async function issuePurchaseInvoiceFromQuotationAction(input: {
  quotation_id: string
  invoice_number: string
  issue_date: string
  due_date?: string | null
  notes?: string
  /** @deprecated use line_items */
  line_ids?: string[]
  line_items?: PurchaseOrderLineItemInput[]
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  if (!input.invoice_number.trim()) return { ok: false, message: 'Invoice number is required' }

  const supabase = await createClient()
  const { data: quote, error: quoteError } = await supabase
    .from('supplier_quotations')
    .select('*')
    .eq('id', input.quotation_id)
    .eq('user_id', ownerId)
    .single()

  if (quoteError || !quote) return { ok: false, message: 'Quotation not found' }
  if (!quote.supplier_id) {
    return { ok: false, message: 'Assign a supplier company before issuing an invoice' }
  }
  if (quote.status === 'rejected') {
    return { ok: false, message: 'Rejected quotations cannot be invoiced' }
  }

  const { data: supplierRow } = await supabase
    .from('supplier_companies')
    .select('*')
    .eq('id', quote.supplier_id)
    .eq('user_id', ownerId)
    .single()

  const service = getServiceClient()
  const profileReader = service ?? supabase

  const { data: profile } = await profileReader
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', ownerId)
    .maybeSingle()

  let avatarOriginalUrl: string | null = null
  if (service) {
    const { data: ext, error } = await service
      .from('profiles')
      .select('avatar_original_url')
      .eq('id', ownerId)
      .maybeSingle()
    if (!error && ext?.avatar_original_url) {
      avatarOriginalUrl = String(ext.avatar_original_url)
    }
  }

  const logoUrl = resolveProfileLogoUrl(
    profile?.avatar_url != null ? String(profile.avatar_url) : null,
    avatarOriginalUrl,
  )
  const logoSrc = logoUrl ? await fetchProfileLogoDataUri(logoUrl, service) : null

  const { data: dbLines } = await supabase
    .from('supplier_quotation_lines')
    .select('*')
    .eq('quotation_id', input.quotation_id)
    .order('sort_order')

  const allLines = (dbLines ?? []).map(r => mapQuotationLine(r as Record<string, unknown>))

  let selectedLines: Array<{
    description: string
    quantity: number
    unit: string
    unit_price_net: number
    line_total_net: number
  }>

  if (allLines.length > 0) {
    const realLines = allLines.filter(l => l.id !== '__quote_total__')
    const lineItems =
      input.line_items?.filter(i => i.line_id && i.quantity > 0)
      ?? (input.line_ids ?? [])
        .filter(id => id && id !== '__quote_total__')
        .map(id => {
          const src = realLines.find(l => l.id === id)
          return src ? { line_id: id, quantity: src.quantity } : null
        })
        .filter((x): x is PurchaseOrderLineItemInput => x != null)

    if (lineItems.length === 0) {
      return { ok: false, message: 'Indica cantidad en al menos un producto' }
    }

    selectedLines = []
    for (const item of lineItems) {
      const source = realLines.find(l => l.id === item.line_id)
      if (!source) {
        return { ok: false, message: 'Invalid line item' }
      }
      const qty = Math.round(Number(item.quantity) * 10000) / 10000
      if (qty <= 0) continue
      selectedLines.push({
        description: source.description,
        quantity: qty,
        unit: source.unit,
        unit_price_net: source.unit_price_net,
        line_total_net: computePurchaseLineTotal(qty, source.unit_price_net),
      })
    }

    if (selectedLines.length === 0) {
      return { ok: false, message: 'Indica cantidad en al menos un producto' }
    }
  } else {
    const synthetic = syntheticQuoteLine(quote as Record<string, unknown>)
    if (!synthetic) {
      return { ok: false, message: 'Quotation has no line items to invoice' }
    }
    selectedLines = [synthetic]
  }

  const subtotal_net = Math.round(selectedLines.reduce((s, l) => s + l.line_total_net, 0) * 100) / 100
  const tax_rate = Number(quote.tax_rate) || 0
  const { tax_amount, total_amount } = applyTax(subtotal_net, tax_rate)
  const mergedNotes = (input.notes ?? quote.notes ?? '').trim()

  const { data: invoice, error: invError } = await supabase
    .from('supplier_purchase_invoices')
    .insert({
      user_id: ownerId,
      supplier_id: quote.supplier_id,
      quotation_id: input.quotation_id,
      invoice_number: input.invoice_number.trim(),
      issue_date: input.issue_date,
      due_date: input.due_date ?? null,
      status: 'issued',
      currency: quote.currency,
      subtotal_net,
      tax_rate,
      tax_amount,
      total_amount,
      notes: mergedNotes,
    })
    .select('id')
    .single()

  if (invError || !invoice) return { ok: false, message: invError?.message ?? 'Could not issue invoice' }

  const invoiceId = String(invoice.id)

  await supabase.from('supplier_purchase_invoice_lines').insert(
    selectedLines.map((line, idx) => ({
      invoice_id: invoiceId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price_net: line.unit_price_net,
      line_total_net: line.line_total_net,
      sort_order: idx,
    })),
  )

  const pdfData: PurchaseOrderPdfData = {
    orderNumber: input.invoice_number.trim(),
    issueDate: input.issue_date,
    currency: String(quote.currency ?? 'CLP'),
    buyer: {
      name: String(profile?.full_name ?? 'Empresa'),
      email: profile?.email ? String(profile.email) : undefined,
      logoSrc,
    },
    supplier: {
      name: String(supplierRow?.company_name ?? ''),
      taxId: supplierRow?.tax_id ? String(supplierRow.tax_id) : undefined,
      address: supplierRow?.address ? String(supplierRow.address) : undefined,
      contactName: supplierRow?.contact_name ? String(supplierRow.contact_name) : undefined,
      email: supplierRow?.email ? String(supplierRow.email) : undefined,
      phone: supplierRow?.phone ? String(supplierRow.phone) : undefined,
    },
    lines: selectedLines.map(l => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unit_price_net: l.unit_price_net,
      line_total_net: l.line_total_net,
    })),
    subtotal_net,
    tax_rate,
    tax_amount,
    total_amount,
    notes: mergedNotes,
    quotationReference: quote.reference ? String(quote.reference) : undefined,
  }

  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(PurchaseOrderPdfDocument, { data: pdfData }),
    )
    if (service) {
      const safeNumber = input.invoice_number.trim().replace(/[^\w.\-()+\s]/g, '_')
      const storagePath = `${ownerId}/proveedores/ordenes-compra/${invoiceId}/OC_${safeNumber}.pdf`
      const { error: uploadError } = await service.storage.from('boveda').upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (!uploadError) {
        await supabase
          .from('supplier_purchase_invoices')
          .update({
            file_storage_path: storagePath,
            file_name: `OC_${safeNumber}.pdf`,
            file_size: pdfBuffer.length,
            file_type: 'pdf',
          })
          .eq('id', invoiceId)
          .eq('user_id', ownerId)
      }
    }
  } catch (err) {
    console.error('Purchase order PDF generation failed:', err)
  }

  revalidateProveedores()
  return { ok: true, id: invoiceId }
}

export async function listPurchaseInvoicesAction(): Promise<
  { ok: true; data: SupplierPurchaseInvoice[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_purchase_invoices')
    .select(
      '*, supplier:supplier_id (id, company_name, tax_id), quotation:quotation_id (id, reference, title)',
    )
    .eq('user_id', ownerId)
    .order('issue_date', { ascending: false })

  if (error) return { ok: false, message: error.message }

  const invoiceIds = (data ?? []).map(r => String(r.id))
  const linesByInvoice = new Map<string, PurchaseInvoiceLine[]>()
  if (invoiceIds.length > 0) {
    const { data: lineRows } = await supabase
      .from('supplier_purchase_invoice_lines')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('sort_order')
    for (const row of lineRows ?? []) {
      const line = mapInvoiceLine(row as Record<string, unknown>)
      const list = linesByInvoice.get(line.invoice_id) ?? []
      list.push(line)
      linesByInvoice.set(line.invoice_id, list)
    }
  }

  return {
    ok: true,
    data: (data ?? []).map(row => {
      const r = row as Record<string, unknown>
      const id = String(r.id)
      return mapInvoice(
        r,
        r.supplier as Record<string, unknown> | null,
        r.quotation as Record<string, unknown> | null,
        linesByInvoice.get(id) ?? [],
      )
    }),
  }
}

export async function updatePurchaseInvoiceStatusAction(
  id: string,
  status: PurchaseInvoiceStatus,
): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('supplier_purchase_invoices')
    .update({ status })
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateProveedores()
  return { ok: true }
}

export async function getQuotationFileUrlAction(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('supplier_quotations')
    .select('file_storage_path')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!data?.file_storage_path) return { ok: false, message: 'No file attached' }

  const service = getServiceClient()
  if (!service) return { ok: false, message: 'Storage unavailable' }

  const { data: signed, error } = await service.storage
    .from('boveda')
    .createSignedUrl(String(data.file_storage_path), 3600)

  if (error || !signed?.signedUrl) return { ok: false, message: error?.message ?? 'Could not sign URL' }
  return { ok: true, url: signed.signedUrl }
}

export async function getPurchaseInvoiceFileUrlAction(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('supplier_purchase_invoices')
    .select('file_storage_path')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!data?.file_storage_path) return { ok: false, message: 'No purchase order PDF generated' }

  const service = getServiceClient()
  if (!service) return { ok: false, message: 'Storage unavailable' }

  const { data: signed, error } = await service.storage
    .from('boveda')
    .createSignedUrl(String(data.file_storage_path), 3600)

  if (error || !signed?.signedUrl) return { ok: false, message: error?.message ?? 'Could not sign URL' }
  return { ok: true, url: signed.signedUrl }
}
