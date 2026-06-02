import type { QuotationLineInput } from '@/lib/proveedores/types'

export interface ParsedQuotationFile {
  companyName: string | null
  taxId: string | null
  reference: string | null
  subtotalNet: number | null
  taxAmount: number | null
  totalAmount: number | null
  quoteDate: string | null
  validUntil: string | null
  currency: string | null
  notes: string | null
  lines: QuotationLineInput[]
}

const RUT_RE = /\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/gi

const COMPANY_LABEL_RE =
  /(?:raz[oó]n\s+social|nombre\s+(?:del\s+)?(?:proveedor|empresa|cliente)|proveedor|empresa|emisor|vendedor|nombre\s+comercial)\s*[:\-]\s*([^\n\r|;,]{3,120})/i

const REF_LABEL_RE =
  /(?:cotizaci[oó]n|presupuesto|quote|ref(?:erencia)?|folio)\s*(?:n[°º.]?\s*|nro\.?\s*|numero\s*|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/i

const TOTAL_LABEL_RE =
  /(?:total(?:\s+a\s+pagar|\s+general|\s+bruto|\s+documento)?|monto\s+total|valor\s+total)\s*[:\$]?\s*\$?\s*([\d.,]+)/i

const NET_LABEL_RE =
  /(?:sub\s*total|subtotal|neto|valor\s+neto|monto\s+neto|total\s+neto)\s*[:\$]?\s*\$?\s*([\d.,]+)/i

const IVA_LABEL_RE =
  /(?:iva|i\.v\.a\.?)\s*(?:19\s*%?)?\s*[:\$]?\s*\$?\s*([\d.,]+)/i

const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

const SPANISH_DATE_RE =
  /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi

const SKIP_LINE_RE =
  /^(rut|tel[eé]fono|fono|email|e-mail|www\.|http|fecha|cotizaci[oó]n|presupuesto|descripci[oó]n|cantidad|precio|unitario|subtotal|total|iva|neto|cliente|señor(es)?|atenci[oó]n|v[aá]lido|vencimiento|condiciones|forma\s+de\s+pago|plazo|observaciones?|notas?)\b/i

export function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
    .trim()
}

