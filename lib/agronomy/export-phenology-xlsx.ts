import ExcelJS from 'exceljs'
import { BRAND_NAME } from '@/lib/brand'
import {
  UPCROP_HEADER_FILL,
  UPCROP_SUMMARY_FILL,
  UPCROP_THIN_BORDER,
  UPCROP_FONT,
  applyBrandedReportHeader,
  triggerExcelDownload,
} from '@/lib/excel/upcrop-excel-theme'

export interface PhenologyExportImage {
  storage_path: string
  file_name: string
  mime_type?: string | null
}

export interface PhenologyExportRow {
  block_name: string
  season_label: string
  observed_at: string
  variety: string | null
  stage_name: string
  hilera: number | null
  arbol: number | null
  notes: string | null
  images?: PhenologyExportImage[]
}

const IMAGE_WIDTH = 200
const IMAGE_HEIGHT = 200
const ROWS_PER_IMAGE = 15

function isWebp(path: string, mime?: string | null): boolean {
  const lower = `${path} ${mime ?? ''}`.toLowerCase()
  return lower.includes('webp')
}

function imageExtension(path: string, mime?: string | null): 'jpeg' | 'png' | 'gif' | null {
  const lower = `${path} ${mime ?? ''}`.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('gif')) return 'gif'
  if (lower.includes('webp')) return null
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpeg'
  return 'jpeg'
}

