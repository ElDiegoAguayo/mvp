// Shared column types used by both the admin manager and the client view.
// Keep this list in sync — adding a new type here makes it available everywhere.

export const COLUMN_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda (CLP)' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'country', label: 'País' },
  { value: 'countdown', label: 'Cuenta regresiva (días)' },
  { value: 'linked', label: 'Vinculada a otra tabla' },
  { value: 'formula', label: 'Fórmula (calculado)' },
] as const

export type ColumnType = (typeof COLUMN_TYPES)[number]['value']

// Column types allowed as filters in the client view. Numeric / formula /
// linked / countdown are excluded because they don't behave as discrete
// categories the user can pick from a dropdown.
export const FILTERABLE_COLUMN_TYPES: ReadonlySet<ColumnType> = new Set<ColumnType>([
  'text',
  'date',
  'country',
  'select',
  'boolean',
])

// Column types the CLIENT can create from the view (when allowAddColumns is
// enabled). Mirrors the full COLUMN_TYPES list so both the admin and the
// client view always offer the same options. Adding a new type to
// COLUMN_TYPES makes it instantly available everywhere.
export const CLIENT_CREATABLE_COLUMN_TYPES: readonly { value: ColumnType; label: string }[] =
  COLUMN_TYPES
