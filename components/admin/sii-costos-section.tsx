'use client'

import { useState } from 'react'
import { FileSpreadsheet, ListTree, Container } from 'lucide-react'
import { SiiUploader } from './sii-uploader'
import { SiiHistorial } from './sii-historial'
import { TaxonomyManager } from './taxonomy-manager'
import { EntidadesCostoManager } from './entidades-costo-manager'
import type { ProcesarResult } from '@/app/actions/costos-gastos'

interface SiiCostosSectionProps {
  clienteId: string
}

type Tab = 'importar' | 'clasificacion' | 'centros'

/**
 * Wraps the SII uploader, upload history, and classification taxonomy manager.
 * Tabbed layout separates data import from taxonomy configuration.
 */
export function SiiCostosSection({ clienteId }: SiiCostosSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('importar')

  const handleUploadSuccess = (_result: ProcesarResult) => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Tabs */}
      <div className="flex border-b border-border px-6 pt-4 gap-1">
        <TabButton
          active={activeTab === 'importar'}
          onClick={() => setActiveTab('importar')}
          icon={<FileSpreadsheet className="w-4 h-4" />}
          label="Importar Datos"
        />
        <TabButton
          active={activeTab === 'clasificacion'}
          onClick={() => setActiveTab('clasificacion')}
          icon={<ListTree className="w-4 h-4" />}
          label="Clasificación"
        />
        <TabButton
          active={activeTab === 'centros'}
          onClick={() => setActiveTab('centros')}
          icon={<Container className="w-4 h-4" />}
          label="Centros de Costo"
        />
      </div>

      <div className="p-6 space-y-6">
        {activeTab === 'importar' && (
          <>
            {/* Upload header */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Importar Libro de Compras SII
                </h2>
                <p className="text-xs text-muted-foreground">
                  Sube el archivo Excel exportado desde el SII para registrar los gastos del período.
                </p>
              </div>
            </div>

            {/* Uploader */}
            <SiiUploader clienteId={clienteId} onSuccess={handleUploadSuccess} />

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Historial */}
            <SiiHistorial clienteId={clienteId} refreshKey={refreshKey} />
          </>
        )}

        {activeTab === 'clasificacion' && (
          <TaxonomyManager clienteId={clienteId} />
        )}

        {activeTab === 'centros' && (
          <EntidadesCostoManager clienteId={clienteId} />
        )}
      </div>
    </div>
  )
}

// ── Tab button helper ──────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
