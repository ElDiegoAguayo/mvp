import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { DocumentData, DocumentKind, getDocumentLabel } from './document-utils'

export async function generateDocxBuffer(
  kind: DocumentKind,
  data: DocumentData,
): Promise<Buffer> {
  const title = new Paragraph({
    children: [
      new TextRun({ text: getDocumentLabel(kind), bold: true, size: 32 }),
    ],
  })

  const subtitle = new Paragraph({
    children: [new TextRun({ text: data.subtitle, color: '64748b' })],
  })

  const summary = new Paragraph({
    children: [new TextRun({ text: data.title })],
    spacing: { after: 200 },
  })

  const rows = data.fields.length
    ? data.fields.map(
        (field) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ text: field.label })],
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ text: field.value })],
              }),
            ],
          }),
      )
    : [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ text: 'No hay datos disponibles para este registro.' }),
              ],
              columnSpan: 2,
            }),
          ],
        }),
      ]

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })

  const doc = new Document({
    sections: [
      {
        children: [title, subtitle, summary, table],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
