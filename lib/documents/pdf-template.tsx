import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { DocumentData, DocumentKind, getDocumentLabel } from './document-utils'

const BRAND = '#4063ca'
const BRAND_LIGHT = '#eef2fc'

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 108,
    height: 28,
    objectFit: 'contain',
  },
  brandText: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 11,
    fontWeight: 700,
    color: BRAND,
    letterSpacing: 0.4,
  },
  brandTagline: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  docKind: {
    fontSize: 9,
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: BRAND,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  titleBlock: {
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: BRAND,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowAlt: {
    backgroundColor: '#fafbfc',
  },
  label: {
    width: '38%',
    paddingVertical: 7,
    paddingHorizontal: 10,
    color: '#475569',
    fontSize: 9,
    fontWeight: 600,
    backgroundColor: '#f8fafc',
  },
  value: {
    width: '62%',
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 9,
    color: '#0f172a',
  },
  empty: {
    padding: 12,
    color: '#64748b',
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
})

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
}

export function PdfDocument({
  kind,
  data,
  logoSrc,
}: {
  kind: DocumentKind
  data: DocumentData
  logoSrc?: string | null
}) {
  const generatedAt = formatGeneratedAt()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
            <View style={styles.brandText}>
              <Text style={styles.brandName}>UpCrop</Text>
              <Text style={styles.brandTagline}>Inteligencia agrícola</Text>
            </View>
          </View>
          <Text style={styles.docKind}>{getDocumentLabel(kind)}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>{data.subtitle}</Text>
        </View>

        <Text style={styles.sectionTitle}>Detalle del registro</Text>
        <View style={styles.table}>
          {data.fields.length === 0 ? (
            <Text style={styles.empty}>No hay datos disponibles para este registro.</Text>
          ) : (
            data.fields.map((field, index) => (
              <View
                key={field.label}
                style={[styles.row, index % 2 === 1 ? styles.rowAlt : undefined]}
              >
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.value}>{field.value}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Documento generado por UpCrop</Text>
          <Text style={styles.footerText}>{generatedAt}</Text>
        </View>
      </Page>
    </Document>
  )
}
