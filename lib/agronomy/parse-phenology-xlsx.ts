import * as XLSX from 'xlsx'

const ROW_LABELS = new Set([
  'Temporada',
  'Fecha',
  'Variedad',
  'Estado Fenologico',
  'Estado Fenológico',
  'Hilera',
  'Arbol',
  'Árbol',
])

export interface ParsedPhenologyObservation {
  block_name: string
  season_label: string
  observed_at: string
  variety: string | null
  stage_name: string
  hilera: number | null
  arbol: number | null
  crop: string
}

function excelDateToIso(value: unknown): string | null {
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
  for (let i = start; i < Math.min(start + 8, data.length); i++) {
    const row = data[i]
    if (!row || str(row[0]) !== label) continue
    return row
  }
  return null
}

export function parsePhenologyWorkbook(
  buffer: ArrayBuffer,
  crop = 'Arándano',
): ParsedPhenologyObservation[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const out: ParsedPhenologyObservation[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

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

      if (!dateRow || !stageRow) continue

      const maxCol = Math.max(
        dateRow.length,
        stageRow.length,
        seasonRow?.length ?? 0,
        varietyRow?.length ?? 0,
        hileraRow?.length ?? 0,
        arbolRow?.length ?? 0,
      )

      for (let col = 1; col < maxCol; col++) {
        const observedAt = excelDateToIso(dateRow[col])
        const stageName = str(stageRow[col])
        if (!observedAt || !stageName) continue

        out.push({
          block_name: blockName,
          season_label: str(seasonRow?.[col]) ?? str(seasonRow?.[1]) ?? '',
          observed_at: observedAt,
          variety: str(varietyRow?.[col]),
          stage_name: stageName,
          hilera: num(hileraRow?.[col]),
          arbol: num(arbolRow?.[col]),
          crop,
        })
      }
    }
  }

  return out
}

export function parsePhenologyFile(file: File, crop = 'Arándano'): Promise<ParsedPhenologyObservation[]> {
  return file.arrayBuffer().then((buf) => parsePhenologyWorkbook(buf, crop))
}
