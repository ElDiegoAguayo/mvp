'use server'

import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import { logAudit } from '@/lib/audit-log'

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RegistroCompra {
  cliente_id: string
  lote_id: string
  rut_contraparte: string
  razon_social: string
  numero_documento: string
  tipo_documento: string
  tipo_obligacion: string
  fecha_emision: string | null
  fecha_devengo: string | null
  fecha_vencimiento: string | null
  mes_devengo: string
  monto_neto: number
  monto_exento: number
  monto_iva: number
  iva_no_recuperable: number
  otros_impuestos: number
  retencion_honorarios: number
  monto_bruto: number
  monto_base: number
  monto_calculado: number
  porcentaje: number | null
  anula_o_modifica: string
  categoria_madre: string
  sub_cuenta: string
  detalle_gasto: string
  estado_clasificacion: string
}

// â”€ Historial de cargas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface HistorialCarga {
  id: string
  created_at: string
  archivo: string
  insertados: number
  omitidos: number
  errores: number
  lote_id: string | null
}

export interface HistorialResult {
  ok: boolean
  data: HistorialCarga[]
  message?: string
}

// â”€ Detalle de registros por lote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RegistroDetalle {
  id: string
  lote_id: string | null
  rut_contraparte: string
  razon_social: string
  numero_documento: string
  tipo_documento: string
  tipo_obligacion: string
  fecha_emision: string | null
  fecha_devengo: string | null
  fecha_vencimiento: string | null
  mes_devengo: string
  monto_neto: number
  monto_exento: number
  monto_iva: number
  iva_no_recuperable: number
  otros_impuestos: number
  retencion_honorarios: number
  monto_bruto: number
  monto_base: number
  monto_calculado: number
  porcentaje: number | null
  anula_o_modifica: string
  categoria_madre: string
  sub_cuenta: string
  detalle_gasto: string
  estado_clasificacion: string
  created_at: string
}

export interface RegistrosDetalleResult {
  ok: boolean
  data: RegistroDetalle[]
  total: number
  message?: string
}

export interface ProcesarResult {
  ok: boolean
  insertados: number
  omitidos: number
  errores: string[]
  message: string
}

export interface GastoPorContraparte {
  rut_contraparte: string
  razon_social: string
  total_monto_neto: number
  total_monto_iva: number
  total_monto_bruto: number
  total_registros: number
  pendientes: number
  clasificados: number
}

