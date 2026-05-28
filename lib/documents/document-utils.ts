export type DocumentKind = 'contract' | 'report' | 'invoice'
export type DocumentFormat = 'pdf' | 'docx'

export interface DocumentField {
  label: string
  value: string
}

export interface DocumentData {
  title: string
  subtitle: string
  fields: DocumentField[]
}

export interface DocumentColumnOptions {
  columnOrder?: string[]
  visibleColumns?: string[]
}

interface TableColumn {
  id: string
  name: string
}

interface TableRow {
  id: string
  data: Record<string, unknown>
}

const TITLE_KEYS = [
  'nombre',
  'cliente',
  'empresa',
  'embarque',
  'factura',
  'contrato',
  'referencia',
]

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(valueToString).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function pickTitle(data: Record<string, unknown>, fallback: string): string {
  for (const key of TITLE_KEYS) {
    const value = data[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value)
    }
  }
  return fallback
}

export function buildDocumentData(
  table: { name: string; columns?: TableColumn[] },
  row: TableRow,
  options: DocumentColumnOptions = {},
): DocumentData {
  const columnMap = new Map<string, string>()
  for (const col of table.columns ?? []) {
    columnMap.set(col.id, col.name)
  }

  const rawKeys = Object.keys(row.data ?? {})
  const orderedKeys = options.columnOrder && options.columnOrder.length > 0
    ? options.columnOrder
    : rawKeys
  const visibleSet = options.visibleColumns && options.visibleColumns.length > 0
    ? new Set(options.visibleColumns)
    : null

  const fields = orderedKeys
    .filter((key) => !visibleSet || visibleSet.has(key))
    .map((key) => [key, row.data?.[key]] as const)
    .map(([key, value]) => ({
      label: columnMap.get(key) ?? key,
      value: valueToString(value),
    }))
    .filter((field) => field.value.trim().length > 0)

  return {
    title: pickTitle(row.data ?? {}, table.name),
    subtitle: table.name,
    fields,
  }
}

export function getDocumentLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'contract':
      return 'Contrato'
    case 'report':
      return 'Reporte'
    case 'invoice':
      return 'Factura'
    default:
      return 'Documento'
  }
}
