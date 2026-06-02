'use server'

import { extractText, extractTextItems, getDocumentProxy } from 'unpdf'
import type { QuotationLineInput } from '@/lib/proveedores/types'
import {
  extractFromText,
  extractQuoteDateFromLines,
  finalizeParsedQuotation,
  mergeQuotationNotes,
  normalizeNotesText,
  normalizeUnit,
  parseChileanNumber,
  sanitizeQuotationLines,
  type ParsedQuotationFile,
} from '@/lib/proveedores/parse-quotation-text'

const US_LINE_RE =
  /^(.+?)\s+US\s*\$\s*([\d.,]+)\s*(?:\/\s*([A-Za-zÁÉÍÓÚáéíóúñ.]+))?\s*$/i

interface TextItemRow {
  str: string
  x: number
  y: number
}

function parseUsLineFromJoined(joined: string): QuotationLineInput | null {
  const line = joined.replace(/\s+/g, ' ').trim()
  const m = line.match(US_LINE_RE)
  if (!m) return null
  const description = m[1].replace(/^[\d.)•\-]+\s*/, '').replace(/^(unidad|unit)\s+/i, '').trim()
  const price = parseChileanNumber(m[2])
  const unit = normalizeUnit(m[3])
  if (description.length < 8 || price == null || price <= 0) return null
  if (price >= 2000 && price <= 2099) return null
  return { description, quantity: 1, unit, unit_price_net: price }
}

function groupPdfTextRows(pages: TextItemRow[][]): string[] {
  const all = pages.flat().filter(i => i.str.trim())
  if (all.length === 0) return []

  const rows = new Map<number, TextItemRow[]>()
  for (const item of all) {
    const yKey = Math.round(item.y / 2) * 2
    if (!rows.has(yKey)) rows.set(yKey, [])
    rows.get(yKey)!.push(item)
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) =>
      items
        .sort((a, b) => a.x - b.x)
        .map(i => i.str.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(line => line.length > 0)
}

function extractNotesFromPdfItems(pages: TextItemRow[][]): string | null {
  const rowTexts = groupPdfTextRows(pages)
  if (rowTexts.length === 0) return null

  const chunks: string[] = []
  let capturingCommercial = false

  for (const joined of rowTexts) {
    const line = joined.replace(/\s+/g, ' ').trim()
    if (line.length < 4) continue

    if (/seg[uú]n lo solicitado|nos permitimos cotizar|de acuerdo a lo solicitado/i.test(line)) {
      if (!chunks.some(c => /seg[uú]n lo solicitado|nos permitimos cotizar/i.test(c))) {
        chunks.unshift(line)
      }
      continue
    }

    if (/condiciones\s+comerciales|condiciones\s+de\s+(?:venta|pago)/i.test(line)) {
      capturingCommercial = true
      const afterHeader = line
        .replace(/^.*condiciones\s+(?:comerciales|de\s+(?:venta|pago))\s*:?\s*/i, '')
        .trim()
      if (afterHeader.length >= 8) chunks.push(afterHeader)
      continue
    }

    if (capturingCommercial) {
      if (/atentamente|saludos cordiales|sin otro particular|www\.|@/i.test(line)) break
      if (/^US\s*\$/i.test(line)) continue
      if (/^(sub\s*total|total|iva|neto)\b/i.test(line)) continue
      chunks.push(line)
      continue
    }
  }

  if (chunks.length === 0) {
    let startIdx = rowTexts.findIndex(row => /\btotal\b/i.test(row))
    if (startIdx < 0) {
      startIdx = rowTexts.findLastIndex(row => /US\s*\$/i.test(row))
    }
    const tailRows = startIdx >= 0 ? rowTexts.slice(startIdx + 1) : rowTexts.slice(-10)
    const commercialRows = tailRows.filter(row =>
      /pago|entrega|despacho|validez|flete|m[ií]nimo|pedido|cr[eé]dito|contado|plazo/i.test(row)
      && !/US\s*\$/i.test(row)
      && !/^(sub\s*total|total|iva|neto)\b/i.test(row)
      && !/seg[uú]n lo solicitado|nos permitimos cotizar/i.test(row),
    )
    if (commercialRows.length >= 1) {
      return normalizeNotesText(commercialRows.join('\n'))
    }
  }

  return chunks.length > 0 ? normalizeNotesText(chunks.join('\n')) : null
}

function extractLinesFromPdfItems(pages: TextItemRow[][]): QuotationLineInput[] {
  const rowTexts = groupPdfTextRows(pages)
  if (rowTexts.length === 0) return []

  const lines: QuotationLineInput[] = []
  const seen = new Set<string>()

  for (const joined of rowTexts) {
    if (joined.length < 12) continue
    if (/descrip|cantidad|precio|unitario|subtotal|condiciones comerciales|validez|valores netos|avda|avenida|longitudinal/i.test(joined)) {
      continue
    }
    if (!/US\s*\$/i.test(joined)) continue

    const usLine = parseUsLineFromJoined(joined)
    if (!usLine) continue

    const key = `${usLine.description}|${usLine.unit_price_net}|${usLine.unit}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(usLine)
  }

  return sanitizeQuotationLines(lines.slice(0, 100))
}

function mergeLines(
  primary: QuotationLineInput[],
  secondary: QuotationLineInput[],
): QuotationLineInput[] {
  const merged = [...primary]
  const seen = new Set(primary.map(l => `${l.description}|${l.unit_price_net}|${l.unit}`))
  for (const line of secondary) {
    const key = `${line.description}|${line.unit_price_net}|${line.unit}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(line)
    }
  }
  return merged
}

export async function parseQuotationPdfAction(
  formData: FormData,
): Promise<{ ok: true; data: ParsedQuotationFile } | { ok: false; message: string }> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'No PDF file provided' }
  }

  try {
    const buffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const [{ text }, { items }] = await Promise.all([
      extractText(pdf, { mergePages: true }),
      extractTextItems(pdf),
    ])

    const partial = extractFromText(text)
    const pdfLines = extractLinesFromPdfItems(items)
    const pdfNotes = extractNotesFromPdfItems(items)
    const pdfQuoteDate = extractQuoteDateFromLines(groupPdfTextRows(items))
    const textLines = partial.lines ?? []
    const lines = sanitizeQuotationLines(
      textLines.length >= 3 ? textLines : mergeLines(textLines, pdfLines),
    )
    const notes = mergeQuotationNotes(partial.notes, pdfNotes)
    const quoteDate = partial.quoteDate ?? pdfQuoteDate ?? undefined

    if (lines.length > 0 && !partial.subtotalNet) {
      partial.subtotalNet = Math.round(
        lines.reduce((s, l) => s + l.quantity * l.unit_price_net, 0) * 100,
      ) / 100
    }

    return {
      ok: true,
      data: finalizeParsedQuotation({ ...partial, lines, notes, quoteDate }, file.name),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read PDF'
    return { ok: false, message }
  }
}