export interface GastosResult {
  ok: boolean
  data: GastoPorContraparte[]
  message?: string
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Column mapping
// Maps every known header variant from SII Excel exports (Libro de Compras)
// to the corresponding field in RegistroCompra. Comparison is done after
// normalizing (lowercase + strip diacritics + trim).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type MappableField = keyof Omit<RegistroCompra, 'cliente_id' | 'estado_clasificacion'>

const COLUMN_MAP: Record<string, MappableField> = {
  // rut_contraparte
  'rut contraparte': 'rut_contraparte',
  'rut emisor': 'rut_contraparte',
  'rut del emisor': 'rut_contraparte',
  'rut proveedor': 'rut_contraparte',
  'rut vendedor': 'rut_contraparte',
  rut: 'rut_contraparte',

  // razon_social  â† "Contraparte" is the SII portal's exact header
  contraparte: 'razon_social',
  'razon social': 'razon_social',
  'nombre o razon social': 'razon_social',
  'nombre emisor': 'razon_social',
  'nombre del emisor': 'razon_social',
  'razon social emisor': 'razon_social',
  'nombre contraparte': 'razon_social',

  // numero_documento
  folio: 'numero_documento',
  'numero documento': 'numero_documento',
  'nÂ° documento': 'numero_documento',
  'folio documento': 'numero_documento',
  'folio del documento': 'numero_documento',
  'numero de documento': 'numero_documento',

  // tipo_documento
  'tipo documento': 'tipo_documento',
  'tipo dte': 'tipo_documento',
  'tipo de documento': 'tipo_documento',
  'codigo tipo documento': 'tipo_documento',
  tipo: 'tipo_documento',

  // tipo_obligacion  â† new SII column
  'tipo obligacion': 'tipo_obligacion',
  'tipo de obligacion': 'tipo_obligacion',
  obligacion: 'tipo_obligacion',

  // fecha_emision
  'fecha emision': 'fecha_emision',
  'fecha de emision': 'fecha_emision',
  'fecha de emisión': 'fecha_emision',
  fecha: 'fecha_emision',
  'fecha doc': 'fecha_emision',

  // fecha_devengo  â† new SII column (was mapped as text mes_devengo before)
  'fecha devengo': 'fecha_devengo',
  'fecha de devengo': 'fecha_devengo',

  // fecha_vencimiento  â† new SII column
  'fecha vencimiento': 'fecha_vencimiento',
  'fecha de vencimiento': 'fecha_vencimiento',
  vencimiento: 'fecha_vencimiento',

  // mes_devengo (legacy / derived)
  'mes devengo': 'mes_devengo',
  'mes de devengo': 'mes_devengo',
  'periodo de devengo': 'mes_devengo',
  'periodo devengo': 'mes_devengo',
  'mes periodo': 'mes_devengo',

  // monto_neto
  neto: 'monto_neto',
  'monto neto': 'monto_neto',
  'neto afecto': 'monto_neto',
  'base imponible': 'monto_neto',

  // monto_exento  â† new SII column
  exento: 'monto_exento',
  'monto exento': 'monto_exento',
  'neto exento': 'monto_exento',

  // monto_iva  (only the recoverable IVA)
  iva: 'monto_iva',
  'monto iva': 'monto_iva',
  'iva recuperable': 'monto_iva',
  'credito iva': 'monto_iva',
  'debito credito': 'monto_iva',

  // iva_no_recuperable  â† was incorrectly mapped to monto_iva before
  'iva no recuperable': 'iva_no_recuperable',
  'iva irrecuperable': 'iva_no_recuperable',
  'iva no rec': 'iva_no_recuperable',

  // otros_impuestos  â† new SII column
  'otros impuestos': 'otros_impuestos',
  'otros imp': 'otros_impuestos',
  'impuestos adicionales': 'otros_impuestos',

  // retencion_honorarios  â† new SII column
  'retencion honorarios': 'retencion_honorarios',
  'retencion de honorarios': 'retencion_honorarios',
  honorarios: 'retencion_honorarios',
  'ret honorarios': 'retencion_honorarios',

  // monto_bruto
  total: 'monto_bruto',
  'monto total': 'monto_bruto',
  'total documento': 'monto_bruto',
  'monto bruto': 'monto_bruto',
  bruto: 'monto_bruto',
  'total a pagar': 'monto_bruto',

  // monto_base  â† new SII column
  'monto base': 'monto_base',
  'base calculo': 'monto_base',
  'base de calculo': 'monto_base',

  // monto_calculado  â† new SII column
  'monto calculado': 'monto_calculado',
  calculado: 'monto_calculado',
  'impuesto calculado': 'monto_calculado',

  // porcentaje  â† new SII column
  porcentaje: 'porcentaje',
  'tasa': 'porcentaje',
  '%': 'porcentaje',

  // anula_o_modifica  â† new SII column
  'anula o modifica': 'anula_o_modifica',
  anula: 'anula_o_modifica',
  'folio anulado': 'anula_o_modifica',
  'modifica folio': 'anula_o_modifica',
  'anula modifica': 'anula_o_modifica',

  // categoria_madre
  'categoria madre': 'categoria_madre',
  categoria: 'categoria_madre',
  'cuenta contable': 'categoria_madre',
  'cuenta mayor': 'categoria_madre',

  // sub_cuenta
  'sub cuenta': 'sub_cuenta',
  subcuenta: 'sub_cuenta',
  cuenta: 'sub_cuenta',
  'cuenta auxiliar': 'sub_cuenta',

  // detalle_gasto
  'detalle gasto': 'detalle_gasto',
  detalle: 'detalle_gasto',
  descripcion: 'detalle_gasto',
  glosa: 'detalle_gasto',
  observacion: 'detalle_gasto',
  comentario: 'detalle_gasto',
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper utilities
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Normalize an Excel header for case-insensitive, diacritic-insensitive matching. */
function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse a numeric cell value.
 * Handles Chilean formatting (dot as thousands separator, comma as decimal)
 * and strips currency symbols.
 */
function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  // Strip currency symbol, spaces, and dots used as thousands separators;
  // replace comma with decimal point.
  const s = String(v)
    .replace(/[$\s]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Convert an Excel cell value to an ISO date string (YYYY-MM-DD).
 * Handles:
 *  - JS Date objects (from xlsx cellDates:true)
 *  - DD/MM/YYYY and DD-MM-YYYY strings (common in SII)
 *  - YYYY-MM-DD ISO strings
 */
function toDateISO(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null

  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const s = String(v).trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`

  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// DTE Download format parser (DTE_DOWN... files from SII portal)
// ─────────────────────────────────────────────────────────────────────────────

/** Convert Excel serial date number to ISO string (YYYY-MM-DD) */
function excelSerialToISO(serial: unknown): string | null {
  if (serial === null || serial === undefined || serial === '') return null
  if (serial instanceof Date || (typeof serial === 'string' && isNaN(Number(serial)))) {
    return toDateISO(serial)
  }
  const n = typeof serial === 'number' ? serial : parseFloat(String(serial))
  if (isNaN(n) || n <= 0) return null
  const date = new Date(Math.round((n - 25569) * 86400 * 1000))
  if (isNaN(date.getTime())) return null
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DTE_TIPO_MAP: Record<number, string> = {
  33:  'Factura Electronica',
  34:  'Factura No Afecta/Exenta Electronica',
  39:  'Boleta Electronica',
  41:  'Boleta No Afecta/Exenta Electronica',
  46:  'Factura de Compra Electronica',
  52:  'Guia de Despacho Electronica',
  56:  'Nota de Debito Electronica',
  61:  'Nota de Credito Electronica',
  110: 'Factura de Exportacion Electronica',
  111: 'Nota de Debito de Exportacion Electronica',
  112: 'Nota de Credito de Exportacion Electronica',
}

/** Detect if an array of rows belongs to a DTE download file */
function isDTEDownloadFormat(rows: unknown[][]): boolean {
  for (const row of rows.slice(0, 15)) {
    if (Array.isArray(row) && String(row[0] ?? '').trim() === 'TipoDTE') return true
  }
  return false
}

/**
 * Parse the DTE download format (DTE_DOWN...) exported from SII portal.
 *
 * File structure: interleaved blocks per document:
 *   Row N:   [TipoDTE, Folio, FechaEmision, TipoDespacho, FormaPago,
 *             RutEmisor, RazonSocialEmisor, GiroEmisor, Acteco, CodSIISucursal,
 *             Direccion, Comuna, Ciudad,
 *             RutReceptor, RazonSocialReceptor, GiroReceptor,
 *             Direccion, Comuna, Ciudad,
 *             Total-Neto, Total-Exento, Total-IVA, Total-MontoTotal,
 *             MontoPeriodo, Monto-NoFacturable, Saldo-Anterior, ValorPagar]  <- HEADER
 *   Row N+1: actual data values (or empty if no document in this block)
 *   Row N+2: [DETALLE, Item, Cod, Codigo, Descripcion, ...]                 <- item header
 *   Row N+3+: line items...
 *
 * Counterparty detection:
 *   If all docs share the same RutEmisor  -> emitted docs -> counterparty = Receptor
 *   If all docs share the same RutReceptor -> received docs -> counterparty = Emisor
 */
function parseDTEDownload(
  rows: unknown[][],
  clienteId: string,
  loteId: string,
): { registros: RegistroCompra[]; omitidos: number } {
  const registros: RegistroCompra[] = []
  let omitidos = 0

  // Collect only the data rows (row right after a TipoDTE header with numeric tipo)
  const dataRows: unknown[][] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || String(row[0] ?? '').trim() !== 'TipoDTE') continue
    const next = rows[i + 1]
    if (!Array.isArray(next) || next.length < 5) continue
    const tipoDTENum = Number(next[0])
    if (!isNaN(tipoDTENum) && tipoDTENum > 0) dataRows.push(next)
  }

  if (dataRows.length === 0) return { registros, omitidos }

  // Detect direction: emitted (1 unique emisor) vs received (1 unique receptor)
  const uniqueEmisores  = new Set(dataRows.map(r => String(r[5]  ?? '').trim()).filter(Boolean))
  const uniqueReceptores= new Set(dataRows.map(r => String(r[13] ?? '').trim()).filter(Boolean))
  // If single emisor and multiple receptors -> company is the emisor -> use receptor as contraparte
  const useReceptorAsContraparte =
    uniqueEmisores.size === 1 && uniqueReceptores.size > 1
    || (uniqueEmisores.size === 1 && uniqueReceptores.size === 1 && uniqueReceptores.size >= 1)

  for (const dataRow of dataRows) {
    const tipoDTENum    = Number(dataRow[0])
    const rutEmisor     = String(dataRow[5]  ?? '').trim()
    const razonEmisor   = String(dataRow[6]  ?? '').trim()
    const rutReceptor   = String(dataRow[13] ?? '').trim()
    const razonReceptor = String(dataRow[14] ?? '').trim()

    const rutContraparte   = useReceptorAsContraparte ? rutReceptor   : rutEmisor
    const razonContraparte = useReceptorAsContraparte ? razonReceptor : razonEmisor

    if (!rutContraparte) { omitidos++; continue }

    const fechaISO   = excelSerialToISO(dataRow[2])
    const mesDevengo = fechaISO ? fechaISO.slice(0, 7) : ''

    registros.push({
      cliente_id:           clienteId,
      lote_id:              loteId,
      rut_contraparte:      rutContraparte,
      razon_social:         razonContraparte,
      numero_documento:     String(dataRow[1] ?? ''),
      tipo_documento:       DTE_TIPO_MAP[tipoDTENum] ?? `Tipo ${tipoDTENum}`,
      tipo_obligacion:      '',
      fecha_emision:        fechaISO,
      fecha_devengo:        null,
      fecha_vencimiento:    null,
      mes_devengo:          mesDevengo,
      monto_neto:           toNumber(dataRow[19]),
      monto_exento:         toNumber(dataRow[20]),
      monto_iva:            toNumber(dataRow[21]),
      iva_no_recuperable:   0,
      otros_impuestos:      0,
      retencion_honorarios: 0,
      monto_bruto:          toNumber(dataRow[22]),
      monto_base:           0,
      monto_calculado:      0,
      porcentaje:           null,
      anula_o_modifica:     '',
      categoria_madre:      '',
      sub_cuenta:           '',
      detalle_gasto:        '',
      estado_clasificacion: 'pendiente',
    })
  }

  return { registros, omitidos }
}



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server Action: procesarExcelSII
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Parse a Libro de Compras SII .xlsx file and bulk-insert the rows into
 * `registro_compras_sii`.
 *
 * FormData fields:
 *  - `archivo`    â€” the .xlsx / .xls file (File)
 *  - `cliente_id` â€” UUID of the target account (optional; defaults to the
 *                   caller's effective user id). Admins may pass any client id.
 */
export async function procesarExcelSII(formData: FormData): Promise<ProcesarResult> {
  // â”€â”€ 1. Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return {
      ok: false,
      insertados: 0,
      omitidos: 0,
      errores: [],
      message: 'Sesión expirada. Vuelve a iniciar sesión.',
    }
  }

  // â”€â”€ 2. Inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const file = formData.get('archivo') as File | null
  const clienteIdRaw = (formData.get('cliente_id') as string | null)?.trim()
  const clienteId = clienteIdRaw || effectiveUserId

  if (!file || file.size === 0) {
    return {
      ok: false,
      insertados: 0,
      omitidos: 0,
      errores: [],
      message: 'No se recibió ningún archivo.',
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
    return {
      ok: false,
      insertados: 0,
      omitidos: 0,
      errores: [],
      message: 'Formato no soportado. Sube un archivo .xlsx, .xls o .csv.',
    }
  }

  // â”€â”€ 3. Authorization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // If importing on behalf of another user, caller must be admin.
  if (clienteId !== effectiveUserId) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (callerProfile?.role !== 'admin') {
      return {
        ok: false,
        insertados: 0,
        omitidos: 0,
        errores: [],
        message: 'No tienes permiso para importar datos de otro usuario.',
      }
    }
  }

  // â”€â”€ 4. Parse Excel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SII Libro de Compras exports often include 2-5 metadata rows before the
  // actual column headers (title, period, blank lines, etc.).
  // We read everything as raw arrays first, detect which row is the real
  // header by counting COLUMN_MAP matches, then rebuild keyed objects from
  // that row onward.
  // Pre-parsed registros when the file is a DTE download format
  let preBuiltDTE: { registros: RegistroCompra[]; omitidos: number } | null = null

  let rawRows: Record<string, unknown>[]

  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellDates: true,  // convert Excel date serials â†’ JS Date objects
      cellNF: false,
      cellText: false,
    })

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return {
        ok: false,
        insertados: 0,
        omitidos: 0,
        errores: [],
        message: 'El archivo Excel no contiene hojas de cálculo.',
      }
    }

    // Read every row as a plain array (no header inference)
    const allArrayRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      { header: 1, defval: '' },
    )

    if (allArrayRows.length === 0) {
      return {
        ok: false,
        insertados: 0,
        omitidos: 0,
        errores: [],
        message: 'El archivo no contiene filas de datos.',
      }
    }

    // DTE Download format detection
    if (isDTEDownloadFormat(allArrayRows)) {
      const dteloteId = crypto.randomUUID()
      preBuiltDTE = parseDTEDownload(allArrayRows, clienteId, dteloteId)
      rawRows = []
    } else {
    // â”€â”€ Auto-detect the header row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Scan up to the first 25 rows; pick the one with the most COLUMN_MAP hits.
    let headerRowIdx = -1
    let bestMatchCount = 0

    for (let i = 0; i < Math.min(allArrayRows.length, 25); i++) {
      let matchCount = 0
      for (const cell of allArrayRows[i]) {
        if (COLUMN_MAP[normalizeHeader(cell)]) matchCount++
      }
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount
        headerRowIdx = i
      }
    }

    if (headerRowIdx === -1 || bestMatchCount < 2) {
      // Build a diagnostic snippet of what was found
      const firstCells = (allArrayRows[0] ?? [])
        .slice(0, 6)
        .map((c) => String(c ?? '').trim())
        .filter(Boolean)
        .join(' | ')
      return {
        ok: false,
        insertados: 0,
        omitidos: 0,
        errores: [],
        message:
          `No se encontraron encabezados reconocibles en el archivo ` +
          `(mejor coincidencia: ${bestMatchCount} columnas en fila ${headerRowIdx + 1}). ` +
          `Primeras celdas: "${firstCells}". ` +
          `Verifica que el archivo sea un Libro de Compras SII válido.`,
      }
    }

    // Build a map of column-index â†’ raw header text
    const headerRow = allArrayRows[headerRowIdx]
    const colIndexToRawHeader = new Map<number, string>()
    for (let ci = 0; ci < headerRow.length; ci++) {
      const raw = String(headerRow[ci] ?? '').trim()
      if (raw) colIndexToRawHeader.set(ci, raw)
    }

    // Convert data rows to Record<rawHeader, cellValue>
    rawRows = allArrayRows.slice(headerRowIdx + 1).map((rowArr) => {
      const obj: Record<string, unknown> = {}
      for (const [ci, rawHeader] of colIndexToRawHeader) {
        obj[rawHeader] = (rowArr as unknown[])[ci] ?? ''
      }
      return obj
    })
    } // end else (not DTE format)
  } catch (err) {
    return {
      ok: false,
      insertados: 0,
      omitidos: 0,
      errores: [],
      message: `Error al leer el archivo: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (rawRows.length === 0 && preBuiltDTE === null) {
    return {
      ok: false,
      insertados: 0,
      omitidos: 0,
      errores: [],
      message: 'El archivo no contiene filas de datos después de los encabezados.',
    }
  }

  // â”€â”€ 5. Build column-to-field map from the headers present â”€
  const firstRow = rawRows[0] ?? {}
  const headerMapping: Partial<Record<string, MappableField>> = {}

  for (const rawHeader of Object.keys(firstRow)) {
    const norm = normalizeHeader(rawHeader)
    const mapped = COLUMN_MAP[norm]
    if (mapped) headerMapping[rawHeader] = mapped
  }

  // â”€â”€ 6. Map rows â†’ RegistroCompra records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // One UUID groups every row from this single import invocation.
  const loteId = crypto.randomUUID()

  const errores: string[] = []
  const registros: RegistroCompra[] = []
  if (preBuiltDTE !== null) registros.push(...preBuiltDTE.registros)

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]

    const record: RegistroCompra = {
      cliente_id: clienteId,
      lote_id: loteId,
      rut_contraparte: '',
      razon_social: '',
      numero_documento: '',
      tipo_documento: '',
      tipo_obligacion: '',
      fecha_emision: null,
      fecha_devengo: null,
      fecha_vencimiento: null,
      mes_devengo: '',
      monto_neto: 0,
      monto_exento: 0,
      monto_iva: 0,
      iva_no_recuperable: 0,
      otros_impuestos: 0,
      retencion_honorarios: 0,
      monto_bruto: 0,
      monto_base: 0,
      monto_calculado: 0,
      porcentaje: null,
      anula_o_modifica: '',
      categoria_madre: '',
      sub_cuenta: '',
      detalle_gasto: '',
      estado_clasificacion: 'pendiente',
    }

    const NUMERIC_FIELDS = new Set<MappableField>([
      'monto_neto', 'monto_exento', 'monto_iva', 'iva_no_recuperable',
      'otros_impuestos', 'retencion_honorarios', 'monto_bruto',
      'monto_base', 'monto_calculado', 'porcentaje',
    ])

    const DATE_FIELDS = new Set<MappableField>([
      'fecha_emision', 'fecha_devengo', 'fecha_vencimiento',
    ])

    for (const [rawHeader, fieldName] of Object.entries(headerMapping)) {
      const value = row[rawHeader]
      if (NUMERIC_FIELDS.has(fieldName)) {
        const n = toNumber(value)
        // porcentaje can be null when cell is truly empty
        if (fieldName === 'porcentaje') {
          record.porcentaje = (value === '' || value === null || value === undefined) ? null : n
        } else {
          // TypeScript cast: all numeric fields accept number
          ;(record as Record<string, unknown>)[fieldName] = n
        }
      } else if (DATE_FIELDS.has(fieldName)) {
        const iso = toDateISO(value)
        ;(record as Record<string, unknown>)[fieldName] = iso
        // Derive mes_devengo (YYYYMM) from fecha_devengo when available
        if (fieldName === 'fecha_devengo' && iso) {
          record.mes_devengo = iso.slice(0, 7).replace('-', '')
        }
      } else {
        ;(record as Record<string, unknown>)[fieldName] = String(value ?? '').trim()
      }
    }

    // Skip rows that are completely empty (common in SII exports with footer totals)
    if (!record.rut_contraparte && !record.numero_documento && record.monto_bruto === 0) {
      continue
    }

    if (!record.rut_contraparte) {
      errores.push(`Fila ${i + 2}: sin rut_contraparte â€” fila omitida.`)
      continue
    }

    registros.push(record)
  }

  if (registros.length === 0) {
    return {
      ok: false,
      insertados: 0,
      omitidos: rawRows.length,
      errores,
      message:
        'No se encontraron registros válidos. Verifica que las columnas del Excel coincidan con el formato esperado del SII.',
    }
  }

  // â”€â”€ 7. Bulk insert in batches of 500 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const CHUNK_SIZE = 500
  let insertados = 0

  for (let start = 0; start < registros.length; start += CHUNK_SIZE) {
    const chunk = registros.slice(start, start + CHUNK_SIZE)
    const { error } = await supabase.from('registro_compras_sii').insert(chunk)

    if (error) {
      errores.push(
        `Error en lote ${Math.floor(start / CHUNK_SIZE) + 1} (filas ${start + 2}â€“${start + chunk.length + 1}): ${error.message}`,
      )
    } else {
      insertados += chunk.length
    }
  }

  // â”€â”€ 8. Audit log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (insertados > 0) {
    await logAudit(supabase, {
      action_type: 'IMPORT_EXCEL',
      description: `Importación SII: ${insertados} registros insertados para cliente ${clienteId} desde "${file.name}".`,
      target_type: 'registro_compras_sii',
      target_label: file.name,
      metadata: {
        cliente_id: clienteId,
        lote_id: loteId,
        archivo: file.name,
        insertados,
        omitidos: rawRows.length - registros.length,
        errores: errores.length,
      },
    })
  }