async function convertWebpToJpeg(buffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  if (typeof document === 'undefined') return null

  return new Promise((resolve) => {
    const blob = new Blob([buffer], { type: 'image/webp' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (jpegBlob) => {
          URL.revokeObjectURL(url)
          if (!jpegBlob) {
            resolve(null)
            return
          }
          jpegBlob.arrayBuffer().then(resolve).catch(() => resolve(null))
        },
        'image/jpeg',
        0.92,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    img.src = url
  })
}

async function normalizeImageForExcel(
  buffer: ArrayBuffer,
  path: string,
  mime?: string | null,
): Promise<{ buffer: ArrayBuffer; ext: 'jpeg' | 'png' | 'gif' } | null> {
  const ext = imageExtension(path, mime)
  if (ext) return { buffer, ext }

  if (isWebp(path, mime)) {
    const jpeg = await convertWebpToJpeg(buffer)
    if (jpeg) return { buffer: jpeg, ext: 'jpeg' }
  }

  return null
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  triggerExcelDownload(buffer, filename)
}

async function writePhenologyReportHeader(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  options: { crop: string; seasonLabel: string; observationCount: number; blockCount: number; imageCount: number },
): Promise<number> {
  const lastCol = 'H'

  await applyBrandedReportHeader(workbook, sheet, {
    lastCol,
    title: 'REPORTE FENOLÓGICO',
    moduleLabel: 'Estados Fenológicos',
  })

  sheet.mergeCells('A5:H5')
  sheet.getCell('A5').value = 'Cómo leer este reporte'
  sheet.getCell('A5').font = UPCROP_FONT.instructionsTitle

  const instructions = [
    '1. Cada bloque corresponde a un cuartel; las columnas son observaciones en campo.',
    '2. Las filas Temporada, Fecha, Variedad y Estado resumen cada visita.',
    '3. Las imágenes se incluyen embebidas cuando están disponibles en la bodega.',
  ]
  let row = 6
  for (const line of instructions) {
    sheet.mergeCells(`A${row}:H${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = line
    cell.font = UPCROP_FONT.instructionsBody
    cell.alignment = { wrapText: true }
    row++
  }

  sheet.mergeCells(`A${row + 1}:H${row + 1}`)
  const summaryCell = sheet.getCell(`A${row + 1}`)
  summaryCell.value = `Resumen: ${options.crop} · Temporada ${options.seasonLabel} · ${options.observationCount} observación${options.observationCount !== 1 ? 'es' : ''} · ${options.blockCount} cuartel${options.blockCount !== 1 ? 'es' : ''} · ${options.imageCount} foto${options.imageCount !== 1 ? 's' : ''}`
  summaryCell.font = UPCROP_FONT.summary
  summaryCell.fill = UPCROP_SUMMARY_FILL
  summaryCell.alignment = { vertical: 'middle', wrapText: true }
  sheet.getRow(row + 1).height = 24

  return row + 3
}

export async function exportPhenologyToExcel(
  rows: PhenologyExportRow[],
  options: {
    crop: string
    seasonLabel: string
    onProgress?: (message: string) => void
  },
  fetchImage: (path: string) => Promise<ArrayBuffer | null>,
): Promise<{ embedded: number; skipped: number; webpConverted: number }> {
  if (rows.length === 0) return { embedded: 0, skipped: 0, webpConverted: 0 }

  options.onProgress?.('Preparando exportación…')

  const byBlock = new Map<string, PhenologyExportRow[]>()
  for (const row of rows) {
    const list = byBlock.get(row.block_name) ?? []
    list.push(row)
    byBlock.set(row.block_name, list)
  }

  const totalImages = rows.reduce((sum, row) => sum + (row.images?.length ?? 0), 0)
  let processedImages = 0

  const workbook = new ExcelJS.Workbook()
  workbook.creator = BRAND_NAME
  workbook.created = new Date()
  const sheetName = `${options.crop} ${options.seasonLabel}`.slice(0, 31)
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  })

  let currentRow = await writePhenologyReportHeader(workbook, sheet, {
    crop: options.crop,
    seasonLabel: options.seasonLabel,
    observationCount: rows.length,
    blockCount: byBlock.size,
    imageCount: totalImages,
  })
  let embedded = 0
  let skipped = 0
  let webpConverted = 0

  for (const blockName of [...byBlock.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
    const sorted = [...(byBlock.get(blockName) ?? [])].sort((a, b) => a.observed_at.localeCompare(b.observed_at))

    const blockTitleRow = sheet.getRow(currentRow)
    sheet.mergeCells(currentRow, 1, currentRow, Math.max(8, sorted.length + 1))
    blockTitleRow.values = [blockName]
    blockTitleRow.height = 22
    blockTitleRow.eachCell((cell) => {
      cell.font = UPCROP_FONT.header
      cell.fill = UPCROP_HEADER_FILL
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      cell.border = UPCROP_THIN_BORDER
    })
    currentRow++

    const dataRows: Array<[string, ...unknown[]]> = [
      ['Temporada', ...sorted.map((o) => o.season_label)],
      ['Fecha', ...sorted.map((o) => o.observed_at)],
      ['Variedad', ...sorted.map((o) => o.variety ?? '')],
      ['Estado Fenologico', ...sorted.map((o) => o.stage_name)],
      ['Hilera', ...sorted.map((o) => o.hilera ?? '')],
      ['Arbol', ...sorted.map((o) => o.arbol ?? '')],
      ['Notas', ...sorted.map((o) => o.notes ?? '')],
      ['Imagenes', ...sorted.map(() => '')],
    ]

    for (const rowData of dataRows) {
      sheet.getRow(currentRow).values = rowData
      currentRow++
    }

    const imageRowNumber = currentRow - 1
    const maxImages = Math.max(0, ...sorted.map((o) => o.images?.length ?? 0))
    if (maxImages > 0) {
      sheet.getRow(imageRowNumber).height = maxImages * (IMAGE_HEIGHT * 0.75)
    }

    for (let col = 0; col < sorted.length; col++) {
      sheet.getColumn(col + 2).width = 28
      const images = sorted[col].images ?? []

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        processedImages++
        if (totalImages > 0) {
          options.onProgress?.(`Descargando fotos (${processedImages} de ${totalImages})…`)
        }
        const rawBuffer = await fetchImage(img.storage_path)
        if (!rawBuffer) {
          skipped++
          continue
        }

        const wasWebp = isWebp(img.storage_path, img.mime_type)
        const normalized = await normalizeImageForExcel(rawBuffer, img.storage_path, img.mime_type)
        if (!normalized) {
          skipped++
          continue
        }
        if (wasWebp) webpConverted++

        const imageId = workbook.addImage({ buffer: normalized.buffer, extension: normalized.ext })
        sheet.addImage(imageId, {
          tl: {
            col: col + 1,
            row: imageRowNumber - 1 + (i * ROWS_PER_IMAGE) / 15,
          },
          ext: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
        })
        embedded++
      }
    }

    currentRow++
  }

  const safeCrop = options.crop.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '-')
  const safeSeason = options.seasonLabel.replace(/\s+/g, '')
  const filename = `fenologia-${safeCrop}-${safeSeason}.xlsx`
  options.onProgress?.('Generando archivo Excel…')
  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(buffer, filename)

  return { embedded, skipped, webpConverted }
}
