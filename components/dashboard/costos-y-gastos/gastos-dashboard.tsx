'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import type { GastoPorContraparte } from '@/app/actions/costos-gastos'
import { ContraparteCard } from './contraparte-card'
import { ClasificacionSheet } from './clasificacion-sheet'
import { DocumentosClasificadosSheet } from './documentos-clasificados-sheet'

interface Props {
  gastos: GastoPorContraparte[]
  clienteId: string
}

export function GastosDashboard({ gastos, clienteId }: Props) {
  const router = useRouter()

  // Classification sheet (pending docs)
  const [clasificarOpen, setClasificarOpen]         = useState(false)
  const [selectedClasificar, setSelectedClasificar] = useState<GastoPorContraparte | null>(null)

  // Classified docs viewer
  const [verClasOpen, setVerClasOpen]               = useState(false)
  const [selectedVerClas, setSelectedVerClas]       = useState<GastoPorContraparte | null>(null)

  const handleClasificar = useCallback((contraparte: GastoPorContraparte) => {
    setSelectedClasificar(contraparte)
    setClasificarOpen(true)
  }, [])

  const handleVerClasificados = useCallback((contraparte: GastoPorContraparte) => {
    setSelectedVerClas(contraparte)
    setVerClasOpen(true)
  }, [])

  const handleGuardado = useCallback(() => {
    router.refresh()
  }, [router])

  // Called from DocumentosClasificadosSheet when user wants to re-classify
  // Closes the classified viewer and opens the classification sheet for that rut
  const handleReclasificar = useCallback((rut: string) => {
    const contraparte = gastos.find((g) => g.rut_contraparte === rut)
    if (contraparte) {
      setSelectedClasificar(contraparte)
      setClasificarOpen(true)
    }
    // Refresh so the now-pending docs appear in ClasificacionSheet
    router.refresh()
  }, [gastos, router])

  const hasPendingDocs = gastos.some((g) => g.pendientes > 0)

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Contrapartes ({gastos.length})
          </h2>
          {hasPendingDocs && (
            <span className="text-xs text-muted-foreground">
              · haz clic en una tarjeta para clasificar sus documentos
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gastos.map((gasto) => (
            <ContraparteCard
              key={gasto.rut_contraparte}
              data={gasto}
              onClick={gasto.pendientes > 0 ? () => handleClasificar(gasto) : undefined}
              onVerClasificados={gasto.clasificados > 0 ? () => handleVerClasificados(gasto) : undefined}
            />
          ))}
        </div>
      </section>

      {/* Sheet: classify pending */}
      <ClasificacionSheet
        open={clasificarOpen}
        onOpenChange={setClasificarOpen}
        contraparte={selectedClasificar}
        clienteId={clienteId}
        onGuardado={handleGuardado}
      />

      {/* Sheet: view classified */}
      <DocumentosClasificadosSheet
        open={verClasOpen}
        onOpenChange={setVerClasOpen}
        contraparte={selectedVerClas}
        clienteId={clienteId}
        onReclasificar={handleReclasificar}
      />
    </>
  )
}