  return {
    ok: insertados > 0,
    insertados,
    omitidos: rawRows.length - registros.length,
    errores,
    message:
      insertados > 0
        ? `Importación completada: ${insertados} registro${insertados !== 1 ? 's' : ''} insertado${insertados !== 1 ? 's' : ''}${errores.length > 0 ? ` (${errores.length} advertencia${errores.length !== 1 ? 's' : ''})` : ''}.`
        : 'No se pudo importar ningún registro.',
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server Action: obtenerGastosPorContraparte
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns the purchase records grouped by `rut_contraparte` for the given
 * `clienteId`, summing `monto_bruto` and counting pending/classified rows.
 *
 * Delegates the aggregation to the `gastos_por_contraparte` PostgreSQL
 * function (migration 012) so that grouping happens inside the database.
 */
export async function obtenerGastosPorContraparte(
  clienteId: string,
): Promise<GastosResult> {
  if (!clienteId?.trim()) {
    return { ok: false, data: [], message: 'cliente_id requerido.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], message: 'Sesión expirada.' }
  }

  // Only the owner (or sub-users via effective_user_id) or an admin may query.
  if (clienteId !== effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role !== 'admin') {
      return {
        ok: false,
        data: [],
        message: 'Sin permisos para consultar datos de otro usuario.',
      }
    }
  }

  const { data, error } = await supabase.rpc('gastos_por_contraparte', {
    p_cliente_id: clienteId,
  })

  if (error) {
    return {
      ok: false,
      data: [],
      message: `Error al consultar datos: ${error.message}`,
    }
  }

  return { ok: true, data: (data ?? []) as GastoPorContraparte[] }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server Action: obtenerHistorialCargas
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns the upload history for a given cliente_id by reading IMPORT_EXCEL
 * entries in audit_logs whose metadata contains the matching cliente_id.
 * Only admins or the owner themselves may call this.
 */
export async function obtenerHistorialCargas(
  clienteId: string,
): Promise<HistorialResult> {
  if (!clienteId?.trim()) {
    return { ok: false, data: [], message: 'cliente_id requerido.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role !== 'admin') {
      return { ok: false, data: [], message: 'Sin permisos.' }
    }
  }

  // Filter audit_logs by action_type and JSONB containment on cliente_id
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, target_label, metadata')
    .eq('action_type', 'IMPORT_EXCEL')
    .contains('metadata', { cliente_id: clienteId })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return { ok: false, data: [], message: `Error al obtener historial: ${error.message}` }
  }

  const cargas: HistorialCarga[] = (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      archivo: (meta.archivo as string | undefined) ?? (row.target_label as string | undefined) ?? 'Archivo desconocido',
      insertados: Number(meta.insertados ?? 0),
      omitidos: Number(meta.omitidos ?? 0),
      errores: Number(meta.errores ?? 0),
      lote_id: (meta.lote_id as string | undefined) ?? null,
    }
  })

