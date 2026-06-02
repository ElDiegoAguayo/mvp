import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import {
  extractFromText,
  finalizeParsedQuotation,
  parseChileanNumber,
  normalizeCompanyName,
  type ParsedQuotationFile,
} from '@/lib/proveedores/parse-quotation-text'
import type { QuotationLineInput } from '@/lib/proveedores/types'
import { parseQuotationPdfAction } from '@/app/actions/proveedores-parse-actions'

export type { ParsedQuotationFile } from '@/lib/proveedores/parse-quotation-text'
export { resolveSubtotalFromParsed } from '@/lib/proveedores/parse-quotation-text'

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function headerMatches(header: string, patterns: string[]): boolean {
  return patterns.some(p => header.includes(p))
}

function parseExcelRows(buffer: ArrayBuffer): Partial<ParsedQuotationFile> {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return {}

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false }) as unknown[][]
  if (rows.length === 0) return {}

  const textParts: string[] = []
  for (const row of rows.slice(0, 30)) {
    textParts.push((row as unknown[]).map(c => String(c ?? '')).join(' | '))
  }
  const fromText = extractFromText(textParts.join('\n'))

  const headerRowIdx = rows.findIndex(row =>
    (row as unknown[]).some(cell => {
      const h = normalizeHeader(cell)
      return h && (
        headerMatches(h, ['descripcion', 'producto', 'item', 'detalle'])
        || headerMatches(h, ['proveedor', 'empresa', 'razon'])
        || headerMatches(h, ['total', 'neto', 'monto'])
      )
    }),
  )

  const headerRow = headerRowIdx >= 0 ? (rows[headerRowIdx] as unknown[]) : (rows[0] as unknown[])
  const headers = headerRow.map(normalizeHeader)

  const col = (patterns: string[]) => headers.findIndex(h => headerMatches(h, patterns))

  const companyCol = col(['proveedor', 'empresa', 'razon social', 'emisor', 'vendedor'])
  const descCol = col(['descripcion', 'producto', 'item', 'detalle', 'concepto'])
  const qtyCol = col(['cant', 'qty', 'cantidad'])
  const unitCol = col(['unidad', 'um'])
  const priceCol = col(['precio', 'unitario', 'p unit', 'valor unit'])
  const totalCol = col(['total', 'monto', 'importe'])
  const refCol = col(['referencia', 'cotizacion', 'n cot', 'numero'])
  const rutCol = col(['rut', 'tax'])

  const dataStart = headerRowIdx >= 0 ? headerRowIdx + 1 : 1
  const lines: QuotationLineInput[] = []
  let sumNet = 0

  for (const row of rows.slice(dataStart)) {
    const cells = row as unknown[]
    if (descCol >= 0) {
      const desc = String(cells[descCol] ?? '').trim()
      if (desc) {
        const qty = qtyCol >= 0 ? parseChileanNumber(String(cells[qtyCol] ?? '1')) ?? 1 : 1
        const unit = unitCol >= 0 ? String(cells[unitCol] ?? 'unit').trim() || 'unit' : 'unit'
        let price = priceCol >= 0 ? parseChileanNumber(String(cells[priceCol] ?? '')) : null
        const lineTotal = totalCol >= 0 ? parseChileanNumber(String(cells[totalCol] ?? '')) : null
        if (price == null && lineTotal != null && qty > 0) price = lineTotal / qty
        if (price != null) {
          lines.push({
            description: desc,
            quantity: qty,
            unit,
            unit_price_net: Math.round(price * 100) / 100,
          })
          sumNet += qty * price
        }
      }
    }

    if (companyCol >= 0 && !fromText.companyName) {
      const name = normalizeCompanyName(String(cells[companyCol] ?? ''))
      if (name.length >= 3) fromText.companyName = name
    }
    if (rutCol >= 0 && !fromText.taxId) {
      const rut = String(cells[rutCol] ?? '').match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/i)
      if (rut) fromText.taxId = rut[1].toUpperCase()
    }
    if (refCol >= 0 && !fromText.reference) {
      const ref = String(cells[refCol] ?? '').trim()
      if (ref) fromText.reference = ref
    }
  }

  if (lines.length > 0 && !fromText.subtotalNet) {
    fromText.subtotalNet = Math.round(sumNet * 100) / 100
  }

  return { ...fromText, lines: lines.length > 0 ? lines : fromText.lines }
}

export async function parseQuotationFile(file: File): Promise<ParsedQuotationFile> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.pdf')) {
    const fd = new FormData()
    fd.set('file', file)
    const res = await parseQuotationPdfAction(fd)
    if (res.ok) return res.data
    throw new Error(res.message)
  }

  const buffer = await file.arrayBuffer()
  let partial: Partial<ParsedQuotationFile> = {}

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    partial = parseExcelRows(buffer)
  } else if (lower.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer })
    partial = extractFromText(value)
  }

  return finalizeParsedQuotation(partial, file.name)
}
