'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getPurchaseInvoiceFileUrlAction,
  listPurchaseInvoicesAction,
  updatePurchaseInvoiceStatusAction,
} from '@/app/actions/proveedores-actions'
import type { PurchaseInvoiceStatus, SupplierPurchaseInvoice } from '@/lib/proveedores/types'
import { formatMoney, invoiceStatusClass } from '@/lib/proveedores/format'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ExternalLink, Loader2, MoreHorizontal, Receipt } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'

export function PurchaseInvoicesManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [invoices, setInvoices] = useState<SupplierPurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listPurchaseInvoicesAction()
    if (res.ok) setInvoices(res.data)
    else toast.error(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const issued = invoices.filter(i => i.status === 'issued').length
    const paid = invoices.filter(i => i.status === 'paid').length
    const amount = invoices
      .filter(i => i.status !== 'cancelled')
      .reduce((s, i) => s + i.total_amount, 0)
    return { total: invoices.length, issued, paid, amount }
  }, [invoices])

  const statusLabel = (status: PurchaseInvoiceStatus) =>
    t(`proveedores.invoices.statuses.${status}` as 'proveedores.invoices.statuses.issued')

  const updateStatus = (id: string, status: PurchaseInvoiceStatus) => {
    startTransition(async () => {
      const res = await updatePurchaseInvoiceStatusAction(id, status)
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      toast.success(t('proveedores.invoices.statusUpdated'))
      await load()
    })
  }

  const viewPdf = (invoice: SupplierPurchaseInvoice) => {
    startTransition(async () => {
      const res = await getPurchaseInvoiceFileUrlAction(invoice.id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('proveedores.invoices.kpi.total'), value: String(kpis.total) },
          { label: t('proveedores.invoices.kpi.issued'), value: String(kpis.issued) },
          { label: t('proveedores.invoices.kpi.paid'), value: String(kpis.paid) },
          { label: t('proveedores.invoices.kpi.amount'), value: formatMoney(kpis.amount, 'CLP', dateLocale) },
        ].map(kpi => (
          <DashboardCard key={kpi.label}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
          </DashboardCard>
        ))}
      </div>

      <DashboardCard
        header={
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('proveedores.invoices.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('proveedores.invoices.subtitle')}</p>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t('proveedores.common.loading')}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Receipt className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">{t('proveedores.invoices.empty')}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t('proveedores.invoices.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => {
              const lineCount = inv.lines?.length ?? 0
              const isOpen = expandedId === inv.id
              return (
                <Collapsible
                  key={inv.id}
                  open={isOpen}
                  onOpenChange={open => setExpandedId(open ? inv.id : null)}
                >
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2">
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex-1 min-w-[140px]">
                        <div className="font-medium">{inv.invoice_number}</div>
                        {inv.quotation?.reference && (
                          <div className="text-xs text-muted-foreground">
                            {t('proveedores.invoices.fromQuote', { reference: inv.quotation.reference })}
                          </div>
                        )}
                      </div>
                      <div className="text-sm min-w-[120px]">
                        <div>{inv.supplier?.company_name ?? '—'}</div>
                        {inv.supplier?.tax_id && (
                          <div className="text-xs text-muted-foreground">{inv.supplier.tax_id}</div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(inv.issue_date).toLocaleDateString(dateLocale)}
                      </div>
                      <Badge variant="outline" className={invoiceStatusClass(inv.status)}>
                        {statusLabel(inv.status)}
                      </Badge>
                      <div className="text-sm font-medium ml-auto">
                        {formatMoney(inv.total_amount, inv.currency, dateLocale)}
                      </div>
                      <div className="flex gap-1">
                        {inv.file_storage_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewPdf(inv)}
                            title={t('proveedores.invoices.viewOrderPdf')}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            PDF
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {inv.status === 'issued' && (
                              <DropdownMenuItem onClick={() => updateStatus(inv.id, 'paid')}>
                                {t('proveedores.invoices.markPaid')}
                              </DropdownMenuItem>
                            )}
                            {inv.status === 'draft' && (
                              <DropdownMenuItem onClick={() => updateStatus(inv.id, 'issued')}>
                                {t('proveedores.invoices.markIssued')}
                              </DropdownMenuItem>
                            )}
                            {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => updateStatus(inv.id, 'cancelled')}
                              >
                                {t('proveedores.invoices.cancel')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="border-t border-border bg-muted/20 px-3 sm:px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          {t('proveedores.invoices.lineItems', { count: lineCount })}
                        </p>
                        {lineCount === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('proveedores.invoices.noLines')}</p>
                        ) : (
                          <div className="rounded-md border border-border overflow-x-auto bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t('proveedores.quotations.lines.description')}</TableHead>
                                  <TableHead className="text-right">{t('proveedores.quotations.lines.quantity')}</TableHead>
                                  <TableHead>{t('proveedores.quotations.lines.unit')}</TableHead>
                                  <TableHead className="text-right">{t('proveedores.quotations.lines.unitPrice')}</TableHead>
                                  <TableHead className="text-right">{t('proveedores.quotations.lines.lineTotal')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {inv.lines!.map(line => (
                                  <TableRow key={line.id}>
                                    <TableCell>{line.description}</TableCell>
                                    <TableCell className="text-right">{line.quantity}</TableCell>
                                    <TableCell>{line.unit}</TableCell>
                                    <TableCell className="text-right">
                                      {formatMoney(line.unit_price_net, inv.currency, dateLocale)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatMoney(line.line_total_net, inv.currency, dateLocale)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {inv.notes && (
                          <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap">{inv.notes}</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