  return { ok: true, data: cargas }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server Action: obtenerRegistrosPorLote
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MAX_DETALLE_ROWS = 10_000

/**
 * Returns raw rows from registro_compras_sii for a specific import batch
 * (lote_id). Capped at MAX_DETALLE_ROWS rows for UI performance.
 */
export async function obtenerRegistrosPorLote(
  clienteId: string,
  loteId: string,
): Promise<RegistrosDetalleResult> {
  if (!clienteId?.trim() || !loteId?.trim()) {
    return { ok: false, data: [], total: 0, message: 'Parámetros requeridos.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], total: 0, message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role !== 'admin') {
      return { ok: false, data: [], total: 0, message: 'Sin permisos.' }
    }
  }

  // Count first for the header
  const { count } = await supabase
    .from('registro_compras_sii')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('lote_id', loteId)

  const { data, error } = await supabase
    .from('registro_compras_sii')
    .select(
      `id, lote_id,
       rut_contraparte, razon_social,
       numero_documento, tipo_documento, tipo_obligacion,
       fecha_emision, fecha_devengo, fecha_vencimiento, mes_devengo,
       monto_neto, monto_exento, monto_iva, iva_no_recuperable,
       otros_impuestos, retencion_honorarios, monto_bruto,
       monto_base, monto_calculado, porcentaje,
       anula_o_modifica,
       categoria_madre, sub_cuenta, detalle_gasto,
       estado_clasificacion, created_at`,
    )
    .eq('cliente_id', clienteId)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: true })
    .limit(MAX_DETALLE_ROWS)

  if (error) {
    return { ok: false, data: [], total: 0, message: `Error: ${error.message}` }
  }

  return {
    ok: true,
    data: (data ?? []) as RegistroDetalle[],
    total: count ?? 0,
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Server Action: obtenerTodosRegistrosCliente
// Fallback used when an audit log entry has no lote_id (pre-migration imports).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function obtenerTodosRegistrosCliente(
  clienteId: string,
): Promise<RegistrosDetalleResult> {
  if (!clienteId?.trim()) {
    return { ok: false, data: [], total: 0, message: 'cliente_id requerido.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], total: 0, message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role !== 'admin') {
      return { ok: false, data: [], total: 0, message: 'Sin permisos.' }
    }
  }

  const { count } = await supabase
    .from('registro_compras_sii')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  const { data, error } = await supabase
    .from('registro_compras_sii')
    .select(
      `id, lote_id,
       rut_contraparte, razon_social,
       numero_documento, tipo_documento, tipo_obligacion,
       fecha_emision, fecha_devengo, fecha_vencimiento, mes_devengo,
       monto_neto, monto_exento, monto_iva, iva_no_recuperable,
       otros_impuestos, retencion_honorarios, monto_bruto,
       monto_base, monto_calculado, porcentaje,
       anula_o_modifica,
       categoria_madre, sub_cuenta, detalle_gasto,
       estado_clasificacion, created_at`,
    )
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(MAX_DETALLE_ROWS)

  if (error) {
    return { ok: false, data: [], total: 0, message: `Error: ${error.message}` }
  }

  return {
    ok: true,
    data: (data ?? []) as RegistroDetalle[],
    total: count ?? 0,
  }
}

