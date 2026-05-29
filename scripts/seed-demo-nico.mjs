/**
 * Cuenta vitrina permanente: nico@upcrop-ia (Frutícola Demo — Revisión MVP).
 * Este script recarga datos ficticios de demo; NO elimina al usuario ni su acceso.
 * Clientes reales deben vivir en cuentas/proyectos aparte.
 *
 * Uso: node scripts/seed-demo-nico.mjs
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  let val = trimmed.slice(eq + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env[key] = val
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'nico@upcrop-ia'
const SEASON = '2025-2026'
const FIELD = 'Campo Demo Valle Norte'
const CROP = 'Cerezo'

const PHENOLOGY_STAGES = [
  { stage_code: 'C1', stage_name: 'Reposo', sort_order: 1, typical_days: null, description: 'Yema en reposo invernal.' },
  { stage_code: 'C2', stage_name: 'Hinchamiento de yemas', sort_order: 2, typical_days: 30, description: 'Inicio de actividad fisiológica.' },
  { stage_code: 'C3', stage_name: 'Botón blanco', sort_order: 3, typical_days: 14, description: 'Botones florales visibles.' },
  { stage_code: 'C4', stage_name: 'Floración', sort_order: 4, typical_days: 7, description: 'Apertura floral.' },
  { stage_code: 'C5', stage_name: 'Cuajado', sort_order: 5, typical_days: 21, description: 'Fijación inicial del fruto.' },
  { stage_code: 'C6', stage_name: 'Crecimiento I', sort_order: 6, typical_days: 28, description: 'Expansión celular del fruto.' },
  { stage_code: 'C7', stage_name: 'Cambio de color', sort_order: 7, typical_days: 21, description: 'Inicio de maduración.' },
  { stage_code: 'C8', stage_name: 'Cosecha', sort_order: 8, typical_days: 14, description: 'Ventana de cosecha comercial.' },
]

const PHENOLOGY_STAGES_BY_CROP = {
  Cerezo: PHENOLOGY_STAGES,
  Arándano: [
    { stage_code: 'A1', stage_name: 'Yema Dormida', sort_order: 1, typical_days: null, description: 'Reposo invernal.' },
    { stage_code: 'A2', stage_name: 'Yema Hinchada', sort_order: 2, typical_days: 21, description: 'Hinchamiento de yemas.' },
    { stage_code: 'A3', stage_name: 'Ramillete Expuesto', sort_order: 3, typical_days: 7, description: 'Expansión del ramillete.' },
    { stage_code: 'A4', stage_name: 'Brácteas abiertas', sort_order: 4, typical_days: 7, description: 'Brácteas visibles.' },
    { stage_code: 'A5', stage_name: 'Botón Rosado', sort_order: 5, typical_days: 7, description: 'Botón floral rosado.' },
    { stage_code: 'A6', stage_name: 'Botón blanco', sort_order: 6, typical_days: 5, description: 'Botón floral blanco.' },
    { stage_code: 'A7', stage_name: 'Inicio Floración', sort_order: 7, typical_days: 5, description: 'Primeras flores abiertas.' },
    { stage_code: 'A8', stage_name: '30% Floración', sort_order: 8, typical_days: 7, description: 'Floración temprana.' },
    { stage_code: 'A9', stage_name: '50-80% Floración', sort_order: 9, typical_days: 7, description: 'Floración plena.' },
    { stage_code: 'A10', stage_name: '50% Cuaja', sort_order: 10, typical_days: 14, description: 'Cuajado parcial.' },
    { stage_code: 'A11', stage_name: '100% Cuaja', sort_order: 11, typical_days: 14, description: 'Cuajado completo.' },
    { stage_code: 'A12', stage_name: 'Fruto en Crecimiento', sort_order: 12, typical_days: 21, description: 'Expansión del fruto.' },
    { stage_code: 'A13', stage_name: 'Inicio de Pinta', sort_order: 13, typical_days: 14, description: 'Inicio cambio de color.' },
  ],
  Uva: [
    { stage_code: 'V1', stage_name: 'Brotación', sort_order: 1, typical_days: null, description: 'Salida de brotes.' },
    { stage_code: 'V2', stage_name: 'Floración', sort_order: 2, typical_days: 35, description: 'Floración y polinización.' },
    { stage_code: 'V3', stage_name: 'Cuajado', sort_order: 3, typical_days: 14, description: 'Formación del racimo.' },
    { stage_code: 'V4', stage_name: 'Envero', sort_order: 4, typical_days: 45, description: 'Cambio de color y acumulación de azúcar.' },
    { stage_code: 'V5', stage_name: 'Maduración', sort_order: 5, typical_days: 21, description: 'Pre-cosecha.' },
  ],
  Manzano: [
    { stage_code: 'M1', stage_name: 'Reposo', sort_order: 1, typical_days: null, description: 'Invierno.' },
    { stage_code: 'M2', stage_name: 'Brotación', sort_order: 2, typical_days: 45, description: 'Salida de hojas.' },
    { stage_code: 'M3', stage_name: 'Floración', sort_order: 3, typical_days: 21, description: 'Flor abierta.' },
    { stage_code: 'M4', stage_name: 'Cuajado', sort_order: 4, typical_days: 28, description: 'Fruto joven.' },
    { stage_code: 'M5', stage_name: 'Crecimiento', sort_order: 5, typical_days: 60, description: 'Llenado del fruto.' },
    { stage_code: 'M6', stage_name: 'Cosecha', sort_order: 6, typical_days: 30, description: 'Madurez comercial.' },
  ],
}

const BLOCKS = [
  { block_name: 'C-01 Lapins', variety: 'Lapins', hectares: 4.5, plants_per_ha: 1100 },
  { block_name: 'C-02 Regina', variety: 'Regina', hectares: 3.8, plants_per_ha: 1050 },
  { block_name: 'C-03 Santina', variety: 'Santina', hectares: 5.2, plants_per_ha: 1080 },
  { block_name: 'C-04 Kordia', variety: 'Kordia', hectares: 3.1, plants_per_ha: 1120 },
  { block_name: 'C-05 Skeena', variety: 'Skeena', hectares: 4.0, plants_per_ha: 1090 },
]

const DEMO_CROP_CONFIG = {
  Cerezo: {
    field: FIELD,
    blocks: BLOCKS,
    obsStages: ['Cuajado', 'Crecimiento I'],
    obsDates: ['2026-09-15', '2026-10-01', '2026-10-15', '2026-11-01', '2026-11-15'],
  },
  Arándano: {
    field: 'Campo Demo Arándanos',
    blocks: [
      { block_name: 'A-01 Legacy', variety: 'Legacy', hectares: 3.2, plants_per_ha: 2500 },
      { block_name: 'A-02 Emerald', variety: 'Emerald', hectares: 2.8, plants_per_ha: 2400 },
      { block_name: 'A-03 Bluecrop', variety: 'Bluecrop', hectares: 4.1, plants_per_ha: 2600 },
      { block_name: 'A-04 Duke', variety: 'Duke', hectares: 3.5, plants_per_ha: 2550 },
    ],
    obsStages: ['50% Cuaja', 'Fruto en Crecimiento'],
    obsDates: ['2026-10-20', '2026-11-05', '2026-11-20', '2026-12-01'],
  },
  Uva: {
    field: 'Finca Demo Viña',
    blocks: [
      { block_name: 'V-01 Cabernet', variety: 'Cabernet Sauvignon', hectares: 6.0, plants_per_ha: 4500 },
      { block_name: 'V-02 Carmenère', variety: 'Carmenère', hectares: 4.5, plants_per_ha: 4200 },
      { block_name: 'V-03 Sauvignon', variety: 'Sauvignon Blanc', hectares: 5.2, plants_per_ha: 4800 },
    ],
    obsStages: ['Envero', 'Maduración'],
    obsDates: ['2026-02-10', '2026-02-25', '2026-03-10'],
  },
  Manzano: {
    field: 'Huerto Demo Manzanas',
    blocks: [
      { block_name: 'M-01 Fuji', variety: 'Fuji', hectares: 3.0, plants_per_ha: 1800 },
      { block_name: 'M-02 Gala', variety: 'Gala', hectares: 2.5, plants_per_ha: 1750 },
      { block_name: 'M-03 Granny', variety: 'Granny Smith', hectares: 3.8, plants_per_ha: 1900 },
    ],
    obsStages: ['Cuajado', 'Crecimiento'],
    obsDates: ['2026-11-20', '2026-12-05', '2026-12-20'],
  },
}

const CHART_SPECS_BY_SLUG = {
  'producto-terminado': () => [
    { name: 'Kilos por destino', chart_type: 'bar', config: { x_column: 'destino', y_column: 'kilos' }, display_order: 0 },
    { name: 'Tendencia de kilos', chart_type: 'line', config: { x_column: 'fecha', y_column: 'kilos' }, display_order: 1 },
    { name: 'Participación por mercado', chart_type: 'donut', config: { label_column: 'mercado', value_column: 'kilos' }, display_order: 2 },
    {
      name: 'Tabla producto terminado',
      chart_type: 'data_table',
      config: { visible_columns: ['fecha', 'producto', 'cajas', 'kilos', 'destino', 'mercado'] },
      display_order: 10,
    },
  ],
  trazabilidad: () => [
    { name: 'Kilos por puerto', chart_type: 'bar', config: { x_column: 'puerto', y_column: 'kilos' }, display_order: 0 },
    { name: 'Estado de embarques', chart_type: 'pie', config: { label_column: 'estado', value_column: 'kilos' }, display_order: 1 },
    {
      name: 'Tabla trazabilidad',
      chart_type: 'data_table',
      config: { visible_columns: ['lote', 'cuartel', 'variedad', 'contenedor', 'puerto', 'kilos', 'estado', 'fecha_embarque'] },
      display_order: 10,
    },
  ],
  productores: () => [
    { name: 'Hectáreas por comuna', chart_type: 'bar', config: { x_column: 'comuna', y_column: 'hectareas' }, display_order: 0 },
    { name: 'Superficie por especie', chart_type: 'pie', config: { label_column: 'especie', value_column: 'hectareas' }, display_order: 1 },
    {
      name: 'Tabla productores',
      chart_type: 'data_table',
      config: { visible_columns: ['codigo', 'nombre', 'comuna', 'hectareas', 'especie', 'variedad_principal', 'estado'] },
      display_order: 10,
    },
  ],
}

const COMERCIO_CHECKLIST_STEPS = [
  'Recepción solicitud booking',
  'Cotización tarifas destino',
  'Solicitar Booking/espacio a forwarder',
  'Confirmación booking por forwarder',
  'Coordinar llegada camión a planta',
  'Definir detalle de la carga',
  'Solicitar inspección SAG',
  'Instructivo de Embarque',
  'Enviar SPS a planta',
  'Carga contenedor',
  'Revisar documentos de despacho',
  'Confirmar ETD real',
  'Factura Proforma',
  'Enviar documentos de embarque a cliente',
  'Documentos de embarque aprobados',
  'Pago anticipo',
  'Confirmar fecha arribo (ETA)',
  'Liquidación cliente',
]

function buildComercioChecklistColumns() {
  return [
    { id: 'codigo_embarque', name: 'Código de embarque', type: 'text', isFilter: true, clientEditable: true },
    ...COMERCIO_CHECKLIST_STEPS.map((name, i) => ({
      id: `paso_${i + 1}`,
      name,
      type: 'select',
      options: ['OK', 'NO'],
      isFilter: false,
      clientEditable: true,
    })),
  ]
}

function buildComercioChecklistRow(codigo, statuses) {
  const row = { codigo_embarque: codigo }
  COMERCIO_CHECKLIST_STEPS.forEach((_, i) => {
    row[`paso_${i + 1}`] = statuses[i] ?? 'NO'
  })
  return row
}

async function seedComercioExteriorDemo(uid, moduleId) {
  await sb.from('dynamic_charts').delete().eq('user_id', uid).eq('module_id', moduleId)

  const { data: oldTables } = await sb
    .from('dynamic_tables')
    .select('id')
    .eq('user_id', uid)
    .eq('module_id', moduleId)

  if (oldTables?.length) {
    const ids = oldTables.map((t) => t.id)
    await sb.from('dynamic_table_rows').delete().in('table_id', ids)
    await sb.from('dynamic_tables').delete().in('id', ids)
  }

  const embarqueColumns = [
    { id: 'contenedor', name: 'N° contenedor', type: 'text' },
    { id: 'fecha_carga', name: 'Fecha de carga', type: 'date' },
    { id: 'naviera', name: 'Compañía naviera', type: 'text' },
    { id: 'booking', name: 'N° booking', type: 'text' },
    { id: 'bl', name: 'N° BL', type: 'text' },
    { id: 'cliente', name: 'Cliente', type: 'text' },
    { id: 'puerto_salida', name: 'Puerto de salida', type: 'text' },
    { id: 'destino', name: 'Destino final', type: 'country' },
    { id: 'productor', name: 'Productor', type: 'text' },
    { id: 'producto', name: 'Producto', type: 'text' },
    { id: 'cajas', name: 'Cajas', type: 'number' },
    { id: 'kilos', name: 'Kilos', type: 'number' },
    { id: 'etd', name: 'ETD', type: 'date' },
    { id: 'eta', name: 'ETA', type: 'date' },
  ]

  const embarqueRows = [
    {
      contenedor: 'DEMO-CTR-001',
      fecha_carga: '2026-03-08',
      naviera: 'MAERSK',
      booking: 'BK-DEMO-7781',
      bl: 'BL-DEMO-9001',
      cliente: 'Importadora Shanghai Demo Ltda.',
      puerto_salida: 'Valparaíso',
      destino: 'China',
      productor: 'Agrícola Demo Norte SpA',
      producto: 'Cereza Lapins 5kg',
      cajas: 1200,
      kilos: 6000,
      etd: '2026-03-10',
      eta: '2026-04-02',
    },
    {
      contenedor: 'DEMO-CTR-002',
      fecha_carga: '2026-03-11',
      naviera: 'MSC',
      booking: 'BK-DEMO-7782',
      bl: 'BL-DEMO-9002',
      cliente: 'Pacific Fruit USA Demo Inc.',
      puerto_salida: 'San Antonio',
      destino: 'Estados Unidos',
      productor: 'Frutícola Demo Sur Ltda.',
      producto: 'Cereza Regina 2.5kg',
      cajas: 800,
      kilos: 2000,
      etd: '2026-03-12',
      eta: '2026-03-28',
    },
    {
      contenedor: 'DEMO-CTR-003',
      fecha_carga: '2026-03-14',
      naviera: 'CMA CGM',
      booking: 'BK-DEMO-7783',
      bl: 'BL-DEMO-9003',
      cliente: 'Euro Cherry Demo BV',
      puerto_salida: 'Valparaíso',
      destino: 'Países Bajos (Holanda)',
      productor: 'Valle Cherry Demo SA',
      producto: 'Cereza Santina 5kg',
      cajas: 950,
      kilos: 4750,
      etd: '2026-03-15',
      eta: '2026-04-05',
    },
    {
      contenedor: 'DEMO-CTR-004',
      fecha_carga: '2026-03-18',
      naviera: 'HAPAG-LLOYD',
      booking: 'BK-DEMO-7784',
      bl: 'BL-DEMO-9004',
      cliente: 'Gulf Produce Demo FZE',
      puerto_salida: 'San Antonio',
      destino: 'Emiratos Árabes Unidos',
      productor: 'Export Cherry Demo SpA',
      producto: 'Mix Kordia + Skeena',
      cajas: 720,
      kilos: 3600,
      etd: '2026-03-20',
      eta: '2026-04-08',
    },
  ]

  const checklistColumns = buildComercioChecklistColumns()
  const checklistRows = [
    buildComercioChecklistRow('EXP-DEMO-001', [
      'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'NO',
    ]),
    buildComercioChecklistRow('EXP-DEMO-002', [
      'OK', 'OK', 'OK', 'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'NO', 'NO',
    ]),
    buildComercioChecklistRow('EXP-DEMO-003', [
      'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'OK', 'NO', 'NO', 'OK', 'OK', 'OK', 'NO',
    ]),
    buildComercioChecklistRow('EXP-DEMO-004', [
      'OK', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO', 'NO',
    ]),
  ]

  const embarqueRes = await seedDynamicTable(
    uid,
    moduleId,
    'Comercio Exterior',
    embarqueColumns,
    embarqueRows,
    'Demo — Información de embarque',
  )
  if (!embarqueRes.ok) return embarqueRes

  const checklistRes = await seedDynamicTable(
    uid,
    moduleId,
    'Comercio Exterior',
    checklistColumns,
    checklistRows,
    'Demo — Check list exportación',
  )
  if (!checklistRes.ok) return checklistRes

  const embarqueColIds = embarqueColumns.map((c) => c.id)
  const checklistColIds = checklistColumns.map((c) => c.id)

  const chartRows = [
    {
      user_id: uid,
      module_id: moduleId,
      table_id: embarqueRes.tableId,
      name: 'Información de embarque',
      chart_type: 'data_table',
      config: {
        xAxis: [],
        yAxis: [],
        colors: ['#4A6CF7'],
        columns: embarqueColIds,
        allowAddRows: false,
        allowAddColumns: false,
        editableColumns: embarqueColIds,
        allowEditColumns: false,
        allowDeleteColumns: false,
      },
      filters_config: [],
      display_order: 0,
    },
    {
      user_id: uid,
      module_id: moduleId,
      table_id: checklistRes.tableId,
      name: 'Check list',
      chart_type: 'data_table',
      config: {
        xAxis: [],
        yAxis: [],
        colors: ['#4A6CF7'],
        columns: checklistColIds,
        allowAddRows: true,
        allowAddColumns: false,
        editableColumns: checklistColIds.filter((id) => id !== 'codigo_embarque'),
        allowEditColumns: false,
        allowDeleteColumns: false,
      },
      filters_config: [],
      display_order: 1,
    },
  ]

  const { error } = await sb.from('dynamic_charts').insert(chartRows)
  if (error) return { ok: false, message: error.message }

  return {
    ok: true,
    embarqueTableId: embarqueRes.tableId,
    checklistTableId: checklistRes.tableId,
    chartCount: chartRows.length,
    rowCount: embarqueRows.length + checklistRows.length,
  }
}

async function seedModuleCharts(uid, moduleId, slug, tableId) {
  const factory = CHART_SPECS_BY_SLUG[slug]
  if (!factory || !tableId) return { ok: false, message: 'sin spec' }

  await sb.from('dynamic_charts').delete().eq('user_id', uid).eq('module_id', moduleId)

  const defs = factory(tableId)
  const rows = defs.map((d) => ({
    user_id: uid,
    module_id: moduleId,
    table_id: tableId,
    name: d.name,
    chart_type: d.chart_type,
    config: d.config,
    filters_config: [],
    display_order: d.display_order,
  }))

  const { error } = await sb.from('dynamic_charts').insert(rows)
  if (error) return { ok: false, message: error.message }
  return { ok: true, count: rows.length }
}

async function seedDynamicTable(uid, moduleId, moduleName, columns, rows, tableName) {
  const name = tableName ?? `Demo — ${moduleName}`
  const description = 'Datos ficticios para revisión MVP (sin clientes reales)'

  const { data: existing } = await sb
    .from('dynamic_tables')
    .select('id')
    .eq('user_id', uid)
    .eq('module_id', moduleId)
    .eq('name', name)
    .maybeSingle()

  let tableId = existing?.id

  if (tableId) {
    await sb.from('dynamic_tables').update({ columns, description }).eq('id', tableId)
    await sb.from('dynamic_table_rows').delete().eq('table_id', tableId)
  } else {
    const { data: table, error: tblErr } = await sb
      .from('dynamic_tables')
      .insert({
        name,
        description,
        module_id: moduleId,
        user_id: uid,
        columns,
      })
      .select('id')
      .single()
    if (tblErr || !table) return { ok: false, message: tblErr?.message ?? 'sin tabla' }
    tableId = table.id
  }

  const { data: insertedRows, error: rowErr } = await sb
    .from('dynamic_table_rows')
    .insert(rows.map((data, i) => ({ table_id: tableId, row_order: i, data })))
    .select('id, data')

  if (rowErr) return { ok: false, message: rowErr.message }
  return { ok: true, tableId, rows: insertedRows ?? [] }
}

const results = []

/** PDF mínimo válido para la bóveda demo (sin dependencias externas). */
function createDemoPdfBuffer(title, subtitle = 'Documento ficticio — UpCrop Demo') {
  const escapePdf = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = [
    'BT /F1 18 Tf 72 720 Td',
    `(${escapePdf(title)}) Tj`,
    '0 -28 Td /F1 11 Tf',
    `(${escapePdf(subtitle)}) Tj`,
    '0 -22 Td',
    `(Generado por seed-demo-nico.mjs) Tj ET`,
  ].join('\n')
  const streamLen = Buffer.byteLength(stream, 'utf8')
  const parts = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    'xref\n0 6\n0000000000 65535 f \n',
    '0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000261 00000 n \n',
  ]
  const body = parts.join('')
  const xrefPos = Buffer.byteLength(body, 'utf8')
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(body + trailer, 'utf8')
}

