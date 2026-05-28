import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'

const ROW_LABELS = new Set([
  'Temporada',
  'Fecha',
  'Variedad',
  'Estado Fenologico',
  'Estado Fenológico',
  'Hilera',
  'Arbol',
  'Árbol',
  'Notas',
  'Imagenes',
  'Imágenes',
])

export interface ParsedEmbeddedImage {
  buffer: ArrayBuffer
  extension: 'jpeg' | 'png' | 'gif' | 'webp'
}

export interface ParsedPhenologyObservation {
  block_name: string
  season_label: string
  observed_at: string
  variety: string | null
  stage_name: string
  hilera: number | null
  arbol: number | null
  notes: string | null
  crop: string
  embeddedImages: ParsedEmbeddedImage[]
}

export interface PhenologyStageRef {
  id: string
  stage_name: string
  stage_code: string | null
}

export interface ResolvedStage {
  stage_id: string | null
  stage_name: string
  catalogMatch: boolean
}

export function phenologyObservationKey(row: {
  block_name: string
  season_label: string
  observed_at: string
  variety: string | null
  crop: string
}): string {
  return [
    row.crop,
    row.block_name.trim().toLowerCase(),
    row.season_label.trim().toLowerCase(),
    row.observed_at,
    (row.variety ?? '').trim().toLowerCase(),
  ].join('|')
}

export function resolveStageFromCatalog(
  stageName: string,
  stages: PhenologyStageRef[],
): ResolvedStage {
  const trimmed = stageName.trim()
  const normalized = trimmed.toLowerCase()
  if (!normalized) {
    return { stage_id: null, stage_name: trimmed, catalogMatch: false }
  }

  const exact = stages.find((s) => s.stage_name.trim().toLowerCase() === normalized)
  if (exact) {
    return { stage_id: exact.id, stage_name: exact.stage_name, catalogMatch: true }
  }

  const byCode = stages.find(
    (s) => s.stage_code && s.stage_code.trim().toLowerCase() === normalized,
  )
  if (byCode) {
    return { stage_id: byCode.id, stage_name: byCode.stage_name, catalogMatch: true }
  }

  return { stage_id: null, stage_name: trimmed, catalogMatch: false }
}

function excelDateToIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date((value - 25569) * 86400000)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  if (typeof value === 'string' && value.trim()) {
    const iso = value.trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  }
  return null
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}

function str(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

function isBlockHeader(row: unknown[]): boolean {
  const label = str(row[0])
  if (!label || ROW_LABELS.has(label)) return false
  return row.slice(1).every((c) => c == null || c === '')
}

function readSectionRow(data: unknown[][], start: number, label: string): unknown[] | null {
  for (let i = start; i < Math.min(start + 10, data.length); i++) {
    const row = data[i]
    if (!row || str(row[0]) !== label) continue
    return row
  }
  return null
}

function toArrayBuffer(raw: unknown): ArrayBuffer | null {
  if (raw instanceof ArrayBuffer) return raw
  if (ArrayBuffer.isView(raw)) {
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  }
  return null
}

function detectImageExtension(bytes: ArrayBuffer, name?: string): ParsedEmbeddedImage['extension'] {
  const arr = new Uint8Array(bytes)
  const lower = (name ?? '').toLowerCase()
  if (arr[0] === 0x89 && arr[1] === 0x50) return 'png'
  if (arr[0] === 0x47 && arr[1] === 0x49) return 'gif'
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) return 'webp'
  if (lower.includes('.png')) return 'png'
  if (lower.includes('.gif')) return 'gif'
  if (lower.includes('.webp')) return 'webp'
  return 'jpeg'
}

function collectEmbeddedImages(
  worksheet: ExcelJS.Worksheet,
  workbook: ExcelJS.Workbook,
  imageRow0: number,
  weekCol0: number,
): ParsedEmbeddedImage[] {
  const out: ParsedEmbeddedImage[] = []

  for (const image of worksheet.getImages()) {
    const tl = image.range.tl
    const imgRow = typeof tl.row === 'number' ? tl.row : tl.nativeRow ?? 0
    const imgCol = typeof tl.col === 'number' ? tl.col : tl.nativeCol ?? 0
    if (Math.round(imgCol) !== weekCol0) continue
    if (imgRow < imageRow0 - 0.5 || imgRow > imageRow0 + 25) continue

    const meta = workbook.getImage(Number(image.imageId))
    const buffer = toArrayBuffer(meta?.buffer)
    if (!buffer) continue
    out.push({
      buffer,
      extension: detectImageExtension(buffer, meta?.extension),
    })
  }

  return out
}