// -----------------------------------------------------------------------------
// Server Action: eliminarLoteSII
// Deletes all registro_compras_sii rows for a specific import batch and
// removes the corresponding audit_log entry. Admin-only.
// -----------------------------------------------------------------------------

export interface EliminarLoteResult {
  ok: boolean
  eliminados: number
  message: string
}

export async function eliminarLoteSII(
  clienteId: string,
  loteId: string,
  auditLogId: string,
): Promise<EliminarLoteResult> {
  if (!clienteId?.trim() || !loteId?.trim()) {
    return { ok: false, eliminados: 0, message: 'Parámetros inválidos.' }
  }

  const supabase = await createClient()
  const { userId } = await getEffectiveUserId(supabase)

  if (!userId) {
    return { ok: false, eliminados: 0, message: 'Sesión expirada.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return { ok: false, eliminados: 0, message: 'Solo administradores pueden eliminar importaciones.' }
  }

  const { count } = await supabase
    .from('registro_compras_sii')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('lote_id', loteId)

  const { error: deleteError } = await supabase
    .from('registro_compras_sii')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('lote_id', loteId)

  if (deleteError) {
    return { ok: false, eliminados: 0, message: `Error al eliminar: ${deleteError.message}` }
  }

  const eliminados = count ?? 0

  if (auditLogId) {
    await supabase.from('audit_logs').delete().eq('id', auditLogId)
  }

  await logAudit(supabase, {
    action_type: 'DELETE_IMPORT',
    description: `Admin eliminó importación SII (lote ${loteId}) de cliente ${clienteId}: ${eliminados} registros borrados.`,
    target_type: 'registro_compras_sii',
    target_id: loteId,
    metadata: { cliente_id: clienteId, lote_id: loteId, eliminados },
  })

  return {
    ok: true,
    eliminados,
    message: `Se eliminaron ${eliminados} registros correctamente.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: eliminarTodosRegistrosSII
// Hard-deletes ALL registro_compras_sii rows for a client plus their
// IMPORT_EXCEL audit log entries. Admin-only. Called after the undo window
// expires in the UI.
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarTodosRegistrosSII(
  clienteId: string,
): Promise<EliminarLoteResult> {
  if (!clienteId?.trim()) {
    return { ok: false, eliminados: 0, message: 'cliente_id requerido.' }
  }

  const supabase = await createClient()
  const { userId } = await getEffectiveUserId(supabase)

  if (!userId) {
    return { ok: false, eliminados: 0, message: 'Sesión expirada.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return { ok: false, eliminados: 0, message: 'Solo administradores pueden eliminar importaciones.' }
  }

  const { count } = await supabase
    .from('registro_compras_sii')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  const { error: deleteError } = await supabase
    .from('registro_compras_sii')
    .delete()
    .eq('cliente_id', clienteId)

  if (deleteError) {
    return { ok: false, eliminados: 0, message: `Error al eliminar: ${deleteError.message}` }
  }

  const eliminados = count ?? 0

  // Remove all IMPORT_EXCEL audit entries for this client
  await supabase
    .from('audit_logs')
    .delete()
    .eq('action_type', 'IMPORT_EXCEL')
    .contains('metadata', { cliente_id: clienteId })

  await logAudit(supabase, {
    action_type: 'DELETE_IMPORT',
    description: `Admin eliminó TODAS las importaciones SII del cliente ${clienteId}: ${eliminados} registros borrados.`,
    target_type: 'registro_compras_sii',
    target_id: clienteId,
    metadata: { cliente_id: clienteId, eliminados, scope: 'all' },
  })

  return {
    ok: true,
    eliminados,
    message: `Se eliminaron ${eliminados} registros correctamente.`,
  }
}