async function purgeVaultForUser(uid) {
  const { data: oldDocs } = await sb.from('documentos').select('storage_path').eq('user_id', uid)
  const paths = (oldDocs ?? []).map((d) => d.storage_path).filter(Boolean)
  if (paths.length) {
    await sb.storage.from('boveda').remove(paths)
  }
  await sb.from('documentos').delete().eq('user_id', uid)
  await sb.from('carpetas').delete().eq('user_id', uid)
}

async function seedVaultDocuments(uid) {
  await purgeVaultForUser(uid)

  const folderDefs = [
    { name: 'Certificaciones Demo', parent_id: null },
    { name: 'Exportación Demo', parent_id: null },
    { name: 'Temporada 2025-2026', parent_id: null },
  ]
  const { data: folders, error: carpErr } = await sb.from('carpetas').insert(folderDefs.map((f) => ({ user_id: uid, ...f }))).select('id, name')
  if (carpErr || !folders?.length) return { ok: false, message: carpErr?.message ?? 'sin carpetas' }

  const byName = (n) => folders.find((f) => f.name === n)?.id ?? null
  const fileSpecs = [
    { folder: 'Certificaciones Demo', name: 'Certificado-GAP-Demo-2026.pdf', title: 'Certificado GAP Demo 2026' },
    { folder: 'Exportación Demo', name: 'Guia-Despacho-DEMO-CTR-001.pdf', title: 'Guía despacho DEMO-CTR-001' },
    { folder: 'Temporada 2025-2026', name: 'Informe-Cosecha-Demo.pdf', title: 'Informe cosecha demo temporada 2025-2026' },
  ]

  let uploaded = 0
  for (const spec of fileSpecs) {
    const folderId = byName(spec.folder)
    const buffer = createDemoPdfBuffer(spec.title, 'Frutícola Demo — Revisión MVP')
    const folderPath = folderId || 'root'
    const storagePath = `${uid}/${folderPath}/${Date.now()}_${spec.name}`
    const { error: upErr } = await sb.storage.from('boveda').upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (upErr) continue
    const { error: insErr } = await sb.from('documentos').insert({
      user_id: uid,
      name: spec.name,
      size: buffer.length,
      type: 'pdf',
      storage_path: storagePath,
      folder_id: folderId,
    })
    if (!insErr) uploaded += 1
  }

  return { ok: uploaded > 0, count: uploaded, folders: folders.length }
}

