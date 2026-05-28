'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Search, SlidersHorizontal } from 'lucide-react'
import type { GastoPorContraparte } from '@/app/actions/costos-gastos'
import { ContraparteCard } from './contraparte-card'
import { ClasificacionSheet } from './clasificacion-sheet'
import { DocumentosClasificadosSheet } from './documentos-clasificados-sheet'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePagination } from '@/hooks/use-pagination'
import { TablePaginationBar } from '@/components/ui/table-pagination-bar'

const PAGE_SIZE = 12

interface Props {
  gastos: GastoPorContraparte[]
  clienteId: string
}

type StatusFilter = 'todos' | 'pendientes' | 'clasificados'
type SortKey = 'monto' | 'pendientes' | 'nombre'

export function GastosDashboard({ gastos, clienteId }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sortKey, setSortKey] = useState<SortKey>('pendientes')

  const [clasificarOpen, setClasificarOpen] = useState(false)
  const [selectedClasificar, setSelectedClasificar] = useState<GastoPorContraparte | null>(null)
  const [verClasOpen, setVerClasOpen] = useState(false)
  const [selectedVerClas, setSelectedVerClas] = useState<GastoPorContraparte | null>(null)

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

  const handleReclasificar = useCallback((rut: string) => {
    const contraparte = gastos.find((g) => g.rut_contraparte === rut)
    if (contraparte) {
      setSelectedClasificar(contraparte)
      setClasificarOpen(true)
    }
    router.refresh()
  }, [gastos, router])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...gastos]

    if (q) {
      list = list.filter(
        (g) =>
          g.razon_social.toLowerCase().includes(q) ||
          g.rut_contraparte.toLowerCase().includes(q),
      )
    }

    if (statusFilter === 'pendientes') {
      list = list.filter((g) => g.pendientes > 0)
    } else if (statusFilter === 'clasificados') {
      list = list.filter((g) => g.clasificados > 0 && g.pendientes === 0)
    }

    list.sort((a, b) => {
      if (sortKey === 'monto') return b.total_monto_bruto - a.total_monto_bruto
      if (sortKey === 'pendientes') return b.pendientes - a.pendientes || b.total_monto_bruto - a.total_monto_bruto
      return (a.razon_social || a.rut_contraparte).localeCompare(b.razon_social || b.rut_contraparte)
    })

    return list
  }, [gastos, search, statusFilter, sortKey])

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    paginatedItems,
    startIndex,
    endIndex,
    hasPagination,
  } = usePagination(filtered, PAGE_SIZE)

  const hasPendingDocs = gastos.some((g) => g.pendientes > 0)

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Contrapartes ({filtered.length}{filtered.length !== gastos.length ? ` de ${gastos.length}` : ''})
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 flex-1 lg:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o RUT…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendientes">Con pendientes</SelectItem>
                <SelectItem value="clasificados">Al día</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-44 h-9">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendientes">Más pendientes</SelectItem>
                <SelectItem value="monto">Mayor monto</SelectItem>
                <SelectItem value="nombre">Nombre A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasPendingDocs && statusFilter !== 'clasificados' && (
          <p className="text-xs text-muted-foreground">
            Las tarjetas con badge amarillo tienen documentos por clasificar — haz clic para abrirlas.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Ninguna contraparte coincide con los filtros aplicados.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedItems.map((gasto) => (
                <ContraparteCard
                  key={gasto.rut_contraparte}
                  data={gasto}
                  onClick={gasto.pendientes > 0 ? () => handleClasificar(gasto) : undefined}
                  onVerClasificados={gasto.clasificados > 0 ? () => handleVerClasificados(gasto) : undefined}
                />
              ))}
            </div>
            {hasPagination && (
              <TablePaginationBar
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                onPageChange={setPage}
                itemLabel="contrapartes"
              />
            )}
          </>
        )}
      </section>

      <ClasificacionSheet
        open={clasificarOpen}
        onOpenChange={setClasificarOpen}
        contraparte={selectedClasificar}
        clienteId={clienteId}
        onGuardado={handleGuardado}
      />

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
