import ExcelJS from 'exceljs'
import { BRAND_NAME } from '@/lib/brand'
import {
  UPCROP_HEADER_FILL,
  UPCROP_SUMMARY_FILL,
  UPCROP_ROW_ALT_FILL,
  UPCROP_THIN_BORDER,
  UPCROP_COLORS,
  UPCROP_FONT,
  applyBrandedReportHeader,
  triggerExcelDownload,
  formatExportDateTime,
} from '@/lib/excel/upcrop-excel-theme'

export interface ListaCompraItem {
  descripcion: string
  stock_actual: number
  unidad_medida: string
  afecta: string[]
  sugerido_comprar: number
}

const URGENT_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.destructiveSoft },
}

const LOW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: UPCROP_COLORS.accentSoft },
}

const ALT_FILL = UPCROP_ROW_ALT_FILL

function urgenciaLabel(stock: number): string {
  if (stock <= 0) return 'URGENTE — Sin stock'
  return 'Revisar — Stock bajo'
}

function accionLabel(item: ListaCompraItem): string {
  const qty = Math.ceil(item.sugerido_comprar)
  if (item.stock_actual <= 0) {
    return qty > 0
      ? `Comprar ${qty.toLocaleString('es-CL')} ${item.unidad_medida} (sin stock)`
      : 'Reponer stock — consultar bodega'
  }
  return qty > 0
    ? `Comprar ${qty.toLocaleString('es-CL')} ${item.unidad_medida} adicionales`
    : 'Monitorear — stock limitado'
}

export async function exportListaCompraExcel(items: ListaCompraItem[]): Promise<void> {
  if (items.length === 0) return

  const workbook = new ExcelJS.Workbook()
  workbook.creator = BRAND_NAME
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Lista de compra', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  })

  const now = new Date()
  const fechaStr = formatExportDateTime(now)

  await applyBrandedReportHeader(workbook, sheet, {
    lastCol: 'H',
    title: 'LISTA DE COMPRA — INSUMOS CRÍTICOS DE EMBALAJE',
    moduleLabel: 'Planificación de Producción',
    fechaStr,
  })

  sheet.mergeCells('A5:H5')
  const instTitle = sheet.getCell('A5')
  instTitle.value = 'Qué hacer (para bodega / compras)'
  instTitle.font = UPCROP_FONT.instructionsTitle

  const instrucciones = [
    '1. Revisar los insumos en orden de prioridad (1 = más urgente).',
    '2. Pedir a compras la cantidad indicada en la columna "Cantidad a pedir".',
    '3. La columna "Acción" resume lo que hay que hacer en cada fila.',
    '4. Los códigos de embalaje que se detienen sin ese insumo están en la última columna.',
  ]
  instrucciones.forEach((text, i) => {
    sheet.mergeCells(`A${6 + i}:H${6 + i}`)
    const cell = sheet.getCell(`A${6 + i}`)
    cell.value = text
    cell.font = UPCROP_FONT.instructionsBody
    cell.alignment = { wrapText: true }
  })

  const headerRowNum = 11
  const headers = [
    'Prioridad',
    'Insumo',
    'Stock actual',
    'Unidad',
    'Cantidad a pedir',
    'Urgencia',
    'Acción',
    'Códigos de embalaje afectados',
  ]

  const headerRow = sheet.getRow(headerRowNum)
  headerRow.values = headers
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = UPCROP_FONT.header
    cell.fill = UPCROP_HEADER_FILL
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = UPCROP_THIN_BORDER
  })
  sheet.getCell(`B${headerRowNum}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  sheet.getCell(`G${headerRowNum}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  sheet.getCell(`H${headerRowNum}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }

  items.forEach((item, index) => {
    const rowNum = headerRowNum + 1 + index
    const prioridad = index + 1
    const cantidadPedir = Math.ceil(item.sugerido_comprar)
    const sinStock = item.stock_actual <= 0

    const row = sheet.getRow(rowNum)
    row.values = [
      prioridad,
      item.descripcion,
      item.stock_actual,
      item.unidad_medida,
      cantidadPedir > 0 ? cantidadPedir : '—',
      urgenciaLabel(item.stock_actual),
      accionLabel(item),
      item.afecta.join(', '),
    ]

    const rowFill = sinStock ? URGENT_FILL : item.stock_actual < cantidadPedir ? LOW_FILL : ALT_FILL
    row.height = Math.max(20, Math.ceil(item.afecta.join(', ').length / 55) * 16)

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = UPCROP_THIN_BORDER
      cell.fill = rowFill
      cell.alignment = { vertical: 'top', wrapText: colNumber >= 2 }

      if (colNumber === 1) {
        cell.font = { bold: true, size: 11 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
      if (colNumber === 2) {
        cell.font = { bold: true, size: 10 }
      }
      if (colNumber === 3 || colNumber === 5) {
        cell.numFmt = '#,##0'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
        if (colNumber === 3 && sinStock) {
          cell.font = { bold: true, color: { argb: UPCROP_COLORS.destructive } }
        }
      }
      if (colNumber === 5 && cantidadPedir > 0) {
        cell.font = { bold: true, color: { argb: UPCROP_COLORS.primary } }
      }
      if (colNumber === 6) {
        cell.font = {
          bold: sinStock,
          color: { argb: sinStock ? UPCROP_COLORS.destructive : UPCROP_COLORS.primaryDark },
          size: 10,
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      }
      if (colNumber === 7) {
        cell.font = { size: 10, color: { argb: UPCROP_COLORS.primaryDeep } }
      }
      if (colNumber === 8) {
        cell.font = { size: 9, color: { argb: UPCROP_COLORS.muted } }
      }
    })
  })

  const summaryRow = headerRowNum + items.length + 2
  sheet.mergeCells(`A${summaryRow}:H${summaryRow}`)
  const sinStockCount = items.filter((i) => i.stock_actual <= 0).length
  const summaryCell = sheet.getCell(`A${summaryRow}`)
  summaryCell.value =
    `Resumen: ${items.length} insumo${items.length !== 1 ? 's' : ''} a reponer` +
    (sinStockCount > 0 ? ` · ${sinStockCount} sin stock (prioridad máxima)` : '') +
    ` · Total unidades sugeridas: ${items.reduce((s, i) => s + Math.ceil(i.sugerido_comprar), 0).toLocaleString('es-CL')}`
  summaryCell.font = UPCROP_FONT.summary
  summaryCell.fill = UPCROP_SUMMARY_FILL
  summaryCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(summaryRow).height = 24

  sheet.columns = [
    { width: 10 },
    { width: 42 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 38 },
    { width: 48 },
  ]

  sheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum + items.length, column: 8 },
  }

  sheet.views = [
    {
      state: 'frozen',
      ySplit: headerRowNum,
      showGridLines: false,
    },
  ]

  const filename = `lista-compra-embalaje-${now.toISOString().slice(0, 10)}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  triggerExcelDownload(buffer as ArrayBuffer, filename)
}