export function parseChileanNumber(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^US\s*/i, '')
    .replace(/^\$/, '')
    .replace(/\s/g, '')
  if (!cleaned) return null
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const n = Number(cleaned.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  if (cleaned.includes(',')) {
    const n = Number(cleaned.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const n = Number(cleaned.replace(/\./g, ''))
  return Number.isFinite(n) ? n : null
}

const US_LINE_RE =
  /^(.+?)\s+US\s*\$\s*([\d.,]+)\s*(?:\/\s*([A-Za-zÁÉÍÓÚáéíóúñ.]+))?\s*$/i

export function normalizeUnit(raw?: string): string {
  if (!raw) return 'unidad'
  const u = raw.toLowerCase().replace(/\.$/, '')
  if (u === 'kg') return 'kg'
  if (u === 'mil') return 'mil'
  if (u === 'rollo' || u === 'roll') return 'rollo'
  if (u === 'unidad' || u === 'unit') return 'unidad'
  return u
}

function cleanLineDescription(desc: string): string {
  return desc
    .replace(/^[\d.)•\-]+\s*/, '')
    .replace(/^(unidad|unit)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isInvalidLineDescription(desc: string): boolean {
  const d = cleanLineDescription(desc)
  if (d.length < 10) return true
  if (/^o\s+[\d.,]+\s*m$/i.test(d)) return true
  if (/^seg[uú]n\s*:/i.test(d)) return true
  if (/^[\d.,]+\s*m$/i.test(d)) return true
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/.test(d)) return true
  const meaningfulWords = d.split(/\s+/).filter(w => /[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/.test(w))
  if (meaningfulWords.length < 1) return true
  if (meaningfulWords.length < 2 && d.length < 18) return true
  if (isNonProductDescription(d)) return true
  return false
}

function isNonProductDescription(desc: string): boolean {
  return (
    /valores?\s+netos?|validez|forma\s+de\s+pago|plazo\s+de|condiciones\s+comerciales|iva\s+se\s+cancela|pagader|cancela\s+al|despacho|flete|cr[eé]dito|contado/i.test(desc)
    || /^(?:iva|neto|total|subtotal)\b/i.test(desc)
    || /santiago,\s*de|de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(desc)
    || /\b(?:avda|avenida|av\.|longitudinal|ruta|\bkm\b)\b/i.test(desc)
    || /^(?:fono|tel[eé]fono|rut|www\.|http|email|e-mail|atentamente|saludos)/i.test(desc)
    || /cotizaci[oó]n\s+n[°º.]?\s*\d/i.test(desc)
  )
}

function isSuspiciousLinePrice(desc: string, price: number): boolean {
  if (price >= 2000 && price <= 2099) return true
  if (isNonProductDescription(desc)) return true
  if (/validez|pagader|d[ií]as\b|octubre|enero|avda|avenida|longitudinal|\bkm\b/i.test(desc) && price < 1000) {
    return true
  }
  return false
}

function lineSignature(desc: string): string {
  return cleanLineDescription(desc)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(' ')
}

export function sanitizeQuotationLines(lines: QuotationLineInput[]): QuotationLineInput[] {
  const result: QuotationLineInput[] = []

  for (const line of lines) {
    const description = cleanLineDescription(line.description)
    if (isInvalidLineDescription(description)) continue

    const normalized: QuotationLineInput = {
      ...line,
      description,
      unit: normalizeUnit(line.unit),
    }

    if (isSuspiciousLinePrice(description, normalized.unit_price_net)) continue

    const sig = lineSignature(description)
    const dupIdx = result.findIndex(existing => {
      if (existing.unit_price_net !== normalized.unit_price_net) return false
      const existingSig = lineSignature(existing.description)
      if (!sig || !existingSig) return false
      if (sig === existingSig) return true
      return sig.includes(existingSig) || existingSig.includes(sig)
    })

    if (dupIdx >= 0) {
      if (description.length > result[dupIdx].description.length) {
        result[dupIdx] = normalized
      }
      continue
    }

    result.push(normalized)
  }

  return result
}

function isBoilerplateLine(line: string): boolean {
  return (
    /según lo solicitado|nos permitimos cotizar|materiales de embalaje|tempora\s+\d{4}/i.test(line)
    || /^(estimado|señor|atentamente|saludos|fono|tel|rut|www\.)/i.test(line)
  )
}

function extractUsDollarLineItems(text: string): QuotationLineInput[] {
  const lines: QuotationLineInput[] = []
  const seen = new Set<string>()

  const normalized = text.replace(/\r/g, '\n')

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (line.length < 12) continue
    if (isBoilerplateLine(line)) continue

    const m = line.match(US_LINE_RE)
    if (!m) continue

    const desc = cleanLineDescription(m[1])
    const price = parseChileanNumber(m[2])
    const unit = normalizeUnit(m[3])
    if (isInvalidLineDescription(desc) || price == null || price <= 0 || isSuspiciousLinePrice(desc, price)) continue

    const key = `${desc}|${price}|${unit}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ description: desc, quantity: 1, unit, unit_price_net: price })
  }

  if (lines.length > 0) return sanitizeQuotationLines(lines)

  const inlinePattern =
    /([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ0-9 ,./()x×*+\-%]{10,180}?)\s+US\s*\$\s*([\d.,]+)\s*(?:\/\s*([A-Za-zÁÉÍÓÚáéíóúñ.]+))?/gi
  let match: RegExpExecArray | null
  while ((match = inlinePattern.exec(normalized)) !== null) {
    const desc = cleanLineDescription(match[1])
    if (isBoilerplateLine(desc) || isInvalidLineDescription(desc)) continue
    const price = parseChileanNumber(match[2])
    const unit = normalizeUnit(match[3])
    if (price == null || price <= 0 || isSuspiciousLinePrice(desc, price)) continue
    const key = `${desc}|${price}|${unit}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ description: desc, quantity: 1, unit, unit_price_net: price })
  }

  return sanitizeQuotationLines(lines)
}

function detectCurrency(text: string): string {
  if (/US\s*\$/i.test(text) || /\bUSD\b/i.test(text)) return 'USD'
  if (/\bEUR\b/i.test(text) || /€/.test(text)) return 'EUR'
  if (/\bCLP\b/i.test(text)) return 'CLP'
  return 'CLP'
}

