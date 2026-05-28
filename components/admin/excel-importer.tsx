'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

export interface ColumnDef {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'currency' | 'select' | 'boolean' | 'country'
  isFilter: boolean
  options?: string[]
}

interface ExcelImporterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (columns: ColumnDef[], rows: Record<string, unknown>[]) => void
}

interface ParsedColumn {
  name: string
  // Original column index in the spreadsheet. Used as the stable key for
  // matching values back to the column when the user reorders or when two
  // headers share the same name.
  originalIndex: number
  detectedType: ColumnDef['type']
  sampleValues: unknown[]
  selected: boolean
  customType?: ColumnDef['type']
  isFilter: boolean
}

const COLUMN_TYPES: { value: ColumnDef['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'currency', label: 'Moneda' },
  { value: 'select', label: 'Selección' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'country', label: 'País' },
]

function detectColumnType(values: unknown[]): ColumnDef['type'] {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonEmptyValues.length === 0) return 'text'

  // Check if all values are numbers
  const allNumbers = nonEmptyValues.every(v => {
    if (typeof v === 'number') return true
    if (typeof v === 'string') {
      const cleaned = v.replace(/[$,€£¥]/g, '').trim()
      return !isNaN(parseFloat(cleaned)) && isFinite(Number(cleaned))
    }
    return false
  })
  
  if (allNumbers) {
    // Check if it looks like currency (has $ or € or similar)
    const hasCurrencySymbol = nonEmptyValues.some(v => 
      typeof v === 'string' && /[$€£¥]/.test(v)
    )
    return hasCurrencySymbol ? 'currency' : 'number'
  }

  // Check if all values are dates
  const allDates = nonEmptyValues.every(v => {
    if (v instanceof Date) return true
    if (typeof v === 'number' && v > 30000 && v < 60000) return true // Excel date serial
    if (typeof v === 'string') {
      const date = new Date(v)
      return !isNaN(date.getTime())
    }
    return false
  })
  if (allDates) return 'date'

  // Check if boolean-like
  const booleanValues = ['true', 'false', 'yes', 'no', 'si', 'sí', '1', '0', 'verdadero', 'falso']
  const allBooleans = nonEmptyValues.every(v => 
    typeof v === 'boolean' || 
    (typeof v === 'string' && booleanValues.includes(v.toLowerCase()))
  )
  if (allBooleans) return 'boolean'

  // Check if it might be country names
  const countryIndicators = ['estados unidos', 'usa', 'mexico', 'méxico', 'china', 'japan', 'germany', 'france', 'brazil', 'brasil', 'argentina', 'chile', 'peru', 'perú', 'colombia', 'spain', 'españa', 'uk', 'canada', 'canadá']
  const mightBeCountry = nonEmptyValues.some(v => 
    typeof v === 'string' && countryIndicators.some(c => v.toLowerCase().includes(c))
  )
  if (mightBeCountry) return 'country'

  // Check if select (limited unique values relative to dataset size)
  const uniqueValues = new Set(nonEmptyValues.map(v => String(v).trim().toLowerCase()))
  // Treat as select when there's meaningful repetition: either a small number
  // of distinct values (<= 50) OR strong repetition ratio (uniques < 25% of
  // total). This catches large datasets like a 612-row spreadsheet where a
  // status column has many repeats but more than 10 distinct values.
  if (
    nonEmptyValues.length >= 4 &&
    (uniqueValues.size <= 50 || uniqueValues.size < nonEmptyValues.length * 0.25)
  ) {
    return 'select'
  }

  return 'text'
}

function parseExcelDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  if (typeof value === 'number' && value > 25000 && value < 60000) {
    // Excel date serial number
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  return String(value)
}