function log(module, status, detail = '') {
  results.push({ module, status, detail })
  const icon = status === 'ok' ? '✓' : status === 'skip' ? '○' : '✗'
  console.log(`${icon} ${module}${detail ? `: ${detail}` : ''}`)
}

async function main() {
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', EMAIL)
    .single()

  if (profileErr || !profile) {
    console.error('No se encontró', EMAIL, profileErr)
    process.exit(1)
  }

  const uid = profile.id
  console.log(`\nSembrando demo para ${EMAIL} (${uid})\n`)

  // ── Perfil demo (nombre ficticio, sin cliente real) ───────────────────────
  await sb.from('profiles').update({ full_name: 'Frutícola Demo — Revisión MVP' }).eq('id', uid)
  log('Perfil', 'ok', 'Nombre actualizado a "Frutícola Demo — Revisión MVP"')

  const today = new Date().toISOString().slice(0, 10)
  let demoFacturas = []

  // ── Estimación + Plan de cosecha ──────────────────────────────────────────
  await sb.from('harvest_fields').upsert({ user_id: uid, name: FIELD }, { onConflict: 'user_id,name' })

  for (const b of BLOCKS) {
    await sb.from('harvest_blocks').upsert(
      {
        user_id: uid,
        field_name: FIELD,
        block_name: b.block_name,
        crop: CROP,
        variety: b.variety,
        hectares: b.hectares,
        plants_per_ha: b.plants_per_ha,
      },
      { onConflict: 'user_id,field_name,block_name' },
    )
  }

  // Muestras de conteo
  const countSamples = []
  for (const b of BLOCKS) {
    for (let h = 1; h <= 3; h++) {
      countSamples.push({
        user_id: uid,
        field_name: FIELD,
        block_name: b.block_name,
        crop: CROP,
        variety: b.variety,
        season_label: SEASON,
        record_date: today,
        hectares: b.hectares,
        plants_per_ha: b.plants_per_ha,
        hilera: h,
        arbol: 1,
        is_count_summary: false,
        dardos_per_plant: 42 + h * 3,
        dardos_per_branch: 8.5 + h * 0.4,
        dardo_coral: 12 + h,
        count_state: h === 1 ? 'Pre-poda' : 'Post-poda',
        estimated_kg: 0,
        harvested_kg: 0,
        status: 'planificado',
      })
    }
  }

  // Resúmenes por cuartel
  const summaries = BLOCKS.map((b) => ({
    user_id: uid,
    field_name: FIELD,
    block_name: b.block_name,
    crop: CROP,
    variety: b.variety,
    season_label: SEASON,
    record_date: today,
    hectares: b.hectares,
    plants_per_ha: b.plants_per_ha,
    is_count_summary: true,
    dardos_per_plant: 45,
    dardos_per_branch: 9.2,
    dardo_coral: 13,
    fruits_set: 85,
    fruit_weight_kg: 0.012,
    kg_per_plant: 1.02,
    kg_per_ha: 11200,
    estimated_kg: Math.round(b.hectares * 11200),
    harvested_kg: b.block_name === 'C-01 Lapins' ? 12000 : 0,
    count_state: 'Post-poda',
    status: b.block_name === 'C-01 Lapins' ? 'en_curso' : 'planificado',
    expected_start: '2026-11-15',
    expected_end: '2026-12-20',
  }))

  await sb.from('harvest_estimates').delete().eq('user_id', uid)
  const { error: heErr } = await sb.from('harvest_estimates').insert([...countSamples, ...summaries])
  if (heErr) log('Estimación de cosecha / Plan de cosecha', 'error', heErr.message)
  else log('Estimación de cosecha / Plan de cosecha', 'ok', `${countSamples.length} muestras + ${summaries.length} resúmenes`)

  // ── Fenología (varios cultivos) ───────────────────────────────────────────
  for (const [crop, cfg] of Object.entries(DEMO_CROP_CONFIG)) {
    await sb.from('harvest_fields').upsert({ user_id: uid, name: cfg.field }, { onConflict: 'user_id,name' })
    for (const b of cfg.blocks) {
      await sb.from('harvest_blocks').upsert(
        {
          user_id: uid,
          field_name: cfg.field,
          block_name: b.block_name,
          crop,
          variety: b.variety,
          hectares: b.hectares,
          plants_per_ha: b.plants_per_ha,
        },
        { onConflict: 'user_id,field_name,block_name' },
      )
    }
  }

  await sb.from('phenology_stages').delete().eq('user_id', uid)
  const stageRows = Object.entries(PHENOLOGY_STAGES_BY_CROP).flatMap(([crop, stages]) =>
    stages.map((s) => ({ user_id: uid, crop, ...s })),
  )
  const { data: insertedStages, error: stErr } = await sb
    .from('phenology_stages')
    .insert(stageRows)
    .select('id, crop, stage_name')

  if (stErr) {
    log('Estados fenológicos', 'error', stErr.message)
  } else {
    const stageIdByCrop = {}
    for (const s of insertedStages ?? []) {
      if (!stageIdByCrop[s.crop]) stageIdByCrop[s.crop] = {}
      stageIdByCrop[s.crop][s.stage_name] = s.id
    }

    const obs = []
    for (const [crop, cfg] of Object.entries(DEMO_CROP_CONFIG)) {
      for (let i = 0; i < cfg.blocks.length; i++) {
        const b = cfg.blocks[i]
        for (let j = 0; j < cfg.obsStages.length; j++) {
          const stageName = cfg.obsStages[j]
          obs.push({
            user_id: uid,
            block_name: b.block_name,
            crop,
            variety: b.variety,
            season_label: SEASON,
            stage_id: stageIdByCrop[crop]?.[stageName] ?? null,
            stage_name: stageName,
            observed_at: cfg.obsDates[i + j] ?? cfg.obsDates[0],
            notes: `${stageName} demo — cuartel ${b.block_name} (${crop}), muestra ficticia.`,
          })
        }
      }
    }

    await sb.from('phenology_observations').delete().eq('user_id', uid)
    const { error: obsErr } = await sb.from('phenology_observations').insert(obs)
    if (obsErr) log('Estados fenológicos', 'error', obsErr.message)
    else {
      const cropCount = Object.keys(PHENOLOGY_STAGES_BY_CROP).length
      log('Estados fenológicos', 'ok', `${cropCount} cultivos, ${stageRows.length} etapas + ${obs.length} observaciones`)
    }
  }

  // ── Costos y gastos ───────────────────────────────────────────────────────
  await sb.from('clasificacion_config').upsert(
    {
      cliente_id: uid,
      niveles: [
        { numero: 1, label: 'Cuenta Madre' },
        { numero: 2, label: 'Sub-Cuenta' },
        { numero: 3, label: 'Detalle' },
      ],
    },
    { onConflict: 'cliente_id' },
  )

  const opciones = [
    { nivel_numero: 1, opcion_texto: 'Costos Operacionales', orden: 1 },
    { nivel_numero: 1, opcion_texto: 'Costos de Comercialización', orden: 2 },
    { nivel_numero: 2, opcion_texto: 'Insumos Agrícolas', orden: 1 },
    { nivel_numero: 2, opcion_texto: 'Mano de Obra', orden: 2 },
    { nivel_numero: 2, opcion_texto: 'Embalaje', orden: 3 },
    { nivel_numero: 3, opcion_texto: 'Fertilizantes', orden: 1 },
    { nivel_numero: 3, opcion_texto: 'Fitosanitarios', orden: 2 },
  ]
  for (const o of opciones) {
    await sb.from('clasificacion_opciones').upsert(
      { cliente_id: uid, ...o, activo: true },
      { onConflict: 'cliente_id,nivel_numero,opcion_texto' },
    )
  }

  const compras = [
    { rut: '76.543.210-1', razon: 'Insumos Agrícola Demo SpA', doc: 'F-1001', tipo: 'Factura Electrónica', neto: 850000, iva: 161500, bruto: 1011500, cat: 'Costos Operacionales', sub: 'Insumos Agrícolas', det: 'Fertilizantes', estado: 'clasificado', mes: '2026-03' },
    { rut: '77.888.999-0', razon: 'Embalajes Pacífico Demo Ltda', doc: 'F-2045', tipo: 'Factura Electrónica', neto: 420000, iva: 79800, bruto: 499800, cat: 'Costos Operacionales', sub: 'Embalaje', det: 'Cajas y film', estado: 'clasificado', mes: '2026-03' },
    { rut: '96.765.432-1', razon: 'Servicios Campo Demo SA', doc: 'F-3100', tipo: 'Factura Electrónica', neto: 1250000, iva: 237500, bruto: 1487500, cat: 'Costos Operacionales', sub: 'Mano de Obra', det: 'Poda demo', estado: 'clasificado', mes: '2026-04' },
    { rut: '76.111.222-3', razon: 'Transportes Valle Demo SpA', doc: 'F-8891', tipo: 'Factura Electrónica', neto: 310000, iva: 58900, bruto: 368900, cat: 'Costos de Comercialización', sub: 'Flete', det: 'Traslado packing', estado: 'clasificado', mes: '2026-04' },
    { rut: '78.444.555-6', razon: 'Lab Análisis Demo Ltda', doc: 'B-501', tipo: 'Boleta Electrónica', neto: 95000, iva: 18050, bruto: 113050, cat: 'Costos Operacionales', sub: 'Insumos Agrícolas', det: 'Análisis suelo', estado: 'clasificado', mes: '2026-02' },
    { rut: '76.222.333-4', razon: 'Fitosanitarios Demo SpA', doc: 'F-1120', tipo: 'Factura Electrónica', neto: 680000, iva: 129200, bruto: 809200, cat: 'Costos Operacionales', sub: 'Insumos Agrícolas', det: 'Fitosanitarios', estado: 'clasificado', mes: '2026-01' },
    { rut: '77.333.444-5', razon: 'Energía Packing Demo Ltda', doc: 'F-3301', tipo: 'Factura Electrónica', neto: 540000, iva: 102600, bruto: 642600, cat: 'Costos Operacionales', sub: 'Mano de Obra', det: 'Operación línea', estado: 'clasificado', mes: '2026-03' },
    { rut: '78.555.666-7', razon: 'Agencia Marítima Demo SA', doc: 'F-7700', tipo: 'Factura Electrónica', neto: 920000, iva: 174800, bruto: 1094800, cat: 'Costos de Comercialización', sub: 'Flete', det: 'Flete marítimo', estado: 'clasificado', mes: '2026-03' },
    { rut: '76.666.777-8', razon: 'Certificaciones Demo SpA', doc: 'F-4412', tipo: 'Factura Electrónica', neto: 210000, iva: 39900, bruto: 249900, cat: 'Costos de Comercialización', sub: 'Flete', det: 'Certificación export', estado: 'clasificado', mes: '2026-02' },
    { rut: '77.777.888-9', razon: 'Mano Obra Temporera Demo', doc: 'F-5520', tipo: 'Factura Electrónica', neto: 1980000, iva: 376200, bruto: 2356200, cat: 'Costos Operacionales', sub: 'Mano de Obra', det: 'Cosecha demo', estado: 'clasificado', mes: '2026-04' },
    { rut: '78.888.999-0', razon: 'Frío Logístico Demo Ltda', doc: 'F-6610', tipo: 'Factura Electrónica', neto: 760000, iva: 144400, bruto: 904400, cat: 'Costos de Comercialización', sub: 'Flete', det: 'Cadena frío', estado: 'pendiente', mes: '2026-04' },
    { rut: '76.999.000-1', razon: 'Etiquetado Demo SpA', doc: 'F-8820', tipo: 'Factura Electrónica', neto: 145000, iva: 27550, bruto: 172550, cat: 'Costos Operacionales', sub: 'Embalaje', det: 'Etiquetas', estado: 'pendiente', mes: '2026-05' },
  ]

  await sb.from('registro_compras_sii').delete().eq('cliente_id', uid)
  const { data: facturas, error: siiErr } = await sb
    .from('registro_compras_sii')
    .insert(
      compras.map((c) => ({
        cliente_id: uid,
        rut_contraparte: c.rut,
        razon_social: c.razon,
        numero_documento: c.doc,
        tipo_documento: c.tipo,
        fecha_emision: `${c.mes}-15`,
        mes_devengo: c.mes,
        monto_neto: c.neto,
        monto_iva: c.iva,
        monto_bruto: c.bruto,
        categoria_madre: c.cat,
        sub_cuenta: c.sub,
        detalle_gasto: c.det,
        estado_clasificacion: c.estado,
      })),
    )
    .select('id, numero_documento, monto_bruto')

  if (siiErr) log('Costos y gastos (SII)', 'error', siiErr.message)
  else {
    await sb.from('entidades_costo').delete().eq('cliente_id', uid)
    const { data: entidades } = await sb
      .from('entidades_costo')
      .insert([
        { cliente_id: uid, tipo: 'contenedor', codigo: 'DEMO-CTR-001', nombre: 'Contenedor demo Shanghai' },
        { cliente_id: uid, tipo: 'contenedor', codigo: 'DEMO-CTR-002', nombre: 'Contenedor demo Los Angeles' },
        { cliente_id: uid, tipo: 'producto_terminado', codigo: 'DEMO-PT-LAP', nombre: 'Cereza Lapins demo' },
        { cliente_id: uid, tipo: 'pallet', codigo: 'DEMO-PAL-012', nombre: 'Pallet exportación demo' },
      ])
      .select('id, tipo, codigo')

    await sb.from('asignaciones_gastos').delete().eq('cliente_id', uid)
    log('Costos y gastos (SII)', 'ok', `${facturas?.length ?? 0} facturas SII + 4 entidades costo`)
    demoFacturas = facturas ?? []
  }

  // ── Planificación de producción (23 recetas: 5 crítico · 8 bajo · 10 OK) ───
  await sb.from('recetas_embalaje').delete().eq('cliente_id', uid)
  await sb.from('inventario_materiales').delete().eq('cliente_id', uid)

  const materialesProduccion = [
    { codigo_material: 'FILM-DEMO', descripcion: 'Film stretch', stock_actual: 400, unidad_medida: 'rollos', es_por_pallet: false },
    { codigo_material: 'ETQ-DEMO', descripcion: 'Etiqueta GS1', stock_actual: 80000, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'ETQ-PREMIUM-DEMO', descripcion: 'Etiqueta premium', stock_actual: 80000, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'GAP-DEMO', descripcion: 'Gap pad', stock_actual: 50000, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'PAL-MAD-DEMO', descripcion: 'Pallet madera', stock_actual: 500, unidad_medida: 'unidades', es_por_pallet: true },
    { codigo_material: 'CAJ-5KG-OK', descripcion: 'Caja 5 kg (stock OK)', stock_actual: 50000, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-2.5KG-OK', descripcion: 'Caja 2,5 kg (stock OK)', stock_actual: 40000, unidad_medida: 'unidades', es_por_pallet: false },
    // Limitantes críticos (< 15 pallets tras redondeo a bloques de 5)
    { codigo_material: 'CAJ-LIM-C1', descripcion: 'Caja limitante crítica 1', stock_actual: 1440, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-C2', descripcion: 'Caja limitante crítica 2', stock_actual: 1056, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-C3', descripcion: 'Caja limitante crítica 3', stock_actual: 1200, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-C4', descripcion: 'Caja limitante crítica 4', stock_actual: 1404, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-C5', descripcion: 'Caja limitante crítica 5', stock_actual: 1152, unidad_medida: 'unidades', es_por_pallet: false },
    // Limitantes stock bajo (15–49 pallets)
    { codigo_material: 'CAJ-LIM-B1', descripcion: 'Caja limitante baja 1', stock_actual: 1920, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B2', descripcion: 'Caja limitante baja 2', stock_actual: 3000, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B3', descripcion: 'Caja limitante baja 3', stock_actual: 2880, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B4', descripcion: 'Caja limitante baja 4', stock_actual: 2376, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B5', descripcion: 'Caja limitante baja 5', stock_actual: 4200, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B6', descripcion: 'Caja limitante baja 6', stock_actual: 2688, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B7', descripcion: 'Caja limitante baja 7', stock_actual: 4560, unidad_medida: 'unidades', es_por_pallet: false },
    { codigo_material: 'CAJ-LIM-B8', descripcion: 'Caja limitante baja 8', stock_actual: 4032, unidad_medida: 'unidades', es_por_pallet: false },
  ]

  const recetasDef = [
    // 5 crítico
    { codigo_receta: 'DEMO-CRT01', descripcion: 'Lapins 5 kg — Shanghai', variedad: 'Lapins', cajas_por_pallet: 120, lim: 'CAJ-LIM-C1', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-CRT02', descripcion: 'Regina 2,5 kg — USA', variedad: 'Regina', cajas_por_pallet: 96, lim: 'CAJ-LIM-C2', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-CRT03', descripcion: 'Santina 5 kg — Europa', variedad: 'Santina', cajas_por_pallet: 120, lim: 'CAJ-LIM-C3', film: 0.05, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-CRT04', descripcion: 'Kordia 5 kg — Hong Kong', variedad: 'Kordia', cajas_por_pallet: 108, lim: 'CAJ-LIM-C4', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-CRT05', descripcion: 'Mix 1 kg — retail local', variedad: 'Mix', cajas_por_pallet: 144, lim: 'CAJ-LIM-C5', film: 0.03, etq: 'ETQ-PREMIUM-DEMO', etqQty: 1 },
    // 8 stock bajo
    { codigo_receta: 'DEMO-BAJ01', descripcion: 'Regina 2,5 kg — Canadá', variedad: 'Regina', cajas_por_pallet: 96, lim: 'CAJ-LIM-B1', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-BAJ02', descripcion: 'Lapins 5 kg — Corea', variedad: 'Lapins', cajas_por_pallet: 120, lim: 'CAJ-LIM-B2', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-BAJ03', descripcion: 'Skeena 2,5 kg — Dubai', variedad: 'Skeena', cajas_por_pallet: 96, lim: 'CAJ-LIM-B3', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 1 },
    { codigo_receta: 'DEMO-BAJ04', descripcion: 'Kordia 5 kg — Singapur', variedad: 'Kordia', cajas_por_pallet: 108, lim: 'CAJ-LIM-B4', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-BAJ05', descripcion: 'Santina 5 kg — UK', variedad: 'Santina', cajas_por_pallet: 120, lim: 'CAJ-LIM-B5', film: 0.05, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-BAJ06', descripcion: 'Rainier 2,5 kg — Japón', variedad: 'Rainier', cajas_por_pallet: 96, lim: 'CAJ-LIM-B6', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-BAJ07', descripcion: 'Staccato 5 kg — Alemania', variedad: 'Staccato', cajas_por_pallet: 120, lim: 'CAJ-LIM-B7', film: 0.05, etq: 'ETQ-DEMO', etqQty: 1 },
    { codigo_receta: 'DEMO-BAJ08', descripcion: 'Sweet Heart 2,5 kg — India', variedad: 'Sweet Heart', cajas_por_pallet: 96, lim: 'CAJ-LIM-B8', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    // 10 OK (film limitante ~65–80 pallets)
    { codigo_receta: 'DEMO-OK01', descripcion: 'Lapins 5 kg — China premium', variedad: 'Lapins', cajas_por_pallet: 120, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK02', descripcion: 'Regina 2,5 kg — USA premium', variedad: 'Regina', cajas_por_pallet: 96, lim: 'CAJ-2.5KG-OK', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK03', descripcion: 'Santina 5 kg — Europa premium', variedad: 'Santina', cajas_por_pallet: 120, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK04', descripcion: 'Kordia 5 kg — Asia premium', variedad: 'Kordia', cajas_por_pallet: 108, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK05', descripcion: 'Skeena 2,5 kg — Medio Oriente', variedad: 'Skeena', cajas_por_pallet: 96, lim: 'CAJ-2.5KG-OK', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 1 },
    { codigo_receta: 'DEMO-OK06', descripcion: 'Rainier 2,5 kg — Japón premium', variedad: 'Rainier', cajas_por_pallet: 96, lim: 'CAJ-2.5KG-OK', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK07', descripcion: 'Staccato 5 kg — Canadá premium', variedad: 'Staccato', cajas_por_pallet: 120, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-DEMO', etqQty: 1 },
    { codigo_receta: 'DEMO-OK08', descripcion: 'Chelan 5 kg — Chile retail', variedad: 'Chelan', cajas_por_pallet: 120, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK09', descripcion: 'Prime 2,5 kg — exportación', variedad: 'Prime', cajas_por_pallet: 96, lim: 'CAJ-2.5KG-OK', film: 0.04, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
    { codigo_receta: 'DEMO-OK10', descripcion: 'Gold 5 kg — supermercado', variedad: 'Gold', cajas_por_pallet: 120, lim: 'CAJ-5KG-OK', film: 0.05, etq: 'ETQ-PREMIUM-DEMO', etqQty: 2 },
  ]

  const { data: mats, error: matErr } = await sb
    .from('inventario_materiales')
    .insert(materialesProduccion.map((m) => ({ cliente_id: uid, ...m })))
    .select('id, codigo_material')

  if (matErr) log('Planificación de producción', 'error', matErr.message)
  else {
    const mid = (code) => mats?.find((m) => m.codigo_material === code)?.id

    const { data: recetas } = await sb
      .from('recetas_embalaje')
      .insert(
        recetasDef.map(({ codigo_receta, descripcion, variedad, cajas_por_pallet }) => ({
          cliente_id: uid,
          codigo_receta,
          descripcion,
          variedad,
          cajas_por_pallet,
        })),
      )
      .select('id, codigo_receta')

    const detalles = []
    for (const receta of recetas ?? []) {
      const def = recetasDef.find((r) => r.codigo_receta === receta.codigo_receta)
      if (!def) continue
      const lines = [
        [def.lim, 1],
        ['FILM-DEMO', def.film],
        [def.etq, def.etqQty],
        ['GAP-DEMO', 1],
      ]
      for (const [code, qty] of lines) {
        const materialId = mid(code)
        if (materialId) detalles.push({ receta_id: receta.id, material_id: materialId, cantidad_requerida: qty })
      }
      const palId = mid('PAL-MAD-DEMO')
      if (palId) {
        detalles.push({
          receta_id: receta.id,
          material_id: palId,
          cantidad_requerida: 1 / (def.cajas_por_pallet ?? 120),
        })
      }
    }

    if (detalles.length) await sb.from('receta_detalles').insert(detalles)

    log('Planificación de producción', 'ok', `${mats?.length ?? 0} materiales + ${recetas?.length ?? 0} recetas (5 crít. · 8 bajo · 10 OK)`)
  }

  // ── Inventario ────────────────────────────────────────────────────────────
  await sb.from('inventory_min_levels').delete().eq('user_id', uid)
  await sb.from('inventory_movements').delete().eq('user_id', uid)
  await sb.from('inventory_materials').delete().eq('user_id', uid)
  await sb.from('inventory_warehouses').delete().eq('user_id', uid)

  const { data: warehouses } = await sb
    .from('inventory_warehouses')
    .insert([
      { user_id: uid, name: 'Bodega Central Demo', location: 'Valle del Maipo — packing (ficticio)' },
      { user_id: uid, name: 'Bodega Frío Demo', location: 'Cámara 2 — pre-embarque (ficticio)' },
      { user_id: uid, name: 'Bodega Insumos Demo', location: 'Anexo operaciones (ficticio)' },
    ])
    .select('id, name')

  const whCentral = warehouses?.find((w) => w.name.includes('Central'))
  const whFrio = warehouses?.find((w) => w.name.includes('Frío'))
  const whInsumos = warehouses?.find((w) => w.name.includes('Insumos'))

  const invMaterialsDef = [
    { warehouse_id: whCentral?.id, name: 'Cartón 5 kg export', unit: 'un', sku: 'INV-CAJ-5K' },
    { warehouse_id: whCentral?.id, name: 'Cartón 2,5 kg export', unit: 'un', sku: 'INV-CAJ-2K' },
    { warehouse_id: whCentral?.id, name: 'Pallet madera fumigada', unit: 'un', sku: 'INV-PAL-M' },
    { warehouse_id: whCentral?.id, name: 'Film stretch automático', unit: 'rollo', sku: 'INV-FILM' },
    { warehouse_id: whCentral?.id, name: 'Gap pad absorción', unit: 'un', sku: 'INV-GAP' },
    { warehouse_id: whCentral?.id, name: 'Etiqueta GS1 export', unit: 'un', sku: 'INV-ETQ' },
    { warehouse_id: whInsumos?.id, name: 'Cinta seguridad pallet', unit: 'rollo', sku: 'INV-CINTA' },
    { warehouse_id: whInsumos?.id, name: 'Bolsa PE ventilada', unit: 'un', sku: 'INV-BOLSA' },
    { warehouse_id: whInsumos?.id, name: 'Lámina separadora', unit: 'un', sku: 'INV-LAM' },
    { warehouse_id: whInsumos?.id, name: 'Cintillo identificación lote', unit: 'un', sku: 'INV-CINTILLO' },
    { warehouse_id: whFrio?.id, name: 'Túnel térmico reutilizable', unit: 'un', sku: 'INV-TUNEL' },
    { warehouse_id: whFrio?.id, name: 'Data logger temperatura', unit: 'un', sku: 'INV-LOGGER' },
  ].filter((m) => m.warehouse_id)

  const { data: invMat, error: invMatErr } = await sb
    .from('inventory_materials')
    .insert(invMaterialsDef.map((m) => ({ user_id: uid, ...m })))
    .select('id, name, unit, sku, warehouse_id')

  if (invMatErr) log('Inventario', 'error', invMatErr.message)
  else if (invMat?.length) {
    const bySku = (sku) => invMat.find((m) => m.sku === sku)

    const movements = [
      { sku: 'INV-CAJ-5K', wh: whCentral, type: 'entrada', qty: 2500, date: '2026-02-20', obs: 'Recepción proveedor cartón demo', cost: 1850000 },
      { sku: 'INV-CAJ-5K', wh: whCentral, type: 'salida', qty: 680, date: '2026-03-05', obs: 'Línea embalaje Lapins' },
      { sku: 'INV-CAJ-5K', wh: whCentral, type: 'salida', qty: 420, date: '2026-03-14', obs: 'Línea embalaje Santina' },
      { sku: 'INV-CAJ-2K', wh: whCentral, type: 'entrada', qty: 1800, date: '2026-02-25', obs: 'Stock inicial cajas 2,5 kg', cost: 972000 },
      { sku: 'INV-CAJ-2K', wh: whCentral, type: 'salida', qty: 310, date: '2026-03-08', obs: 'Pedido Regina USA demo' },
      { sku: 'INV-FILM', wh: whCentral, type: 'entrada', qty: 55, date: '2026-03-01', obs: 'Compra film stretch', cost: 412500 },
      { sku: 'INV-FILM', wh: whCentral, type: 'salida', qty: 12, date: '2026-03-18', obs: 'Consumo línea 1' },
      { sku: 'INV-PAL-M', wh: whCentral, type: 'entrada', qty: 120, date: '2026-02-18', obs: 'Ingreso pallets fumigados', cost: 960000 },
      { sku: 'INV-PAL-M', wh: whCentral, type: 'salida', qty: 36, date: '2026-03-12', obs: 'Despacho contenedores exportación' },
      { sku: 'INV-PAL-M', wh: whCentral, type: 'salida', qty: 22, date: '2026-03-22', obs: 'Armado pallets Seúl demo' },
      { sku: 'INV-GAP', wh: whCentral, type: 'entrada', qty: 4000, date: '2026-02-10', obs: 'Stock gap pads temporada', cost: 320000 },
      { sku: 'INV-GAP', wh: whCentral, type: 'salida', qty: 890, date: '2026-03-16', obs: 'Consumo embalaje semana 11' },
      { sku: 'INV-ETQ', wh: whCentral, type: 'entrada', qty: 15000, date: '2026-03-02', obs: 'Etiquetas GS1 recibidas', cost: 450000 },
      { sku: 'INV-ETQ', wh: whCentral, type: 'salida', qty: 4200, date: '2026-03-20', obs: 'Impresión lotes exportación' },
      { sku: 'INV-CINTA', wh: whInsumos, type: 'entrada', qty: 30, date: '2026-02-28', obs: 'Compra cinta pallet', cost: 90000 },
      { sku: 'INV-CINTA', wh: whInsumos, type: 'salida', qty: 8, date: '2026-03-15', obs: 'Despacho bodega central' },
      { sku: 'INV-BOLSA', wh: whInsumos, type: 'entrada', qty: 6000, date: '2026-02-15', obs: 'Bolsa PE ventilada', cost: 240000 },
      { sku: 'INV-LAM', wh: whInsumos, type: 'ajuste', qty: -45, date: '2026-03-10', obs: 'Ajuste inventario — merma demo' },
      { sku: 'INV-TUNEL', wh: whFrio, type: 'entrada', qty: 80, date: '2026-03-01', obs: 'Túneles térmicos cámara frío', cost: 640000 },
      { sku: 'INV-LOGGER', wh: whFrio, type: 'salida', qty: 6, date: '2026-03-19', obs: 'Asignados a contenedores DEMO-CTR' },
      { sku: 'INV-LOGGER', wh: whFrio, type: 'entrada', qty: 12, date: '2026-02-22', obs: 'Compra data loggers temporada', cost: 180000 },
      { sku: 'INV-CINTILLO', wh: whInsumos, type: 'entrada', qty: 2000, date: '2026-03-03', obs: 'Cintillos identificación lote', cost: 80000 },
      { sku: 'INV-CINTILLO', wh: whInsumos, type: 'salida', qty: 450, date: '2026-03-21', obs: 'Consumo packing semana 12' },
    ]

    const movementRows = movements
      .map((m) => {
        const mat = bySku(m.sku)
        if (!mat || !m.wh?.id) return null
        return {
          user_id: uid,
          warehouse_id: m.wh.id,
          material_id: mat.id,
          type: m.type,
          quantity: m.qty,
          unit: mat.unit,
          movement_date: m.date,
          observation: m.obs,
          responsible: 'Equipo demo UpCrop',
          cost: m.cost ?? null,
        }
      })
      .filter(Boolean)

    await sb.from('inventory_movements').insert(movementRows)

    const minLevelDefs = [
      { sku: 'INV-CAJ-5K', wh: whCentral, min: 1500 },
      { sku: 'INV-CAJ-2K', wh: whCentral, min: 1200 },
      { sku: 'INV-FILM', wh: whCentral, min: 50 },
      { sku: 'INV-PAL-M', wh: whCentral, min: 80 },
      { sku: 'INV-ETQ', wh: whCentral, min: 5000 },
      { sku: 'INV-LOGGER', wh: whFrio, min: 8 },
    ]
    const minRows = minLevelDefs
      .map((d) => {
        const mat = bySku(d.sku)
        if (!mat || !d.wh?.id) return null
        return { user_id: uid, warehouse_id: d.wh.id, material_id: mat.id, min_quantity: d.min }
      })
      .filter(Boolean)
    if (minRows.length) await sb.from('inventory_min_levels').insert(minRows)

    log(
      'Inventario',
      'ok',
      `${warehouses?.length ?? 0} bodegas, ${invMat.length} materiales, ${movementRows.length} movimientos, ${minRows.length} mínimos`,
    )
  } else {
    log('Inventario', 'error', 'No se pudo crear bodega/materiales')
  }

  // ── Bóveda documental ─────────────────────────────────────────────────────
  const vaultRes = await seedVaultDocuments(uid)
  if (!vaultRes.ok) log('Bóveda documental', 'error', vaultRes.message ?? 'sin archivos')
  else log('Bóveda documental', 'ok', `${vaultRes.folders} carpetas + ${vaultRes.count} PDF demo en storage`)

  // ── Módulos dinámicos (Producto Terminado, Trazabilidad, etc.) ────────────
  const moduleSlugs = [
    'producto-terminado',
    'trazabilidad',
    'comercio-exterior',
    'productores',
  ]
  const { data: modules } = await sb.from('modules').select('id, slug, name').in('slug', moduleSlugs)

  const dynamicSpecs = {
    'producto-terminado': {
      columns: [
        { id: 'fecha', name: 'Fecha', type: 'date' },
        { id: 'producto', name: 'Producto', type: 'text' },
        { id: 'cajas', name: 'Cajas', type: 'number' },
        { id: 'kilos', name: 'Kilos', type: 'number' },
        { id: 'destino', name: 'Destino', type: 'text' },
        { id: 'mercado', name: 'Mercado', type: 'text' },
      ],
      rows: [
        { fecha: '2026-03-10', producto: 'Cereza Lapins 5kg', cajas: 1200, kilos: 6000, destino: 'Shanghai', mercado: 'China (demo)' },
        { fecha: '2026-03-12', producto: 'Cereza Regina 2.5kg', cajas: 800, kilos: 2000, destino: 'Los Angeles', mercado: 'USA (demo)' },
        { fecha: '2026-03-15', producto: 'Cereza Santina 5kg', cajas: 950, kilos: 4750, destino: 'Rotterdam', mercado: 'Europa (demo)' },
        { fecha: '2026-03-18', producto: 'Cereza Kordia 5kg', cajas: 720, kilos: 3600, destino: 'Hong Kong', mercado: 'Asia (demo)' },
        { fecha: '2026-03-22', producto: 'Cereza Skeena 2.5kg', cajas: 640, kilos: 1600, destino: 'Dubai', mercado: 'Medio Oriente (demo)' },
        { fecha: '2026-03-25', producto: 'Cereza Lapins 5kg', cajas: 1100, kilos: 5500, destino: 'Seúl', mercado: 'Corea (demo)' },
      ],
    },
    trazabilidad: {
      columns: [
        { id: 'lote', name: 'Lote', type: 'text' },
        { id: 'cuartel', name: 'Cuartel', type: 'text' },
        { id: 'variedad', name: 'Variedad', type: 'text' },
        { id: 'contenedor', name: 'Contenedor', type: 'text' },
        { id: 'puerto', name: 'Puerto destino', type: 'text' },
        { id: 'cliente', name: 'Cliente importador', type: 'text' },
        { id: 'kilos', name: 'Kilos', type: 'number' },
        { id: 'estado', name: 'Estado', type: 'text' },
        { id: 'certificacion', name: 'Certificación', type: 'text' },
        { id: 'fecha_embarque', name: 'Fecha embarque', type: 'date' },
      ],
      rows: [
        { lote: 'LOT-DEMO-001', cuartel: 'C-01 Lapins', variedad: 'Lapins', contenedor: 'DEMO-CTR-001', puerto: 'Shanghai', cliente: 'Shanghai Fruit Demo Ltda.', kilos: 6000, estado: 'En tránsito', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-08' },
        { lote: 'LOT-DEMO-002', cuartel: 'C-02 Regina', variedad: 'Regina', contenedor: 'DEMO-CTR-002', puerto: 'Hong Kong', cliente: 'HK Cherry Trading Demo', kilos: 2000, estado: 'En packing', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-11' },
        { lote: 'LOT-DEMO-003', cuartel: 'C-03 Santina', variedad: 'Santina', contenedor: 'DEMO-CTR-003', puerto: 'Rotterdam', cliente: 'Euro Cherry Demo BV', kilos: 4750, estado: 'Documentado', certificacion: 'GRASP', fecha_embarque: '2026-03-14' },
        { lote: 'LOT-DEMO-004', cuartel: 'C-04 Kordia', variedad: 'Kordia', contenedor: 'DEMO-CTR-004', puerto: 'Los Angeles', cliente: 'Pacific Fruit USA Demo', kilos: 3600, estado: 'En tránsito', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-17' },
        { lote: 'LOT-DEMO-005', cuartel: 'C-05 Skeena', variedad: 'Skeena', contenedor: 'DEMO-CTR-005', puerto: 'Dubai', cliente: 'Gulf Produce Demo FZE', kilos: 1600, estado: 'Arribado', certificacion: 'Halal', fecha_embarque: '2026-03-20' },
        { lote: 'LOT-DEMO-006', cuartel: 'C-01 Lapins', variedad: 'Lapins', contenedor: 'DEMO-CTR-006', puerto: 'Seúl', cliente: 'Seoul Fresh Demo Co.', kilos: 5500, estado: 'En packing', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-23' },
        { lote: 'LOT-DEMO-007', cuartel: 'C-02 Regina', variedad: 'Regina', contenedor: 'DEMO-CTR-007', puerto: 'Singapur', cliente: 'Asia Berry Demo Pte', kilos: 2200, estado: 'Planificado', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-26' },
        { lote: 'LOT-DEMO-008', cuartel: 'C-03 Santina', variedad: 'Santina', contenedor: 'DEMO-CTR-008', puerto: 'Felixstowe', cliente: 'UK Cherry Demo Ltd', kilos: 4100, estado: 'En tránsito', certificacion: 'GRASP', fecha_embarque: '2026-03-09' },
        { lote: 'LOT-DEMO-009', cuartel: 'C-04 Kordia', variedad: 'Kordia', contenedor: 'DEMO-CTR-009', puerto: 'Yokohama', cliente: 'Japan Fruit Demo KK', kilos: 3800, estado: 'Documentado', certificacion: 'JAS', fecha_embarque: '2026-03-13' },
        { lote: 'LOT-DEMO-010', cuartel: 'C-05 Skeena', variedad: 'Skeena', contenedor: 'DEMO-CTR-010', puerto: 'Mumbai', cliente: 'India Fresh Demo Pvt', kilos: 1900, estado: 'En packing', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-21' },
        { lote: 'LOT-DEMO-011', cuartel: 'C-01 Lapins', variedad: 'Lapins', contenedor: 'DEMO-CTR-011', puerto: 'Shanghai', cliente: 'Shanghai Fruit Demo Ltda.', kilos: 6200, estado: 'Cosecha programada', certificacion: 'GlobalGAP', fecha_embarque: '2026-04-02' },
        { lote: 'LOT-DEMO-012', cuartel: 'C-02 Regina', variedad: 'Regina', contenedor: 'DEMO-CTR-012', puerto: 'Los Angeles', cliente: 'West Coast Demo Inc.', kilos: 2400, estado: 'Planificado', certificacion: 'GlobalGAP', fecha_embarque: '2026-04-05' },
        { lote: 'LOT-DEMO-013', cuartel: 'C-03 Santina', variedad: 'Santina', contenedor: 'DEMO-CTR-013', puerto: 'Hamburgo', cliente: 'Nord Cherry Demo GmbH', kilos: 4300, estado: 'En tránsito', certificacion: 'GRASP', fecha_embarque: '2026-03-16' },
        { lote: 'LOT-DEMO-014', cuartel: 'C-04 Kordia', variedad: 'Kordia', contenedor: 'DEMO-CTR-014', puerto: 'Hong Kong', cliente: 'HK Cherry Trading Demo', kilos: 3500, estado: 'Arribado', certificacion: 'GlobalGAP', fecha_embarque: '2026-03-19' },
      ],
    },
    productores: {
      columns: [
        { id: 'codigo', name: 'Código', type: 'text' },
        { id: 'nombre', name: 'Productor', type: 'text' },
        { id: 'rut', name: 'RUT', type: 'text' },
        { id: 'comuna', name: 'Comuna', type: 'text' },
        { id: 'hectareas', name: 'Hectáreas', type: 'number' },
        { id: 'especie', name: 'Especie', type: 'text' },
        { id: 'variedad_principal', name: 'Variedad principal', type: 'text' },
        { id: 'contrato', name: 'Contrato', type: 'text' },
        { id: 'contacto', name: 'Contacto', type: 'text' },
        { id: 'estado', name: 'Estado', type: 'text' },
      ],
      rows: [
        { codigo: 'PROD-D-01', nombre: 'Agrícola Demo Norte SpA', rut: '76.100.200-3', comuna: 'San Fernando', hectareas: 25, especie: 'Cerezo', variedad_principal: 'Lapins', contrato: 'CTR-2026-001', contacto: 'J. Pérez (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-02', nombre: 'Frutícola Demo Sur Ltda.', rut: '77.200.300-4', comuna: 'Santa Cruz', hectareas: 18, especie: 'Cerezo', variedad_principal: 'Regina', contrato: 'CTR-2026-002', contacto: 'M. Soto (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-03', nombre: 'Valle Cherry Demo SA', rut: '78.300.400-5', comuna: 'Quillota', hectareas: 32, especie: 'Cerezo', variedad_principal: 'Santina', contrato: 'CTR-2026-003', contacto: 'R. Muñoz (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-04', nombre: 'Productor Demo Valle', rut: '76.400.500-6', comuna: 'Rancagua', hectareas: 14, especie: 'Cerezo', variedad_principal: 'Kordia', contrato: 'CTR-2026-004', contacto: 'A. Vega (demo)', estado: 'En auditoría' },
        { codigo: 'PROD-D-05', nombre: 'Cordillera Demo Frutícola', rut: '77.500.600-7', comuna: 'Mostazal', hectareas: 21, especie: 'Cerezo', variedad_principal: 'Skeena', contrato: 'CTR-2026-005', contacto: 'L. Campos (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-06', nombre: 'Export Cherry Demo SpA', rut: '78.600.700-8', comuna: 'Placilla', hectareas: 28, especie: 'Cerezo', variedad_principal: 'Lapins', contrato: 'CTR-2026-006', contacto: 'C. Reyes (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-07', nombre: 'Huerto Pacífico Demo', rut: '76.700.800-9', comuna: 'Casablanca', hectareas: 12, especie: 'Cerezo', variedad_principal: 'Regina', contrato: 'CTR-2026-007', contacto: 'P. Núñez (demo)', estado: 'Suspendido' },
        { codigo: 'PROD-D-08', nombre: 'Cerezas del Sur Demo', rut: '77.800.900-0', comuna: 'Chimbarongo', hectareas: 19, especie: 'Cerezo', variedad_principal: 'Santina', contrato: 'CTR-2026-008', contacto: 'F. Ibáñez (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-09', nombre: 'Alto Maipo Demo Ltda.', rut: '78.900.100-1', comuna: 'San José de Maipo', hectareas: 16, especie: 'Cerezo', variedad_principal: 'Kordia', contrato: 'CTR-2026-009', contacto: 'D. Fuentes (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-10', nombre: 'Productor Asociado Demo', rut: '76.110.220-2', comuna: 'Melipilla', hectareas: 9, especie: 'Cerezo', variedad_principal: 'Skeena', contrato: 'CTR-2026-010', contacto: 'G. Ortiz (demo)', estado: 'Nuevo' },
        { codigo: 'PROD-D-11', nombre: 'Frutas Premium Demo SpA', rut: '77.220.330-3', comuna: 'Coltauco', hectareas: 22, especie: 'Cerezo', variedad_principal: 'Lapins', contrato: 'CTR-2026-011', contacto: 'H. Salazar (demo)', estado: 'Activo' },
        { codigo: 'PROD-D-12', nombre: 'Cooperativa Demo Central', rut: '78.330.440-4', comuna: 'Machalí', hectareas: 35, especie: 'Cerezo', variedad_principal: 'Mix', contrato: 'CTR-2026-012', contacto: 'Coordinación demo', estado: 'Activo' },
      ],
    },
  }

  const seededTables = {}

  for (const mod of modules ?? []) {
    if (mod.slug === 'comercio-exterior') {
      const res = await seedComercioExteriorDemo(uid, mod.id)
      if (!res.ok) log(`Módulo dinámico: ${mod.name}`, 'error', res.message)
      else {
        seededTables[mod.slug] = res
        log(
          `Módulo dinámico: ${mod.name}`,
          'ok',
          `${res.rowCount} filas demo (embarque + check list)`,
        )
        log(`Vistas: ${mod.name}`, 'ok', `${res.chartCount} tablas (sin gráficos extra)`)
      }
      continue
    }

    const spec = dynamicSpecs[mod.slug]
    if (!spec) continue
    const res = await seedDynamicTable(uid, mod.id, mod.name, spec.columns, spec.rows)
    if (!res.ok) log(`Módulo dinámico: ${mod.name}`, 'error', res.message)
    else {
      seededTables[mod.slug] = { tableId: res.tableId, rows: res.rows }
      log(`Módulo dinámico: ${mod.name}`, 'ok', `${spec.rows.length} filas demo`)

      const chartRes = await seedModuleCharts(uid, mod.id, mod.slug, res.tableId)
      if (!chartRes.ok) log(`Gráficos: ${mod.name}`, 'error', chartRes.message)
      else log(`Gráficos: ${mod.name}`, 'ok', `${chartRes.count} gráficos demo`)
    }
  }

  // ── Generación de documentos (tabla rica para PDF/DOCX) ───────────────────
  const { data: docModules } = await sb
    .from('modules')
    .select('id, slug, name')
    .or('slug.ilike.%documento%,name.ilike.%documento%')

  for (const docMod of docModules ?? []) {
    const docColumns = [
      { id: 'referencia', name: 'Referencia', type: 'text' },
      { id: 'cliente', name: 'Cliente', type: 'text' },
      { id: 'embarque', name: 'Embarque', type: 'text' },
      { id: 'producto', name: 'Producto', type: 'text' },
      { id: 'kilos', name: 'Kilos', type: 'number' },
      { id: 'valor_usd', name: 'Valor USD', type: 'number' },
      { id: 'puerto', name: 'Puerto', type: 'text' },
      { id: 'fecha', name: 'Fecha', type: 'date' },
      { id: 'numero_factura', name: 'N° factura', type: 'text' },
    ]
    const docRows = [
      {
        referencia: 'LIQ-DEMO-2026-001',
        cliente: 'Importadora Shanghai Demo Ltda.',
        embarque: 'EXP-DEMO-001 / DEMO-CTR-001',
        producto: 'Cereza Lapins 5kg',
        kilos: 6000,
        valor_usd: 185000,
        puerto: 'Shanghai',
        fecha: '2026-03-10',
        numero_factura: 'FE-DEMO-9001',
      },
      {
        referencia: 'LIQ-DEMO-2026-002',
        cliente: 'Pacific Fruit USA Demo Inc.',
        embarque: 'EXP-DEMO-002 / DEMO-CTR-002',
        producto: 'Cereza Regina 2.5kg',
        kilos: 2000,
        valor_usd: 92000,
        puerto: 'Los Angeles',
        fecha: '2026-03-12',
        numero_factura: 'FE-DEMO-9002',
      },
      {
        referencia: 'CTR-DEMO-2026-003',
        cliente: 'Euro Cherry Demo BV',
        embarque: 'EXP-DEMO-003 / DEMO-CTR-003',
        producto: 'Cereza Santina 5kg',
        kilos: 4750,
        valor_usd: 134000,
        puerto: 'Rotterdam',
        fecha: '2026-03-15',
        numero_factura: 'FE-DEMO-9003',
      },
      {
        referencia: 'CTR-DEMO-2026-004',
        cliente: 'Gulf Produce Demo FZE',
        embarque: 'EXP-DEMO-004 / DEMO-CTR-004',
        producto: 'Mix Kordia + Skeena',
        kilos: 5200,
        valor_usd: 76000,
        puerto: 'Dubai',
        fecha: '2026-03-20',
        numero_factura: 'FE-DEMO-9004',
      },
    ]
    const docRes = await seedDynamicTable(
      uid,
      docMod.id,
      docMod.name,
      docColumns,
      docRows,
      'Demo — Liquidaciones exportación',
    )
    if (!docRes.ok) log(`Generación de documentos: ${docMod.name}`, 'error', docRes.message)
    else log(`Generación de documentos: ${docMod.name}`, 'ok', `${docRows.length} registros + plantilla PDF/DOCX con logo`)
  }

  if (!docModules?.length) {
    log('Generación de documentos', 'skip', 'módulo no encontrado en BD — crear en admin')
  }

  // ── Centro de costos: config + asignaciones dinámicas ─────────────────────
  const traz = seededTables.trazabilidad
  const pt = seededTables['producto-terminado']

  if (traz?.tableId && demoFacturas.length >= 4) {
    await sb.from('centros_costo_config').delete().eq('cliente_id', uid)

    const configs = []

    const { data: cfgTraz, error: cfgTrazErr } = await sb
      .from('centros_costo_config')
      .insert({
        cliente_id: uid,
        tabla_id: traz.tableId,
        label: 'Trazabilidad Demo',
        col_codigo: 'lote',
        col_nombre: 'cuartel',
        cols_extra: 'Variedad, Contenedor, Puerto destino, Cliente importador, Estado',
        tipo_tabla: 'dynamic',
        activo: true,
        orden: 1,
      })
      .select('id')
      .single()

    if (cfgTrazErr) log('Centro de costos (config)', 'error', cfgTrazErr.message)
    else if (cfgTraz) configs.push({ cfg: cfgTraz, slug: 'trazabilidad', label: 'Trazabilidad Demo', cols_extra: 'Variedad, Contenedor, Puerto destino, Cliente importador, Estado', col_codigo: 'lote', col_nombre: 'cuartel' })

    if (pt?.tableId) {
      const { data: cfgPt, error: cfgPtErr } = await sb
        .from('centros_costo_config')
        .insert({
          cliente_id: uid,
          tabla_id: pt.tableId,
          label: 'Producto Terminado Demo',
          col_codigo: 'producto',
          col_nombre: 'destino',
          cols_extra: 'Fecha, Cajas, Kilos, Mercado',
          tipo_tabla: 'dynamic',
          activo: true,
          orden: 2,
        })
        .select('id')
        .single()
      if (cfgPtErr) log('Centro de costos (config PT)', 'error', cfgPtErr.message)
      else if (cfgPt) configs.push({ cfg: cfgPt, slug: 'producto-terminado', label: 'Producto Terminado Demo', cols_extra: 'Fecha, Cajas, Kilos, Mercado', col_codigo: 'producto', col_nombre: 'destino' })
    }

    const asignaciones = []
    const trazRows = traz.rows.slice(0, 8)
    const ptRows = pt?.rows?.slice(0, 4) ?? []

    trazRows.forEach((row, i) => {
      const factura = demoFacturas[i]
      if (!factura || !configs[0]) return
      const data = row.data ?? {}
      asignaciones.push({
        factura_id: factura.id,
        cliente_id: uid,
        entidad_tipo: 'dinamico',
        entidad_id: String(data.lote ?? row.id),
        monto_asignado: Math.round(Number(factura.monto_bruto) * 0.65),
        porcentaje: 65,
        metadata: {
          config_id: configs[0].cfg.id,
          label: configs[0].label,
          row_id: row.id,
          nombre: String(data.cuartel ?? ''),
          cols_extra: configs[0].cols_extra,
          data,
        },
      })
    })

    ptRows.forEach((row, i) => {
      const factura = demoFacturas[i + 4]
      const cfgPt = configs.find((c) => c.slug === 'producto-terminado')
      if (!factura || !cfgPt) return
      const data = row.data ?? {}
      asignaciones.push({
        factura_id: factura.id,
        cliente_id: uid,
        entidad_tipo: 'dinamico',
        entidad_id: String(data.producto ?? row.id),
        monto_asignado: Math.round(Number(factura.monto_bruto) * 0.55),
        porcentaje: 55,
        metadata: {
          config_id: cfgPt.cfg.id,
          label: cfgPt.label,
          row_id: row.id,
          nombre: String(data.destino ?? ''),
          cols_extra: cfgPt.cols_extra,
          data,
        },
      })
    })

    const factByDoc = (doc) => demoFacturas.find((f) => f.numero_documento === doc)
    const marginSpecs = [
      { doc: 'F-5520', tipo: 'contenedor', id: 'DEMO-CTR-001', pct: 100 },
      { doc: 'F-7700', tipo: 'contenedor', id: 'DEMO-CTR-001', pct: 100 },
      { doc: 'F-3100', tipo: 'contenedor', id: 'DEMO-CTR-001', pct: 50 },
      { doc: 'F-2045', tipo: 'contenedor', id: 'DEMO-CTR-002', pct: 100 },
      { doc: 'F-8891', tipo: 'contenedor', id: 'DEMO-CTR-002', pct: 100 },
      { doc: 'F-1120', tipo: 'producto_terminado', id: 'DEMO-PT-LAP', pct: 100 },
      { doc: 'F-3301', tipo: 'producto_terminado', id: 'DEMO-PT-LAP', pct: 100 },
    ]
    for (const spec of marginSpecs) {
      const factura = factByDoc(spec.doc)
      if (!factura) continue
      asignaciones.push({
        factura_id: factura.id,
        cliente_id: uid,
        entidad_tipo: spec.tipo,
        entidad_id: spec.id,
        monto_asignado: Math.round(Number(factura.monto_bruto) * (spec.pct / 100)),
        porcentaje: spec.pct,
        metadata: { origen: 'seed-demo-margen', entidad_label: spec.id },
      })
    }

    if (asignaciones.length) {
      const { error: asigErr } = await sb.from('asignaciones_gastos').insert(asignaciones)
      if (asigErr) log('Centro de costos (asignaciones)', 'error', asigErr.message)
      else {
        const dinamicas = asignaciones.filter((a) => a.entidad_tipo === 'dinamico').length
        const margen = asignaciones.length - dinamicas
        log('Centro de costos', 'ok', `${configs.length} configs + ${dinamicas} dinámicas + ${margen} margen`)
      }
    }
  } else {
    log('Centro de costos', 'skip', 'faltan tablas trazabilidad o facturas SII')
  }

  // ── Producción por entidad (margen contenedor / PT) ───────────────────────
  await sb.from('produccion_datos').delete().eq('cliente_id', uid)
  const { error: prodErr } = await sb.from('produccion_datos').insert([
    { cliente_id: uid, entidad_tipo: 'contenedor', entidad_id: 'DEMO-CTR-001', kilos: 6000, venta_total: 27000000, precio_por_kilo: 4500, periodo: 'Marzo 2026', metadata: { mercado: 'China' } },
    { cliente_id: uid, entidad_tipo: 'contenedor', entidad_id: 'DEMO-CTR-002', kilos: 2000, venta_total: 9200000, precio_por_kilo: 4600, periodo: 'Marzo 2026', metadata: { mercado: 'USA' } },
    { cliente_id: uid, entidad_tipo: 'producto_terminado', entidad_id: 'DEMO-PT-LAP', kilos: 5500, venta_total: 16800000, precio_por_kilo: 3055, periodo: 'Marzo 2026', metadata: { producto: 'Lapins 5kg' } },
    { cliente_id: uid, entidad_tipo: 'pallet', entidad_id: 'DEMO-PAL-012', kilos: 1200, venta_total: 0, precio_por_kilo: 0, periodo: 'Marzo 2026', metadata: { nota: 'Pallet interno demo' } },
  ])
  if (prodErr) log('Producción por entidad', 'error', prodErr.message)
  else log('Producción por entidad', 'ok', '4 registros CLP (visible en margen del centro de costos)')

  // ── Alertas admin (Inicio / SmartAlerts) ──────────────────────────────────
  await sb.from('admin_notifications').delete().like('title', '[Demo UpCrop]%')
  const activeUntil = new Date()
  activeUntil.setFullYear(activeUntil.getFullYear() + 2)
  const { error: notifErr } = await sb.from('admin_notifications').insert([
    {
      title: '[Demo UpCrop] Temporada exportación 2026',
      message: 'Datos ficticios cargados para revisión MVP. Contenedores DEMO-CTR-001 a 004 listos en trazabilidad.',
      severity: 'info',
      active_from: new Date().toISOString(),
      active_until: activeUntil.toISOString(),
      target_role: 'admin',
    },
    {
      title: '[Demo UpCrop] Revisar stock bajo mínimo',
      message: 'Hay materiales de embalaje bajo el umbral configurado en Inventario. Revisa alertas y planifica reposición.',
      severity: 'warning',
      active_from: new Date().toISOString(),
      active_until: activeUntil.toISOString(),
      target_role: 'admin',
    },
  ])
  if (notifErr) log('Alertas inicio', 'error', notifErr.message)
  else log('Alertas inicio', 'ok', '2 avisos demo (solo administradores de plataforma)')

  // ── Mercado: sin datos en BD ──────────────────────────────────────────────
  log('Mercado', 'skip', 'usa datos simulados en la UI — no requiere seed')

  log('Centro de control', 'ok', 'SmartAlerts: avisos admin + stock bajo mínimo (inventario demo)')

  console.log('\n── Resumen ──')
  const ok = results.filter((r) => r.status === 'ok').length
  const skip = results.filter((r) => r.status === 'skip').length
  const err = results.filter((r) => r.status === 'error').length
  console.log(`${ok} ok · ${skip} omitidos · ${err} errores`)
  console.log('\nNicolás puede entrar con nico@upcrop-ia y revisar módulos en /dashboard')
  if (err > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