function parseRowsFromSheetData(
  data: unknown[][],
  crop: string,
  worksheet?: ExcelJS.Worksheet,
  workbook?: ExcelJS.Workbook,
): ParsedPhenologyObservation[] {
  const out: ParsedPhenologyObservation[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!Array.isArray(row) || !isBlockHeader(row)) continue

    const blockName = str(row[0])!
    const seasonRow = readSectionRow(data, i + 1, 'Temporada')
    const dateRow = readSectionRow(data, i + 1, 'Fecha')
    const varietyRow = readSectionRow(data, i + 1, 'Variedad')
    const stageRow = readSectionRow(data, i + 1, 'Estado Fenologico')
      ?? readSectionRow(data, i + 1, 'Estado Fenológico')
    const hileraRow = readSectionRow(data, i + 1, 'Hilera')
    const arbolRow = readSectionRow(data, i + 1, 'Arbol')
      ?? readSectionRow(data, i + 1, 'Árbol')
    const notesRow = readSectionRow(data, i + 1, 'Notas')

    if (!dateRow || !stageRow) continue

    const imagenesRow = data.findIndex(
      (r, idx) =>
        idx > i &&
        idx <= i + 10 &&
        (str(r?.[0]) === 'Imagenes' || str(r?.[0]) === 'Imágenes'),
    )
    const imageRow0 = imagenesRow >= 0 ? imagenesRow : i + (notesRow ? 7 : 6)

    const maxCol = Math.max(
      dateRow.length,
      stageRow.length,
      seasonRow?.length ?? 0,
      varietyRow?.length ?? 0,
      hileraRow?.length ?? 0,
      arbolRow?.length ?? 0,
      notesRow?.length ?? 0,
    )

    for (let col = 1; col < maxCol; col++) {
      const observedAt = excelDateToIso(dateRow[col])
      const stageName = str(stageRow[col])
      if (!observedAt || !stageName) continue

      const embeddedImages =
        worksheet && workbook
          ? collectEmbeddedImages(worksheet, workbook, imageRow0, col)
          : []

      out.push({
        block_name: blockName,
        season_label: str(seasonRow?.[col]) ?? str(seasonRow?.[1]) ?? '',
        observed_at: observedAt,
        variety: str(varietyRow?.[col]),
        stage_name: stageName,
        hilera: num(hileraRow?.[col]),
        arbol: num(arbolRow?.[col]),
        notes: str(notesRow?.[col]),
        crop,
        embeddedImages,
      })
    }
  }

  return out
}

function sheetToRows(worksheet: ExcelJS.Worksheet): unknown[][] {
  const data: unknown[][] = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const arr: unknown[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      arr[colNumber - 1] = cell.value
    })
    data[row.number - 1] = arr
  })
  return data
}

async function parsePhenologyExcelJS(buffer: ArrayBuffer, crop: string): Promise<ParsedPhenologyObservation[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const out: ParsedPhenologyObservation[] = []

  for (const worksheet of workbook.worksheets) {
    const data = sheetToRows(worksheet)
    out.push(...parseRowsFromSheetData(data, crop, worksheet, workbook))
  }

  return out
}

export function parsePhenologyWorkbook(
  buffer: ArrayBuffer,
  crop = 'Arándano',
): ParsedPhenologyObservation[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const out: ParsedPhenologyObservation[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
    out.push(...parseRowsFromSheetData(data, crop))
  }

  return out
}

export async function parsePhenologyFile(
  file: File,
  crop = 'Arándano',
): Promise<ParsedPhenologyObservation[]> {
  const buf = await file.arrayBuffer()
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xlsx')) {
    return parsePhenologyExcelJS(buf, crop)
  }
  return parsePhenologyWorkbook(buf, crop)
}