export function ExcelImporter({ open, onOpenChange, onImport }: ExcelImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedColumns, setParsedColumns] = useState<ParsedColumn[]>([])
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'configure'>('upload')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setFileName(file.name)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array', cellDates: true })

      // Get first sheet
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      // Convert to JSON. defval: null ensures EVERY cell (even blanks) is
      // preserved as null instead of being skipped — otherwise rows arrive as
      // sparse arrays where empty trailing cells are dropped, which causes
      // entire columns to look "empty" later.
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false }) as unknown[][]

      if (jsonData.length < 2) {
        throw new Error('El archivo debe tener al menos una fila de encabezados y una de datos')
      }

      // First row is headers
      const rawHeaders = (jsonData[0] || []) as unknown[]
      const rows = jsonData.slice(1)

      // Compute the maximum width across header + body rows so we never miss
      // a column that has data but a missing header cell.
      const widthCandidates = [rawHeaders.length, ...rows.map(r => (r as unknown[]).length)]
      const maxWidth = Math.max(0, ...widthCandidates)

      // Build a normalized header per column index, deduplicating repeated
      // names ("Producto" → "Producto", "Producto (2)", ...) and synthesizing
      // a name when the header cell is empty.
      const usedNames = new Map<string, number>()
      type HeaderInfo = { displayName: string; originalIndex: number; hadHeader: boolean }
      const headerInfos: HeaderInfo[] = []
      for (let index = 0; index < maxWidth; index++) {
        const raw = rawHeaders[index]
        const trimmed = raw === null || raw === undefined ? '' : String(raw).trim()
        const baseName = trimmed === '' ? `Columna ${index + 1}` : trimmed
        const previousCount = usedNames.get(baseName) || 0
        const displayName = previousCount === 0 ? baseName : `${baseName} (${previousCount + 1})`
        usedNames.set(baseName, previousCount + 1)
        headerInfos.push({ displayName, originalIndex: index, hadHeader: trimmed !== '' })
      }

      // Drop columns that have neither a header nor any data — they are pure
      // padding cells that XLSX sometimes reports for merged/empty regions.
      const usableHeaders = headerInfos.filter(({ originalIndex, hadHeader }) => {
        if (hadHeader) return true
        return rows.some(row => {
          const v = (row as unknown[])[originalIndex]
          return v !== null && v !== undefined && v !== ''
        })
      })

      // Analyze each usable column
      const columns: ParsedColumn[] = usableHeaders.map(({ displayName, originalIndex }) => {
        const columnValues = rows.map(row => (row as unknown[])[originalIndex] ?? null)
        const detectedType = detectColumnType(columnValues)
        return {
          name: displayName,
          originalIndex,
          detectedType,
          sampleValues: columnValues.slice(0, 5),
          selected: true,
          isFilter: false,
        }
      })

      // Parse rows by ORIGINAL INDEX so duplicate / synthesized header names
      // never collapse separate columns into one. The key in parsedRows is the
      // stringified column index.
      const parsedRowsData = rows.map(row => {
        const rowObj: Record<string, unknown> = {}
        usableHeaders.forEach(({ originalIndex }) => {
          const value = (row as unknown[])[originalIndex]
          rowObj[String(originalIndex)] = value === undefined ? null : value
        })
        return rowObj
      })

      setParsedColumns(columns)
      setParsedRows(parsedRowsData)
      setStep('configure')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    const selectedColumns = parsedColumns.filter(col => col.selected)

    // Helper: collect unique non-empty values from a column, used to seed
    // options for select-type columns.
    const collectUniqueValues = (originalIndex: number): string[] => {
      const set = new Set<string>()
      parsedRows.forEach(row => {
        const raw = row[String(originalIndex)]
        if (raw === null || raw === undefined) return
        const str = String(raw).trim()
        if (str === '') return
        set.add(str)
      })
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
    }

    const columnDefs: ColumnDef[] = selectedColumns.map((col, index) => {
      const colType = col.customType || col.detectedType
      const def: ColumnDef = {
        id: `col_${index}_${Date.now()}`,
        name: col.name,
        type: colType,
        isFilter: col.isFilter,
      }
      // Seed select options with the actual values from the spreadsheet.
      // Without this, the editor has no valid option for the imported value
      // and the cell renders as empty even though the data was imported.
      if (colType === 'select') {
        def.options = collectUniqueValues(col.originalIndex)
      }
      return def
    })

    // Transform rows to use column IDs and convert values
    const transformedRows = parsedRows.map(row => {
      const newRow: Record<string, unknown> = {}
      selectedColumns.forEach((col, index) => {
        const colId = columnDefs[index].id
        // Look up the value by its ORIGINAL spreadsheet index instead of
        // by name, so duplicate / synthetic headers don't lose data.
        let value = row[String(col.originalIndex)]

        // Convert value based on type
        const colType = col.customType || col.detectedType
        if (value === null || value === undefined || value === '') {
          // Preserve empty cells as null instead of forcing 0 / false / ""
          value = null
        } else if (colType === 'date') {
          value = parseExcelDate(value)
        } else if (colType === 'number' || colType === 'currency') {
          if (typeof value === 'string') {
            const cleaned = value.replace(/[$,€£¥\s]/g, '').replace(',', '.')
            const parsed = parseFloat(cleaned)
            value = isNaN(parsed) ? null : parsed
          }
        } else if (colType === 'boolean') {
          const strVal = String(value).toLowerCase()
          value = ['true', 'yes', 'si', 'sí', '1', 'verdadero'].includes(strVal)
        } else {
          // Default: keep as string for text/select/country
          if (typeof value !== 'string' && !(value instanceof Date)) {
            value = String(value)
          }
        }

        newRow[colId] = value
      })
      return newRow
    })

    onImport(columnDefs, transformedRows)
    handleClose()
  }

  const handleClose = () => {
    setStep('upload')
    setParsedColumns([])
    setParsedRows([])
    setFileName(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const toggleColumnSelection = (index: number) => {
    setParsedColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, selected: !col.selected } : col
    ))
  }

  const updateColumnType = (index: number, type: ColumnDef['type']) => {
    setParsedColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, customType: type } : col
    ))
  }

  const toggleColumnFilter = (index: number) => {
    setParsedColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, isFilter: !col.isFilter } : col
    ))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar desde Excel / Sheets
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? 'Sube un archivo Excel (.xlsx, .xls) o CSV para importar los datos'
              : `Configurando columnas de "${fileName}"`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 py-8">
            <div 
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-muted-foreground">Procesando archivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      Arrastra un archivo o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Soporta archivos .xlsx, .xls y .csv
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'configure' && (
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-muted-foreground">
                  {parsedRows.length} filas encontradas
                </p>
                <p className="text-sm text-muted-foreground">
                  {parsedColumns.filter(c => c.selected).length} de {parsedColumns.length} columnas seleccionadas
                </p>
              </div>

              {/* Table with sticky horizontal scroll */}
              <div className="border border-border rounded-lg">
                <div className="overflow-x-scroll overflow-y-auto max-h-[400px] scrollbar-always-visible">
                  <table className="w-full min-w-[800px]">
                  <thead className="bg-secondary sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Incluir
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Columna
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Tipo detectado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Tipo final
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Es filtro
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Muestra
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedColumns.map((col, index) => (
                      <tr key={index} className={col.selected ? '' : 'opacity-50'}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={col.selected}
                            onCheckedChange={() => toggleColumnSelection(index)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{col.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded bg-secondary text-xs">
                            {COLUMN_TYPES.find(t => t.value === col.detectedType)?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={col.customType || col.detectedType}
                            onValueChange={(v) => updateColumnType(index, v as ColumnDef['type'])}
                            disabled={!col.selected}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLUMN_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={col.isFilter}
                            onCheckedChange={() => toggleColumnFilter(index)}
                            disabled={!col.selected}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {col.sampleValues.slice(0, 3).map((val, i) => (
                              <span 
                                key={i} 
                                className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground truncate max-w-[100px]"
                                title={String(val)}
                              >
                                {val === null || val === undefined ? '(vacío)' : String(val).slice(0, 20)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              
              {/* Data Preview */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Vista previa de datos (primeras 5 filas)</p>
                <div className="border border-border rounded-lg">
                  <div className="overflow-x-scroll overflow-y-auto max-h-[200px] scrollbar-always-visible">
                    <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-secondary sticky top-0 z-10">
                      <tr>
                        {parsedColumns.filter(c => c.selected).map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {parsedColumns.filter(c => c.selected).map((col, colIndex) => {
                            const cell = row[String(col.originalIndex)]
                            return (
                              <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-foreground">
                                {cell === null || cell === undefined || cell === ''
                                  ? <span className="text-muted-foreground">(vacío)</span>
                                  : String(cell).slice(0, 50)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 'configure' && (
            <Button 
              onClick={handleImport}
              disabled={parsedColumns.filter(c => c.selected).length === 0}
            >
              <Check className="w-4 h-4 mr-2" />
              Importar {parsedColumns.filter(c => c.selected).length} columnas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
