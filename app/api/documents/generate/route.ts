import React from 'react'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import {
  buildDocumentData,
  DocumentFormat,
  DocumentKind,
  getDocumentLabel,
} from '@/lib/documents/document-utils'
import { PdfDocument } from '@/lib/documents/pdf-template'
import { generateDocxBuffer } from '@/lib/documents/docx-template'
import { getUpCropLogoBuffer, getUpCropLogoDataUri } from '@/lib/documents/load-logo'
import { logAudit } from '@/lib/audit-log'

export const runtime = 'nodejs'

const VALID_KINDS: DocumentKind[] = ['contract', 'report', 'invoice']
const VALID_FORMATS: DocumentFormat[] = ['pdf', 'docx']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kind = body?.kind as DocumentKind
    const format = body?.format as DocumentFormat
    const tableId = String(body?.tableId ?? '')
    const rowId = String(body?.rowId ?? '')
    const columnOrder = Array.isArray(body?.columnOrder)
      ? body.columnOrder.filter((value: unknown) => typeof value === 'string')
      : undefined
    const visibleColumns = Array.isArray(body?.visibleColumns)
      ? body.visibleColumns.filter((value: unknown) => typeof value === 'string')
      : undefined

    if (!VALID_KINDS.includes(kind) || !VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: 'Formato o tipo de documento no valido.' },
        { status: 400 },
      )
    }

    if (!tableId || !rowId) {
      return NextResponse.json(
        { error: 'Faltan datos para generar el documento.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const { data: table, error: tableError } = await supabase
      .from('dynamic_tables')
      .select('id, name, columns')
      .eq('id', tableId)
      .single()

    if (tableError || !table) {
      return NextResponse.json(
        { error: 'No se encontro la tabla solicitada.' },
        { status: 404 },
      )
    }

    const { data: row, error: rowError } = await supabase
      .from('dynamic_table_rows')
      .select('id, data')
      .eq('id', rowId)
      .eq('table_id', tableId)
      .single()

    if (rowError || !row) {
      return NextResponse.json(
        { error: 'No se encontro el registro solicitado.' },
        { status: 404 },
      )
    }

    const docData = buildDocumentData(table, row, { columnOrder, visibleColumns })
    const label = getDocumentLabel(kind)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `${label}_${timestamp}.${format}`

    void logAudit(supabase, {
      action_type: 'DOCUMENT_GENERATE',
      description: `Generó documento ${label} (${format.toUpperCase()}) desde "${table.name}"`,
      target_type: 'document',
      target_id: rowId,
      target_label: `${label} — ${table.name}`,
      metadata: { kind, format, table_id: tableId, table_name: table.name },
    })

    const logoSrc = getUpCropLogoDataUri()
    const logoBuffer = getUpCropLogoBuffer()

    if (format === 'pdf') {
      const pdfBuffer = await renderToBuffer(
        React.createElement(PdfDocument, { kind, data: docData, logoSrc }),
      )
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    const docxBuffer = await generateDocxBuffer(kind, docData, logoBuffer)
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Document generation error:', error)
    return NextResponse.json(
      { error: 'Error inesperado al generar el documento.' },
      { status: 500 },
    )
  }
}
