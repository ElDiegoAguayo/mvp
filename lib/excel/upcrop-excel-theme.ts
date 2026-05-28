import ExcelJS from 'exceljs'

/** Tokens de marca UpCrop — alineados con app/globals.css (--primary #4063ca) */
export const UPCROP_COLORS = {
  primary: 'FF4063CA',
  primaryDark: 'FF2E4BA0',
  primaryDeep: 'FF1F3784',
  primaryLight: 'FF5B7AD6',
  accent: 'FFDBEAFE',
  accentSoft: 'FFEEF2FC',
  background: 'FFFFFFFF',
  card: 'FFF5F5F4',
  foreground: 'FF0A0A0A',
  muted: 'FF737373',
  border: 'FFD6D3D1',
  white: 'FFFFFFFF',
  destructive: 'FFDC2626',
  destructiveSoft: 'FFFDECEC',
  success: 'FF16A34A',
} as const

export const UPCROP_TITLE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.primary },
}

export const UPCROP_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.primaryDark },
}

export const UPCROP_SUMMARY_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.accent },
}

export const UPCROP_ROW_ALT_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.card },
}

export const UPCROP_ROW_WHITE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.background },
}

export const UPCROP_THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: UPCROP_COLORS.border } },
  left: { style: 'thin', color: { argb: UPCROP_COLORS.border } },
  bottom: { style: 'thin', color: { argb: UPCROP_COLORS.border } },
  right: { style: 'thin', color: { argb: UPCROP_COLORS.border } },
}

export const UPCROP_FONT = {
  title: { bold: true, size: 16, color: { argb: UPCROP_COLORS.white } } satisfies Partial<ExcelJS.Font>,
  subtitle: { size: 10, color: { argb: UPCROP_COLORS.muted } } satisfies Partial<ExcelJS.Font>,
  instructionsTitle: { bold: true, size: 12, color: { argb: UPCROP_COLORS.primaryDark } } satisfies Partial<ExcelJS.Font>,
  instructionsBody: { size: 10, color: { argb: UPCROP_COLORS.foreground } } satisfies Partial<ExcelJS.Font>,
  summary: { bold: true, size: 10, color: { argb: UPCROP_COLORS.primaryDeep } } satisfies Partial<ExcelJS.Font>,
  header: { bold: true, size: 10, color: { argb: UPCROP_COLORS.white } } satisfies Partial<ExcelJS.Font>,
  brandWordmark: { bold: true, size: 13, color: { argb: UPCROP_COLORS.primary } } satisfies Partial<ExcelJS.Font>,
}

export const UPCROP_LOGO_PATH = '/logo-upcrop-export.png'
/** Proporción original del lockup horizontal (icono + “up crop”) */
export const UPCROP_LOGO_NATURAL = { width: 837, height: 221 }
export const UPCROP_LOGO_DISPLAY_HEIGHT = 32

export function upCropLogoDisplayWidth(height = UPCROP_LOGO_DISPLAY_HEIGHT): number {
  return Math.round((UPCROP_LOGO_NATURAL.width / UPCROP_LOGO_NATURAL.height) * height)
}

let logoBufferCache: { path: string; buffer: ArrayBuffer | null } | undefined

export async function loadUpCropLogoBuffer(): Promise<ArrayBuffer | null> {
  if (logoBufferCache?.path === UPCROP_LOGO_PATH) return logoBufferCache.buffer
  try {
    const res = await fetch(UPCROP_LOGO_PATH)
    if (!res.ok) {
      logoBufferCache = { path: UPCROP_LOGO_PATH, buffer: null }
      return null
    }
    const buffer = await res.arrayBuffer()
    logoBufferCache = { path: UPCROP_LOGO_PATH, buffer }
    return buffer
  } catch {
    logoBufferCache = { path: UPCROP_LOGO_PATH, buffer: null }
    return null
  }
}

export async function embedUpCropLogo(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  options?: {
    col?: number
    row?: number
    width?: number
    height?: number
  },
): Promise<boolean> {
  const buffer = await loadUpCropLogoBuffer()
  if (!buffer) return false

  const height = options?.height ?? UPCROP_LOGO_DISPLAY_HEIGHT
  const width = options?.width ?? upCropLogoDisplayWidth(height)
  const col = options?.col ?? 0
  const row = options?.row ?? 0
  const imageId = workbook.addImage({ buffer, extension: 'png' })

  sheet.addImage(imageId, {
    tl: { col: col + 0.15, row: row + 0.1 },
    ext: { width, height },
  })
  return true
}

