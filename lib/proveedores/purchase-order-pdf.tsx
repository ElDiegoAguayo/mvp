import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

export interface PurchaseOrderPdfLine {
  description: string
  quantity: number
  unit: string
  unit_price_net: number
  line_total_net: number
}

export interface PurchaseOrderPdfData {
  orderNumber: string
  issueDate: string
  currency: string
  buyer: {
    name: string
    taxId?: string
    address?: string
    email?: string
    phone?: string
    logoSrc?: string | null
  }
  supplier: {
    name: string
    taxId?: string
    address?: string
    contactName?: string
    email?: string
    phone?: string
  }
  lines: PurchaseOrderPdfLine[]
  subtotal_net: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes: string
  quotationReference?: string
}

const BRAND = '#1e3a5f'

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  buyerBlock: { flex: 1.2, paddingRight: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  buyerLogo: { width: 64, height: 64, objectFit: 'contain' },
  buyerText: { flex: 1 },
  buyerName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  buyerLine: { fontSize: 8, color: '#374151', marginBottom: 2 },
  orderMeta: { flex: 0.8, alignItems: 'flex-end' },
  orderNumber: { fontSize: 14, fontWeight: 700, color: BRAND },
  orderDate: { fontSize: 9, marginTop: 4, color: '#374151' },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1.2,
    marginVertical: 12,
    color: BRAND,
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 10,
  },
  sectionHeader: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  sectionBody: { padding: 8 },
  supplierName: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
  supplierLine: { fontSize: 8, color: '#374151', marginBottom: 2 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND,
    color: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 8,
  },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  colDesc: { width: '40%' },
  colQtyUnit: { width: '14%', textAlign: 'right' },
  colPrice: { width: '22%', textAlign: 'right' },
  colTotal: { width: '24%', textAlign: 'right' },
  totalsBox: {
    marginTop: 8,
    marginLeft: 'auto',
    width: '52%',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    fontSize: 8,
  },
  totalLabelCol: { flex: 1, paddingRight: 10 },
  totalLabelMain: { fontSize: 8, fontWeight: 700 },
  totalLabelSub: { fontSize: 6.5, color: '#6b7280', marginTop: 2 },
  totalAmount: { fontSize: 8, fontWeight: 700, textAlign: 'right', minWidth: 72 },
  totalRowFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    fontSize: 9,
    fontWeight: 700,
  },
  notesBlock: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 8,
  },
  notesTitle: { fontSize: 8, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' },
  notesText: { fontSize: 8, color: '#374151', lineHeight: 1.4 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#6b7280',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
})

function fmtAmount(value: number, currency: string): string {
  const decimals = currency === 'CLP' ? 0 : 2
  const formatted = value.toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return currency === 'USD' ? `US$ ${formatted}` : `$ ${formatted}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function fmtQty(value: number): string {
  return value.toLocaleString('es-CL', { maximumFractionDigits: 4 })
}

export function PurchaseOrderPdfDocument({ data }: { data: PurchaseOrderPdfData }) {
  const currencyLabel =
    data.currency === 'USD'
      ? 'VALORES EN DÓLARES AMERICANOS (US$)'
      : 'VALORES EN PESOS CHILENOS ($)'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.buyerBlock}>
            {data.buyer.logoSrc ? (
              <Image src={data.buyer.logoSrc} style={styles.buyerLogo} />
            ) : null}
            <View style={styles.buyerText}>
              <Text style={styles.buyerName}>{data.buyer.name}</Text>
              {data.buyer.taxId ? <Text style={styles.buyerLine}>RUT {data.buyer.taxId}</Text> : null}
              {data.buyer.address ? <Text style={styles.buyerLine}>{data.buyer.address}</Text> : null}
              {data.buyer.email ? <Text style={styles.buyerLine}>{data.buyer.email}</Text> : null}
              {data.buyer.phone ? <Text style={styles.buyerLine}>{data.buyer.phone}</Text> : null}
            </View>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.orderNumber}>N° {data.orderNumber}</Text>
            <Text style={styles.orderDate}>{fmtDate(data.issueDate)}</Text>
            {data.quotationReference ? (
              <Text style={styles.orderDate}>Ref. cotización: {data.quotationReference}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.title}>ORDEN DE COMPRA</Text>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionHeader}>Proveedor</Text>
          <View style={styles.sectionBody}>
            <Text style={styles.supplierName}>{data.supplier.name}</Text>
            {data.supplier.taxId ? <Text style={styles.supplierLine}>RUT {data.supplier.taxId}</Text> : null}
            {data.supplier.address ? <Text style={styles.supplierLine}>{data.supplier.address}</Text> : null}
            {data.supplier.contactName ? (
              <Text style={styles.supplierLine}>Contacto: {data.supplier.contactName}</Text>
            ) : null}
            {data.supplier.email ? <Text style={styles.supplierLine}>{data.supplier.email}</Text> : null}
            {data.supplier.phone ? <Text style={styles.supplierLine}>{data.supplier.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Descripción</Text>
          <Text style={styles.colQtyUnit}>Cant. / Unidad</Text>
          <Text style={styles.colPrice}>Precio unit.</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>

        {data.lines.map((line, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={styles.colDesc}>{line.description}</Text>
            <Text style={styles.colQtyUnit}>{fmtQty(line.quantity)} {line.unit}</Text>
            <Text style={styles.colPrice}>{fmtAmount(line.unit_price_net, data.currency)}</Text>
            <Text style={styles.colTotal}>{fmtAmount(line.line_total_net, data.currency)}</Text>
          </View>
        ))}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <View style={styles.totalLabelCol}>
              <Text style={styles.totalLabelMain}>SUBTOTAL</Text>
              <Text style={styles.totalLabelSub}>({currencyLabel})</Text>
            </View>
            <Text style={styles.totalAmount}>{fmtAmount(data.subtotal_net, data.currency)}</Text>
          </View>
          {data.tax_rate > 0 ? (
            <View style={styles.totalRow}>
              <View style={styles.totalLabelCol}>
                <Text style={styles.totalLabelMain}>IVA ({data.tax_rate}%)</Text>
              </View>
              <Text style={styles.totalAmount}>{fmtAmount(data.tax_amount, data.currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRowFinal}>
            <View style={styles.totalLabelCol}>
              <Text style={styles.totalLabelMain}>TOTAL</Text>
            </View>
            <Text style={styles.totalAmount}>{fmtAmount(data.total_amount, data.currency)}</Text>
          </View>
        </View>

        {data.notes.trim() ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesTitle}>Notas / condiciones</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Documento generado por Up Crop</Text>
          <Text>{currencyLabel}</Text>
        </View>
      </Page>
    </Document>
  )
}
