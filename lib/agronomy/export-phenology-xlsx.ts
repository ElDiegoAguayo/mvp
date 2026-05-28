import ExcelJS from 'exceljs'

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
  images?: PhenologyExportImage[]
}

const IMAGE_WIDTH = 200
const IMAGE_HEIGHT = 200
const ROWS_PER_IMAGE = 15

function imageExtension(path: string, mime?: string | null): 'jpeg' | 'png' | 'gif' | null {
  const lower = `${path} ${mime ?? ''}`.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('gif')) return 'gif'
  if (lower.includes('webp')) return null
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpeg'
  return 'jpeg'
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
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

export async function exportPhenologyToExcel(
  rows: PhenologyExportRow[],
  options: {
    crop: string
    seasonLabel: string
    onProgress?: (message: string) => void
  },
  fetchImage: (path: string) => Promise<ArrayBuffer | null>,
): Promise<{ embedded: number; skipped: number }> {
  if (rows.length === 0) return { embedded: 0, skipped: 0 }

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
  const sheetName = `${options.crop} ${options.seasonLabel}`.slice(0, 31)
  const sheet = workbook.addWorksheet(sheetName)

  let currentRow = 1
  let embedded = 0
  let skipped = 0

  for (const blockName of [...byBlock.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
    const sorted = [...(byBlock.get(blockName) ?? [])].sort((a, b) => a.observed_at.localeCompare(b.observed_at))

    sheet.getRow(currentRow).values = [blockName]
    currentRow++

    const dataRows: Array<[string, ...unknown[]]> = [
      ['Temporada', ...sorted.map((o) => o.season_label)],
      ['Fecha', ...sorted.map((o) => o.observed_at)],
      ['Variedad', ...sorted.map((o) => o.variety ?? '')],
      ['Estado Fenologico', ...sorted.map((o) => o.stage_name)],
      ['Hilera', ...sorted.map((o) => o.hilera ?? '')],
      ['Arbol', ...sorted.map((o) => o.arbol ?? '')],
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
        const buffer = await fetchImage(img.storage_path)
        const ext = imageExtension(img.storage_path, img.mime_type)
        if (!buffer || !ext) {
          skipped++
          continue
        }

        const imageId = workbook.addImage({ buffer, extension: ext })
        // Col A = etiquetas; primera lectura en B (tl.col 0-based = 1)
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

  return { embedded, skipped }
}