const NOTES_SECTION_END_RE =
  /\b(?:atentamente|saludos cordiales|sin otro particular|quedamos a su|observaciones\s*:)\b/i

const COMMERCIAL_HINT_RE =
  /pago|entrega|despacho|validez|flete|stock|m[ií]nimo|pedido|cr[eé]dito|contado|d[ií]as|plazo|precio|v[aá]lida|factura|transferencia|cheque|anticipo|ex\s*works|fob|cif/i

/** PDF bullets / symbol-font glyphs that often render as broken squares in web fonts */
const PDF_BULLET_GLYPH_RE =
  /[\u2610-\u2612\u25A0-\u25AB\u25CF\u25CB\u25C6\u25C7\u2022\u2023\u2043\u2219\u25E6\u2713\u2714\u2717\u2718\u0083-\u0088\u0095\uF0A7\uF0B7\uF076\uE000-\uF8FF\uFFFD]/g

export function normalizeNotesText(raw: string): string {
  let text = raw
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(PDF_BULLET_GLYPH_RE, '\n- ')
    .replace(/\s+-\s+/g, '\n- ')
    .replace(/\s+•\s+/g, '\n- ')
    .replace(/\s+(?=\d+\.\s)/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const deduped: string[] = []

  for (const line of lines) {
    const isIntro = /seg[uú]n lo solicitado|nos permitimos cotizar|de acuerdo a lo solicitado/i.test(line)
    const formatted = isIntro ? line : (line.startsWith('- ') ? line : `- ${line}`)
    const key = formatted
      .replace(/^-\s*/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 48)

    if (!key) continue
    if (deduped.some(existing => {
      const existingKey = existing
        .replace(/^-\s*/, '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .slice(0, 48)
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
    })) {
      continue
    }

    deduped.push(formatted)
  }

  return deduped.join('\n')
}

function formatNotesBlock(raw: string): string {
  return normalizeNotesText(raw)
}

function extractBulletTerms(text: string): string[] {
  const normalized = normalizeNotesText(text.replace(/\r/g, '\n'))
  const chunks = normalized
    .split(/\n-\s+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(part => part.length >= 12 && COMMERCIAL_HINT_RE.test(part))

  if (chunks.length > 0) return chunks

  return [...normalized.matchAll(/(?:^|\n)\s*(\d+[.)]\s*.{10,220})/g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(part => COMMERCIAL_HINT_RE.test(part))
}

function extractCommercialConditions(text: string): string | null {
  const flat = text.replace(/\r/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

  const sectionStarts = [
    /condiciones\s+comerciales\s*:?\s*/i,
    /condiciones\s+de\s+(?:venta|pago)\s*:?\s*/i,
  ]

  for (const startRe of sectionStarts) {
    const startMatch = flat.match(startRe)
    if (!startMatch || startMatch.index == null) continue

    const after = flat.slice(startMatch.index + startMatch[0].length)
    const endMatch = after.match(NOTES_SECTION_END_RE)
    const block = formatNotesBlock(endMatch ? after.slice(0, endMatch.index!) : after.slice(0, 1800))
    if (block.length >= 15) return block
  }

  const chunks: string[] = []

  const paymentLine = flat.match(
    /(?:plazo|forma)\s+de\s+pago\s*:?\s*(.{5,220}?)(?:\.|$|\b(?:entrega|validez|despacho|atentamente)\b)/i,
  )
  if (paymentLine?.[1]?.trim()) chunks.push(`Forma de pago: ${paymentLine[1].trim()}`)

  const deliveryLine = flat.match(
    /(?:plazo|tiempo)\s+de\s+entrega\s*:?\s*(.{5,220}?)(?:\.|$|\b(?:validez|pago|atentamente)\b)/i,
  )
  if (deliveryLine?.[1]?.trim()) chunks.push(`Plazo de entrega: ${deliveryLine[1].trim()}`)

  const validityLine = flat.match(
    /(?:validez|v[aá]lida)\s*(?:de la cotizaci[oó]n)?\s*:?\s*(.{5,220}?)(?:\.|$|\b(?:pago|entrega|atentamente)\b)/i,
  )
  if (validityLine?.[1]?.trim()) chunks.push(`Validez: ${validityLine[1].trim()}`)

  if (chunks.length > 0) return [...new Set(chunks)].join('\n')

  const totalIdx = flat.search(/\btotal\b/i)
  const tail = totalIdx >= 0 ? flat.slice(totalIdx) : flat.slice(Math.floor(flat.length * 0.55))
  const bullets = extractBulletTerms(tail)
  if (bullets.length >= 2) return bullets.join('\n')
  if (bullets.length === 1 && bullets[0].length >= 20) return bullets[0]

  const inlineBullets = extractBulletTerms(flat)
  if (inlineBullets.length >= 2) return inlineBullets.join('\n')

  return null
}

function extractIntroNotes(text: string): string | null {
  const normalized = text.replace(/\r/g, '\n')

  const introMatch = normalized.match(
    /(?:seg[uú]n lo solicitado|de acuerdo a lo solicitado|nos permitimos cotizar)[\s\S]{15,700}?(?=\s*(?:Papel|Absorb|Cart[oó]n|Bolsa|Zuncho|Clamshell|Esquineros|Sello|Condiciones\s+comerciales|Sub\s*total|Total\b|US\s*\$\s*[\d.,]+))/i,
  )
  if (introMatch) return formatNotesBlock(introMatch[0])

  const shortIntro = normalized.match(
    /(?:seg[uú]n lo solicitado|nos permitimos cotizar)[^.]{10,400}\./i,
  )
  return shortIntro ? shortIntro[0].replace(/\s+/g, ' ').trim() : null
}

export function mergeQuotationNotes(
  ...candidates: Array<string | null | undefined>
): string | null {
  const parts: string[] = []

  for (const candidate of candidates) {
    const value = normalizeNotesText(candidate?.trim() ?? '')
    if (!value) continue
    const duplicate = parts.some(existing => {
      const a = existing.toLowerCase()
      const b = value.toLowerCase()
      return a.includes(b) || b.includes(a)
    })
    if (!duplicate) parts.push(value)
  }

  if (parts.length === 0) return null
  return normalizeNotesText(parts.join('\n\n'))
}

export function buildQuotationNotes(text: string): string | null {
  return mergeQuotationNotes(extractIntroNotes(text), extractCommercialConditions(text))
}

function parseDateToIso(raw: string): string | null {
  const spanish = parseSpanishDateToIso(raw)
  if (spanish) return spanish

  const m = raw.match(DATE_RE)
  if (!m) return null
  let day = Number(m[1])
  let month = Number(m[2])
  let year = Number(m[3])
  if (year < 100) year += 2000
  if (month > 12 && day <= 12) [day, month] = [month, day]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseSpanishDateToIso(raw: string): string | null {
  const m = raw.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i,
  )
  if (!m) return null
  const day = Number(m[1])
  const month = SPANISH_MONTHS[m[2].toLowerCase()]
  const year = Number(m[3])
  if (!month || day < 1 || day > 31 || year < 1990 || year > 2100) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function guessQuoteDateFromReference(reference: string | null | undefined): string | null {
  if (!reference) return null
  const digits = reference.replace(/\D/g, '')
  if (digits.length !== 6) return null

  const yy = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const dd = Number(digits.slice(4, 6))
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function extractQuoteDate(text: string): string | null {
  const flat = text.replace(/\r/g, '\n').replace(/\s+/g, ' ').trim()

  const labeled = flat.match(
    /(?:fecha(?:\s+emisi[oó]n|\s+cotizaci[oó]n|\s+documento)?|date|emitid[oa])\s*[:\-]?\s*(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  )
  if (labeled?.[1]) {
    const iso = parseDateToIso(labeled[1])
    if (iso) return iso
  }

  const spanishMatches = [...flat.matchAll(SPANISH_DATE_RE)]
  if (spanishMatches.length > 0) {
    const iso = parseSpanishDateToIso(spanishMatches[0][0])
    if (iso) return iso
  }

  const numeric = flat.match(DATE_RE)
  if (numeric) {
    const iso = parseDateToIso(numeric[0])
    if (iso) return iso
  }

  return null
}

export function extractQuoteDateFromLines(lines: string[]): string | null {
  for (const line of lines.slice(0, 25)) {
    const iso = extractQuoteDate(line)
    if (iso) return iso
  }
  return null
}

function cleanDocumentText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isValidReference(ref: string): boolean {
  const r = ref.trim()
  if (r.length < 3) return false
  if (!/\d/.test(r)) return false
  if (/^[a-z]{1,3}\d{1,2}$/i.test(r)) return false
  return true
}

function extractRut(text: string): string | null {
  const matches = [...text.matchAll(RUT_RE)].map(m => m[1].toUpperCase())
  if (matches.length === 0) return null
  return matches[0]
}

function extractCompanyFromLines(lines: string[]): string | null {
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i]
    if (!line || line.length < 3 || line.length > 100) continue
    if (SKIP_LINE_RE.test(line)) continue
    if (RUT_RE.test(line)) continue
    if (DATE_RE.test(line) && line.length < 14) continue
    if (/^\$?\s*[\d.,]+$/.test(line)) continue
    if (/^\d+$/.test(line.replace(/\s/g, ''))) continue
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(line)) continue

    const afterRut = line.match(/^RUT\s*[:\s]*[\d.kK\-]+\s*(.+)$/i)
    if (afterRut?.[1]) return normalizeCompanyName(afterRut[1])

    if (/^(spa|ltda|s\.a\.|eirl|limitada|sociedad)/i.test(line) || line.length >= 4) {
      return normalizeCompanyName(line)
    }
  }
  return null
}

function extractReference(text: string, fileName: string): string | null {
  const patterns = [
    /cotizaci[oó]n\s*(?:n[°º.]?\s*|nro\.?\s*|numero\s*|#)?\s*[:\-]?\s*(\d{3,10})/i,
    /(?:n[°º]|folio|ref\.?|referencia)\s*[:\-#]?\s*(\d{3,10})/i,
    /\bn[°º]\s*(\d{3,10})\b/i,
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (m && isValidReference(m[1])) return m[1].trim()
  }

  const labeled = text.match(REF_LABEL_RE)
  if (labeled && isValidReference(labeled[1])) return labeled[1].trim()

  return guessReferenceFromFilename(fileName)
}

function extractAmounts(text: string): {
  subtotalNet: number | null
  taxAmount: number | null
  totalAmount: number | null
} {
  const blockMatch = text.match(
    /(?:neto|sub\s*total|subtotal)\s*[:\$]?\s*\$?\s*([\d.,]+)[\s\S]{0,120}?(?:iva|i\.v\.a\.?)\s*[:\$]?\s*\$?\s*([\d.,]+)[\s\S]{0,80}?(?:total(?:\s+a\s+pagar|\s+general)?)\s*[:\$]?\s*\$?\s*([\d.,]+)/i,
  )
  if (blockMatch) {
    const subtotalNet = parseChileanNumber(blockMatch[1])
    const taxAmount = parseChileanNumber(blockMatch[2])
    const totalAmount = parseChileanNumber(blockMatch[3])
    return { subtotalNet, taxAmount, totalAmount }
  }

  const net = text.match(NET_LABEL_RE)
  const total = text.match(TOTAL_LABEL_RE)
  const iva = text.match(IVA_LABEL_RE)

  let subtotalNet = net ? parseChileanNumber(net[1]) : null
  let totalAmount = total ? parseChileanNumber(total[1]) : null
  let taxAmount = iva ? parseChileanNumber(iva[1]) : null

  if (subtotalNet != null && totalAmount == null && taxAmount != null) {
    totalAmount = Math.round((subtotalNet + taxAmount) * 100) / 100
  }

  if (subtotalNet == null && totalAmount != null && taxAmount != null) {
    subtotalNet = Math.round((totalAmount - taxAmount) * 100) / 100
  }

  if (taxAmount == null && subtotalNet != null && totalAmount != null && totalAmount > subtotalNet) {
    taxAmount = Math.round((totalAmount - subtotalNet) * 100) / 100
  }

  if (subtotalNet == null || totalAmount == null) {
    const amounts = [
      ...text.matchAll(/(?:US\s*\$|\$)\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{2})?)/gi),
      ...text.matchAll(/\$\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{2})?)/g),
    ]
      .map(m => parseChileanNumber(m[1]))
      .filter((n): n is number => n != null && n > 0)
      .sort((a, b) => b - a)

    if (amounts.length >= 1 && totalAmount == null && amounts[0] >= 10) totalAmount = amounts[0]
    if (amounts.length >= 2 && subtotalNet == null && amounts[1] >= 10) subtotalNet = amounts[1]
    if (amounts.length >= 3 && taxAmount == null && amounts[2] >= 1) taxAmount = amounts[2]
  }

  if (taxAmount == null && subtotalNet != null && totalAmount != null && totalAmount > subtotalNet) {
    taxAmount = Math.round((totalAmount - subtotalNet) * 100) / 100
  }

  return { subtotalNet, taxAmount, totalAmount }
}

/** Cotizaciones de proveedor: precios ya incluyen IVA, no se recalcula. */
export const DEFAULT_QUOTATION_TAX_RATE = 0

export function inferTaxRateFromParsed(
  _subtotal?: number,
  _parsed?: Pick<ParsedQuotationFile, 'subtotalNet' | 'taxAmount' | 'totalAmount'>,
  _currency?: string,
): number {
  return DEFAULT_QUOTATION_TAX_RATE
}

function extractLineItemsFromText(text: string): QuotationLineInput[] {
  const usLines = extractUsDollarLineItems(text)
  if (usLines.length > 0) return usLines

  const lines: QuotationLineInput[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length < 8) continue
    if (SKIP_LINE_RE.test(line)) continue
    if (/^(subtotal|total|iva|neto)\b/i.test(line)) continue

    const usTail = line.match(US_LINE_RE)
    if (usTail) {
      const desc = usTail[1].trim()
      const price = parseChileanNumber(usTail[2])
      const unit = normalizeUnit(usTail[3])
      if (desc.length >= 3 && price != null && price > 0) {
        const key = `${desc}|${price}|${unit}`
        if (!seen.has(key)) {
          seen.add(key)
          lines.push({ description: desc, quantity: 1, unit, unit_price_net: price })
        }
      }
      continue
    }

    const triple = line.match(
      /^(\d{1,4}\s+)?(.{4,90}?)\s+(\d+(?:[.,]\d+)?)\s+(?:\$?\s*)?([\d.,]+)\s+(?:\$?\s*)?([\d.,]+)\s*$/,
    )
    if (triple) {
      const desc = triple[2].trim()
      const qty = parseChileanNumber(triple[3]) ?? 1
      const unitPrice = parseChileanNumber(triple[4]) ?? parseChileanNumber(triple[5])
      if (desc.length >= 3 && unitPrice != null && unitPrice > 0) {
        const key = `${desc}|${qty}|${unitPrice}`
        if (!seen.has(key)) {
          seen.add(key)
          lines.push({ description: desc, quantity: qty, unit: 'unidad', unit_price_net: unitPrice })
        }
      }
      continue
    }

    const pair = line.match(/^(.{4,90}?)\s+(\d+(?:[.,]\d+)?)\s+(?:\$?\s*)?([\d.,]+)\s*$/)
    if (pair) {
      const desc = pair[1].trim()
      const qty = parseChileanNumber(pair[2]) ?? 1
      const unitPrice = parseChileanNumber(pair[3])
      if (desc.length >= 3 && unitPrice != null && unitPrice > 0 && !SKIP_LINE_RE.test(desc)) {
        const key = `${desc}|${qty}|${unitPrice}`
        if (!seen.has(key)) {
          seen.add(key)
          lines.push({ description: desc, quantity: qty, unit: 'unidad', unit_price_net: unitPrice })
        }
      }
    }
  }

  return sanitizeQuotationLines(lines)
}

export function extractFromText(text: string): Partial<ParsedQuotationFile> {
  const cleaned = cleanDocumentText(text)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  const result: Partial<ParsedQuotationFile> = {}

  result.taxId = extractRut(cleaned)

  const companyLabel = cleaned.match(COMPANY_LABEL_RE)
  result.companyName = companyLabel
    ? normalizeCompanyName(companyLabel[1])
    : extractCompanyFromLines(lines)

  result.reference = extractReference(cleaned, '')

  const amounts = extractAmounts(cleaned)
  result.subtotalNet = amounts.subtotalNet
  result.taxAmount = amounts.taxAmount
  result.totalAmount = amounts.totalAmount

  result.quoteDate = extractQuoteDate(cleaned)
    ?? extractQuoteDateFromLines(lines)
    ?? guessQuoteDateFromReference(result.reference)

  const validMatch = cleaned.match(
    /(?:v[aá]lid[oa]|vence|vencimiento|validez)\s*(?:hasta|al)?\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  )
  if (validMatch) result.validUntil = parseDateToIso(validMatch[1])

  result.lines = extractLineItemsFromText(cleaned)

  result.currency = detectCurrency(cleaned)

  const commercial = extractCommercialConditions(cleaned)
  const intro = extractIntroNotes(cleaned)
  result.notes = mergeQuotationNotes(intro, commercial)

  if (result.lines.length > 0 && !result.subtotalNet) {
    result.subtotalNet = Math.round(
      result.lines.reduce((s, l) => s + l.quantity * l.unit_price_net, 0) * 100,
    ) / 100
  }

  return result
}

export function guessCompanyFromFilename(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/i, '').trim()
  if (!base) return null

  const cotMatch = base.match(/cotizaci[oó]n\s+(\d+)\s+(.+)/i)
  if (cotMatch?.[2]) return normalizeCompanyName(cotMatch[2])

  const parts = base.split(/[-–—_|]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const skip = /^(cotizacion|cot|coti|quote|presupuesto|pdf|xlsx|xls|docx?|\d{4,})$/i
  const candidate = parts.find(p => !skip.test(p) && p.length >= 2)
  if (candidate) return normalizeCompanyName(candidate)

  const lastPart = parts[parts.length - 1]
  if (lastPart && !/^\d+$/.test(lastPart)) return normalizeCompanyName(lastPart)

  return null
}

export function guessReferenceFromFilename(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/i, '')
  const cotNum = base.match(/cotizaci[oó]n\s+(\d{3,10})/i)
  if (cotNum) return cotNum[1]

  const num = base.match(/(?:cot|quote|ref)[\s._-]*(\d{3,10})/i)
  if (num) return num[1]

  const trailing = base.match(/\b(\d{5,8})\b/)
  return trailing ? trailing[1] : null
}

export function finalizeParsedQuotation(
  partial: Partial<ParsedQuotationFile>,
  fileName: string,
): ParsedQuotationFile {
  const fromTextRef = partial.reference && isValidReference(partial.reference) ? partial.reference : null
  const reference = fromTextRef ?? guessReferenceFromFilename(fileName)

  return {
    companyName: partial.companyName ?? guessCompanyFromFilename(fileName),
    taxId: partial.taxId ?? null,
    reference,
    subtotalNet: partial.subtotalNet ?? null,
    taxAmount: partial.taxAmount ?? null,
    totalAmount: partial.totalAmount ?? null,
    quoteDate: partial.quoteDate ?? guessQuoteDateFromReference(reference),
    validUntil: partial.validUntil ?? null,
    currency: partial.currency ?? null,
    notes: partial.notes ?? null,
    lines: partial.lines ?? [],
  }
}

export function parseQuotationFromText(text: string, fileName: string): ParsedQuotationFile {
  return finalizeParsedQuotation(extractFromText(text), fileName)
}

export function resolveSubtotalFromParsed(
  parsed: Pick<ParsedQuotationFile, 'subtotalNet' | 'totalAmount'>,
  taxRate: number,
  lines: QuotationLineInput[],
): number {
  if (lines.length > 0) {
    return lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price_net) || 0), 0)
  }
  if (parsed.subtotalNet != null && parsed.subtotalNet > 0) return parsed.subtotalNet
  if (parsed.totalAmount != null && parsed.totalAmount > 0) {
    return Math.round((parsed.totalAmount / (1 + taxRate / 100)) * 100) / 100
  }
  return 0
}
