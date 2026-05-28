import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ImageRun,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx'
import { DocumentData, DocumentKind, getDocumentLabel } from './document-utils'

const BRAND = '4063ca'
const BRAND_LIGHT = 'eef2fc'

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
}

export async function generateDocxBuffer(
  kind: DocumentKind,
  data: DocumentData,
  logoBuffer?: Buffer | null,
): Promise<Buffer> {
  const headerChildren: Paragraph[] = []

  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            type: 'png',
            transformation: { width: 140, height: 37 },
          }),
        ],
        spacing: { after: 120 },
      }),
    )
  }

  headerChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'UpCrop', bold: true, size: 22, color: BRAND }),
        new TextRun({ text: '  ·  Inteligencia agrícola', size: 18, color: '64748b' }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: getDocumentLabel(kind).toUpperCase(),
          bold: true,
          size: 18,
          color: 'ffffff',
        }),
      ],
      shading: { type: ShadingType.CLEAR, fill: BRAND, color: 'auto' },
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.title, bold: true, size: 32, color: '0f172a' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.subtitle, color: '475569', size: 22 })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'DETALLE DEL REGISTRO',
          bold: true,
          size: 20,
          color: BRAND,
        }),
      ],
      spacing: { after: 120 },
    }),
  )

  const rows = data.fields.length
    ? data.fields.map(
        (field, index) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 38, type: WidthType.PERCENTAGE },
                shading:
                  index % 2 === 0
                    ? { type: ShadingType.CLEAR, fill: 'f8fafc', color: 'auto' }
                    : undefined,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: field.label, bold: true, size: 18 })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 62, type: WidthType.PERCENTAGE },
                shading:
                  index % 2 === 0
                    ? { type: ShadingType.CLEAR, fill: 'fafbfc', color: 'auto' }
                    : undefined,
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
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'f1f5f9' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'f1f5f9' },
    },
    rows,
  })

  const footer = new Paragraph({
    children: [
      new TextRun({
        text: `Documento generado por UpCrop · ${formatGeneratedAt()}`,
        size: 16,
        color: '94a3b8',
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 360 },
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children: [...headerChildren, table, footer],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
