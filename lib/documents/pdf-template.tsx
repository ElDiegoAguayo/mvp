import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DocumentData, DocumentKind, getDocumentLabel } from './document-utils'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#475569',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 600,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 6,
  },
  label: {
    width: '35%',
    color: '#475569',
    fontSize: 10,
  },
  value: {
    width: '65%',
    fontSize: 10,
  },
})

export function PdfDocument({ kind, data }: { kind: DocumentKind; data: DocumentData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{getDocumentLabel(kind)}</Text>
          <Text style={styles.subtitle}>{data.subtitle}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumen</Text>
        <View>
          <Text>{data.title}</Text>
        </View>

        <Text style={styles.sectionTitle}>Detalle</Text>
        <View>
          {data.fields.length === 0 ? (
            <Text>No hay datos disponibles para este registro.</Text>
          ) : (
            data.fields.map((field) => (
              <View key={field.label} style={styles.row}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.value}>{field.value}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  )
}