/** Fila 1: logo + wordmark · Fila 2: título · Fila 3: subtítulo. Retorna fila donde empiezan instrucciones (5). */
export async function applyBrandedReportHeader(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  options: {
    lastCol: string
    title: string
    moduleLabel: string
    fechaStr?: string
  },
): Promise<{ instructionsStartRow: number }> {
  const { lastCol, title, moduleLabel } = options
  const fechaStr = options.fechaStr ?? formatExportDateTime()
  const colCount = parseColLetter(lastCol)

  const brandRow = sheet.getRow(1)
  brandRow.height = 40
  const brandBorder = {
    bottom: { style: 'thin' as const, color: { argb: UPCROP_COLORS.border } },
  }

  for (let c = 1; c <= colCount; c++) {
    const cell = sheet.getCell(1, c)
    cell.fill = UPCROP_ROW_WHITE_FILL
    cell.border = brandBorder
  }

  await embedUpCropLogo(workbook, sheet, { col: 0, row: 0 })

  sheet.mergeCells(`A2:${lastCol}2`)
  const titleCell = sheet.getCell('A2')
  titleCell.value = title
  titleCell.font = UPCROP_FONT.title
  titleCell.fill = UPCROP_TITLE_FILL
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 36

  sheet.mergeCells(`A3:${lastCol}3`)
  sheet.getCell('A3').value = `Generado: ${fechaStr}  ·  UpCrop — ${moduleLabel}`
  sheet.getCell('A3').font = UPCROP_FONT.subtitle
  sheet.getCell('A3').alignment = { horizontal: 'center' }

  return { instructionsStartRow: 5 }
}

export function colLetter(index: number): string {
  let n = index
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

export function parseColLetter(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n
}

export function triggerExcelDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function formatExportDateTime(date = new Date()): string {
  return date.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })
}

export type CellValue = string | number | boolean | null | undefined

export interface StyledReportOptions {
  sheetName: string
  title: string
  moduleLabel: string
  filename: string
  headers: string[]
  rows: CellValue[][]
  instructions?: string[]
  instructionsTitle?: string
  summary?: string
  columnWidths?: number[]
  numericColumns?: number[]
}

export async function exportStyledReportExcel(options: StyledReportOptions): Promise<void> {
  const {
    sheetName,
    title,
    moduleLabel,
    filename,
    headers,
    rows,
    instructions = [],
    instructionsTitle = 'Cómo leer este reporte',
    summary,
    columnWidths,
    numericColumns = [],
  } = options

  if (rows.length === 0) return

  const colCount = headers.length
  const lastCol = colLetter(colCount)
  const now = new Date()
  const fechaStr = formatExportDateTime(now)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'UpCrop'
  workbook.created = now

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  })

  const { instructionsStartRow } = await applyBrandedReportHeader(workbook, sheet, {
    lastCol,
    title,
    moduleLabel,
    fechaStr,
  })

  let nextRow = instructionsStartRow
  if (instructions.length > 0) {
    sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`)
    sheet.getCell(`A${nextRow}`).value = instructionsTitle
    sheet.getCell(`A${nextRow}`).font = UPCROP_FONT.instructionsTitle
    nextRow++

    for (const line of instructions) {
      sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`)
      const cell = sheet.getCell(`A${nextRow}`)
      cell.value = line
      cell.font = UPCROP_FONT.instructionsBody
      cell.alignment = { wrapText: true }
      nextRow++
    }
    nextRow++
  }

  const headerRowNum = nextRow
  const headerRow = sheet.getRow(headerRowNum)
  headerRow.values = headers
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = UPCROP_FONT.header
    cell.fill = UPCROP_HEADER_FILL
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = UPCROP_THIN_BORDER
  })

  rows.forEach((values, index) => {
    const rowNum = headerRowNum + 1 + index
    const row = sheet.getRow(rowNum)
    row.values = values
    const fill = index % 2 === 0 ? UPCROP_ROW_WHITE_FILL : UPCROP_ROW_ALT_FILL

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = UPCROP_THIN_BORDER
      cell.fill = fill
      cell.alignment = { vertical: 'middle', wrapText: true }
      if (numericColumns.includes(colNumber)) {
        cell.numFmt = '#,##0.##'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
    })
  })

  if (summary) {
    const summaryRowNum = headerRowNum + rows.length + 2
    sheet.mergeCells(`A${summaryRowNum}:${lastCol}${summaryRowNum}`)
    const summaryCell = sheet.getCell(`A${summaryRowNum}`)
    summaryCell.value = summary
    summaryCell.font = UPCROP_FONT.summary
    summaryCell.fill = UPCROP_SUMMARY_FILL
    summaryCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    sheet.getRow(summaryRowNum).height = 24
  }

  if (columnWidths?.length) {
    sheet.columns = columnWidths.map((width) => ({ width }))
  } else {
    sheet.columns = headers.map((h) => ({
      width: Math.min(48, Math.max(12, Math.ceil(h.length * 1.2))),
    }))
  }

  sheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum + rows.length, column: colCount },
  }

  sheet.views = [
    {
      state: 'frozen',
      ySplit: headerRowNum,
      showGridLines: false,
    },
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  triggerExcelDownload(buffer as ArrayBuffer, filename)
}
