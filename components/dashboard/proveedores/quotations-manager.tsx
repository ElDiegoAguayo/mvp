'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  assignSupplierToQuotationsAction,
  deleteQuotationAction,
  getPurchaseInvoiceFileUrlAction,
  getQuotationDetailAction,
  getQuotationFileUrlAction,
  issuePurchaseInvoiceFromQuotationAction,
  listQuotationsAction,
  listSuppliersAction,
  updateQuotationAction,
  uploadQuotationAction,
} from '@/app/actions/proveedores-actions'
import {
  computeLineTotals,
  type QuotationLineInput,
  type SupplierCompany,
  type SupplierQuotation,
} from '@/lib/proveedores/types'
import { formatMoney, quotationStatusClass } from '@/lib/proveedores/format'
import { parseQuotationFile, resolveSubtotalFromParsed } from '@/lib/proveedores/parse-quotation-file'
import { DEFAULT_QUOTATION_TAX_RATE } from '@/lib/proveedores/parse-quotation-text'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'
import { isAllowedVaultUpload, VAULT_MAX_UPLOAD_BYTES } from '@/lib/vault-upload'
import {
  draftLineTotal,
  sumOrderDraftTotal,
  type PurchaseOrderLineDraft,
} from '@/lib/proveedores/purchase-order-lines'
import { findDuplicateQuotationByFile, hashFileContent } from '@/lib/proveedores/file-content-hash'
import Link from 'next/link'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatFormAmount(n: number, currency: string) {
  return currency === 'USD' ? String(Math.round(n * 100) / 100) : String(Math.round(n))
}

const emptyLine = (): QuotationLineInput => ({
  description: '',
  quantity: 1,
  unit: 'unit',
  unit_price_net: 0,
})

export function QuotationsManager() {
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'es-CL'
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([])
  const [suppliers, setSuppliers] = useState<SupplierCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkSupplierId, setBulkSupplierId] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<SupplierQuotation | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsingFile, setParsingFile] = useState(false)
  const [dialogDragOver, setDialogDragOver] = useState(false)
  const [pageDragOver, setPageDragOver] = useState(false)
  const pageDragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageFileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    supplier_id: '',
    reference: '',
    title: '',
    quote_date: todayISO(),
    tax_rate: '0',
    currency: 'CLP',
    subtotal_net: '',
    total_amount: '',
    notes: '',
  })
  const [lines, setLines] = useState<QuotationLineInput[]>([])
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    issue_date: todayISO(),
    due_date: '',
    notes: '',
  })
  const [orderLineDrafts, setOrderLineDrafts] = useState<PurchaseOrderLineDraft[]>([])
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [qRes, sRes] = await Promise.all([
      listQuotationsAction(),
      listSuppliersAction(),
    ])
    if (qRes.ok) setQuotations(qRes.data)
    else toast.error(qRes.message)
    if (sRes.ok) setSuppliers(sRes.data.filter(s => s.is_active))
    else if (!qRes.ok) toast.error(sRes.message)
    setLoading(false)
  }, [])

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === form.supplier_id) ?? null,
    [suppliers, form.supplier_id],
  )

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const validLines = lines.filter(l => l.description.trim())
    let amount = 0
    if (validLines.length > 0) {
      amount = computeLineTotals(validLines).subtotal_net
    } else if (form.total_amount) {
      amount = Number(form.total_amount) || 0
    } else if (form.subtotal_net) {
      amount = Number(form.subtotal_net) || 0
    }
    return { amount }
  }, [lines, form.subtotal_net, form.total_amount])

  useEffect(() => {
    const validLines = lines.filter(l => l.description.trim())
    const currency = form.currency
    const amount = validLines.length > 0
      ? computeLineTotals(validLines).subtotal_net
      : Number(form.total_amount) || Number(form.subtotal_net) || 0

    if (amount <= 0) return

    const formatted = formatFormAmount(amount, currency)
    setForm(f => {
      if (f.subtotal_net === formatted && f.total_amount === formatted) return f
      return { ...f, subtotal_net: formatted, total_amount: formatted, tax_rate: '0' }
    })
  }, [lines, form.currency, form.subtotal_net, form.total_amount])

  const resetUploadForm = () => {
    setEditingId(null)
    setEditingFileName(null)
    setForm({
      supplier_id: '',
      reference: '',
      title: '',
      quote_date: todayISO(),
      tax_rate: '0',
      currency: 'CLP',
      subtotal_net: '',
      total_amount: '',
      notes: '',
    })
    setLines([])
    setFile(null)
  }

  const openUpload = () => {
    resetUploadForm()
    setUploadOpen(true)
  }

  const openEdit = (q: SupplierQuotation) => {
    setEditingId(q.id)
    setEditingFileName(q.file_name)
    setFile(null)
    setUploadOpen(true)
    void (async () => {
      const res = await getQuotationDetailAction(q.id)
      if (!res.ok) {
        toast.error(res.message)
        setUploadOpen(false)
        setEditingId(null)
        return
      }
      const d = res.data
      const realLines = d.lines.filter(l => l.id !== '__quote_total__')
      const amount = d.total_amount || d.subtotal_net
      const formatted = amount > 0 ? formatFormAmount(amount, d.currency) : ''
      setForm({
        supplier_id: d.supplier_id ?? '',
        reference: d.reference,
        title: d.title,
        quote_date: d.quote_date,
        tax_rate: '0',
        currency: d.currency,
        subtotal_net: formatted,
        total_amount: formatted,
        notes: d.notes,
      })
      setLines(
        realLines.length > 0
          ? realLines.map(l => ({
              description: l.description,
              quantity: l.quantity,
              unit: l.unit,
              unit_price_net: l.unit_price_net,
            }))
          : [],
      )
    })()
  }

  const applyParsedFile = async (f: File) => {
    setParsingFile(true)
    try {
      const parsed = await parseQuotationFile(f)
      const currency = parsed.currency ?? 'CLP'
      const taxRate = DEFAULT_QUOTATION_TAX_RATE
      const amount = resolveSubtotalFromParsed(parsed, taxRate, parsed.lines)
      const formatted = amount > 0 ? formatFormAmount(amount, currency) : ''

      setForm(prev => ({
        ...prev,
        reference: parsed.reference ?? prev.reference,
        title: parsed.reference ?? prev.title,
        quote_date: parsed.quoteDate ?? prev.quote_date,
        currency,
        notes: parsed.notes ?? prev.notes,
        tax_rate: '0',
        subtotal_net: formatted || prev.subtotal_net,
        total_amount: formatted || prev.total_amount,
      }))
      if (parsed.lines.length > 0) {
        setLines(parsed.lines)
        toast.success(t('proveedores.quotations.linesDetected', { count: parsed.lines.length }))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('proveedores.quotations.parsing'))
    } finally {
      setParsingFile(false)
    }
  }

  const handleFile = async (f: File | null) => {
    if (!f) return
    if (!isAllowedVaultUpload({ name: f.name, type: f.type })) {
      toast.error('File type not allowed')
      return
    }
    if (f.size > VAULT_MAX_UPLOAD_BYTES) {
      toast.error('File exceeds 10 MB limit')
      return
    }

    const fileHash = await hashFileContent(f)
    const duplicate = findDuplicateQuotationByFile(
      f,
      fileHash,
      quotations.filter(q => q.id !== editingId),
    )
    if (duplicate) {
      toast.error(t('proveedores.quotations.duplicateFile', { reference: duplicate.reference }))
      return
    }

    setFile(f)
    await applyParsedFile(f)
  }

  const startUploadWithFile = async (f: File | null) => {
    if (!f) return
    resetUploadForm()
    setUploadOpen(true)
    await handleFile(f)
  }

  const isFileDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file')

  const handlePageDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    pageDragDepthRef.current += 1
    setPageDragOver(true)
  }

  const handlePageDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    pageDragDepthRef.current = Math.max(0, pageDragDepthRef.current - 1)
    if (pageDragDepthRef.current === 0) setPageDragOver(false)
  }

  const handlePageDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handlePageDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    pageDragDepthRef.current = 0
    setPageDragOver(false)
    void startUploadWithFile(e.dataTransfer.files[0] ?? null)
  }

  const handleUpload = () => {
    if (!file) {
      toast.error(t('proveedores.quotations.fileRequired'))
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      if (form.supplier_id) fd.set('supplier_id', form.supplier_id)
      if (form.reference.trim()) fd.set('reference', form.reference.trim())
      fd.set('title', form.title || form.reference || selectedSupplier?.company_name || '')
      fd.set('quote_date', form.quote_date)
      fd.set('tax_rate', '0')
      fd.set('currency', form.currency)
      fd.set('notes', form.notes)
      fd.set('status', 'accepted')
      const validLines = lines.filter(l => l.description.trim())
      if (validLines.length > 0) {
        fd.set('lines_json', JSON.stringify(validLines))
      } else {
        fd.set('subtotal_net', String(totals.amount))
        fd.set('total_amount', String(totals.amount))
      }
      fd.set('file', file)

      const res = await uploadQuotationAction(fd)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('proveedores.quotations.saved'))
      setUploadOpen(false)
      await load()
    })
  }

  const handleUpdate = () => {
    if (!editingId) return
    const validLines = lines.filter(l => l.description.trim())
    startTransition(async () => {
      const res = await updateQuotationAction({
        id: editingId,
        supplier_id: form.supplier_id || null,
        reference: form.reference.trim(),
        title: form.title || form.reference || selectedSupplier?.company_name || '',
        quote_date: form.quote_date,
        currency: form.currency,
        notes: form.notes,
        lines: validLines.length > 0 ? validLines : undefined,
        subtotal_net: totals.amount,
        total_amount: totals.amount,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('proveedores.quotations.updated'))
      setUploadOpen(false)
      resetUploadForm()
      await load()
    })
  }

  const handleSave = () => {
    if (editingId) handleUpdate()
    else handleUpload()
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('proveedores.quotations.deleteConfirm'))) return
    startTransition(async () => {
      const res = await deleteQuotationAction(id)
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      toast.success(t('proveedores.quotations.deleted'))
      await load()
    })
  }

  const openInvoice = (q: SupplierQuotation) => {
    setSelectedQuote(q)
    setInvoiceForm({
      invoice_number: '',
      issue_date: todayISO(),
      due_date: '',
      notes: q.notes ?? '',
    })
    setOrderLineDrafts([])
    setLoadingInvoiceDetail(true)
    setInvoiceOpen(true)
    void (async () => {
      const res = await getQuotationDetailAction(q.id)
      if (!res.ok) {
        toast.error(res.message)
        setInvoiceOpen(false)
        setLoadingInvoiceDetail(false)
        return
      }
      setOrderLineDrafts(
        res.data.lines.map(l => ({
          id: l.id,
          description: l.description,
          quotedQuantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unit_price_net,
          orderQuantity: l.quantity > 0 ? l.quantity : 1,
          selected: true,
        })),
      )
      setLoadingInvoiceDetail(false)
    })()
  }

  const invoiceSelectedTotal = useMemo(
    () => sumOrderDraftTotal(orderLineDrafts),
    [orderLineDrafts],
  )

  const updateOrderQuantity = (id: string, raw: string) => {
    const parsed = raw === '' ? 0 : Number(raw)
    if (Number.isNaN(parsed) || parsed < 0) return
    setOrderLineDrafts(prev =>
      prev.map(l => {
        if (l.id !== id) return l
        const orderQuantity = Math.round(parsed * 10000) / 10000
        return { ...l, orderQuantity, selected: orderQuantity > 0 ? true : l.selected }
      }),
    )
  }

  const toggleOrderLine = (id: string, checked: boolean) => {
    setOrderLineDrafts(prev =>
      prev.map(l => {
        if (l.id !== id) return l
        if (!checked) {
          return { ...l, selected: false, orderQuantity: 0 }
        }
        const orderQuantity = l.orderQuantity > 0 ? l.orderQuantity : (l.quotedQuantity > 0 ? l.quotedQuantity : 1)
        return { ...l, selected: true, orderQuantity }
      }),
    )
  }

  const toggleAllOrderLines = (checked: boolean) => {
    setOrderLineDrafts(prev =>
      prev.map(l => {
        if (!checked) return { ...l, selected: false, orderQuantity: 0 }
        const orderQuantity = l.orderQuantity > 0 ? l.orderQuantity : (l.quotedQuantity > 0 ? l.quotedQuantity : 1)
        return { ...l, selected: true, orderQuantity }
      }),
    )
  }

  const fillAllOrderQuantities = () => {
    setOrderLineDrafts(prev =>
      prev.map(l => ({
        ...l,
        selected: true,
        orderQuantity: l.quotedQuantity > 0 ? l.quotedQuantity : 1,
      })),
    )
  }

  const clearAllOrderQuantities = () => {
    setOrderLineDrafts(prev => prev.map(l => ({ ...l, selected: false, orderQuantity: 0 })))
  }

  const handleIssueInvoice = () => {
    if (!selectedQuote) return
    if (!invoiceForm.invoice_number.trim()) {
      toast.error(t('proveedores.common.required'))
      return
    }
    const lineItems = orderLineDrafts
      .filter(l => l.selected && l.orderQuantity > 0 && l.id !== '__quote_total__')
      .map(l => ({ line_id: l.id, quantity: l.orderQuantity }))

    const hasDbLines = orderLineDrafts.some(l => l.id !== '__quote_total__')
    if (hasDbLines && lineItems.length === 0) {
      toast.error(t('proveedores.invoices.qtyRequired'))
      return
    }
    startTransition(async () => {
      const res = await issuePurchaseInvoiceFromQuotationAction({
        quotation_id: selectedQuote.id,
        invoice_number: invoiceForm.invoice_number,
        issue_date: invoiceForm.issue_date,
        due_date: invoiceForm.due_date || null,
        notes: invoiceForm.notes,
        line_items: hasDbLines ? lineItems : undefined,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('proveedores.invoices.issued'))
      setInvoiceOpen(false)
      await load()
      const pdf = await getPurchaseInvoiceFileUrlAction(res.id)
      if (pdf.ok) window.open(pdf.url, '_blank', 'noopener,noreferrer')
    })
  }

  const viewFile = (id: string) => {
    startTransition(async () => {
      const res = await getQuotationFileUrlAction(id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? quotations.map(q => q.id) : [])
  }

  const handleBulkAssign = () => {
    if (!bulkSupplierId) {
      toast.error(t('proveedores.quotations.supplierRequired'))
      return
    }
    startTransition(async () => {
      const res = await assignSupplierToQuotationsAction({
        quotation_ids: selectedIds,
        supplier_id: bulkSupplierId,
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(t('proveedores.quotations.supplierAssigned', { count: res.updated }))
      setAssignOpen(false)
      setBulkSupplierId('')
      setSelectedIds([])
      await load()
    })
  }

  const openBulkAssign = () => {
    if (selectedIds.length === 0) {
      toast.error(t('proveedores.quotations.selectQuotationsFirst'))
      return
    }
    setBulkSupplierId('')
    setAssignOpen(true)
  }

  const statusLabel = (status: SupplierQuotation['status']) =>
    t(`proveedores.quotations.statuses.${status}` as 'proveedores.quotations.statuses.pending')

  const isEditing = editingId != null

  const hasDetectedData = !!(form.subtotal_net || form.total_amount || lines.length > 0 || form.notes)

  const dropZoneClasses = (active: boolean) =>
    cn(
      'border-2 border-dashed rounded-xl p-5 sm:p-6 text-center transition-all cursor-pointer',
      active ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
      parsingFile && 'pointer-events-none opacity-70',
    )

  return (
    <div
      className="relative"
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {pageDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-[2px] pointer-events-none">
          <div className="mx-4 max-w-lg w-full rounded-2xl border-2 border-dashed border-primary bg-card/95 px-8 py-10 text-center shadow-lg">
            <UploadCloud className="w-12 h-12 mx-auto text-primary mb-3" />
            <p className="text-lg font-semibold text-foreground">{t('proveedores.quotations.dropZoneOverlay')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('proveedores.quotations.fileHint')}</p>
          </div>
        </div>
      )}

      <DashboardCard
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('proveedores.quotations.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('proveedores.quotations.subtitle')}</p>
            </div>
            <Button onClick={openUpload}>
              <UploadCloud className="w-4 h-4 mr-2" />
              {t('proveedores.quotations.upload')}
            </Button>
          </div>
        }
      >
        {!loading && (
          <div
            className={dropZoneClasses(pageDragOver)}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPageDragOver(true) }}
            onDrop={e => {
              e.preventDefault()
              e.stopPropagation()
              pageDragDepthRef.current = 0
              setPageDragOver(false)
              void startUploadWithFile(e.dataTransfer.files[0] ?? null)
            }}
            onClick={() => pageFileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') pageFileInputRef.current?.click()
            }}
          >
            <input
              ref={pageFileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
              onChange={e => void startUploadWithFile(e.target.files?.[0] ?? null)}
            />
            {parsingFile ? (
              <Loader2 className="w-9 h-9 mx-auto text-primary animate-spin mb-2" />
            ) : (
              <UploadCloud className="w-9 h-9 mx-auto text-primary mb-2" />
            )}
            <p className="text-sm font-medium text-foreground">{t('proveedores.quotations.dropZonePage')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('proveedores.quotations.dropZonePageHint')}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t('proveedores.common.loading')}
          </div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">{t('proveedores.quotations.empty')}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t('proveedores.quotations.emptyHint')}</p>
          </div>
        ) : (
          <>
            {selectedIds.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  {t('proveedores.quotations.selectedCount', { count: selectedIds.length })}
                </span>
                <Button size="sm" variant="default" onClick={openBulkAssign} disabled={isPending || suppliers.length === 0}>
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('proveedores.quotations.assignSupplier')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  {t('proveedores.quotations.clearSelection')}
                </Button>
              </div>
            )}
          <div className="rounded-lg border border-border overflow-x-auto mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={quotations.length > 0 && selectedIds.length === quotations.length}
                      onCheckedChange={checked => toggleSelectAll(checked === true)}
                      aria-label={t('proveedores.quotations.selectAll')}
                    />
                  </TableHead>
                  <TableHead>{t('proveedores.quotations.fields.reference')}</TableHead>
                  <TableHead>{t('proveedores.quotations.fields.supplier')}</TableHead>
                  <TableHead>{t('proveedores.quotations.fields.quoteDate')}</TableHead>
                  <TableHead>{t('proveedores.quotations.fields.status')}</TableHead>
                  <TableHead className="text-right">{t('proveedores.common.total')}</TableHead>
                  <TableHead className="text-right">{t('proveedores.common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map(q => (
                  <TableRow key={q.id} data-state={selectedIds.includes(q.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(q.id)}
                        onCheckedChange={checked => toggleSelected(q.id, checked === true)}
                        aria-label={q.reference}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{q.reference}</div>
                      {q.title && q.title !== q.reference && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{q.title}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {q.supplier?.company_name ? (
                        <>
                          <div>{q.supplier.company_name}</div>
                          {q.supplier.tax_id && (
                            <div className="text-xs text-muted-foreground">{q.supplier.tax_id}</div>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                          {t('proveedores.quotations.unassignedSupplier')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(q.quote_date).toLocaleDateString(dateLocale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {q.has_invoice && (
                          <Badge variant="secondary">{t('proveedores.quotations.hasInvoice')}</Badge>
                        )}
                        {!q.has_invoice && q.status !== 'accepted' && (
                          <Badge variant="outline" className={quotationStatusClass(q.status)}>
                            {statusLabel(q.status)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(q.total_amount, q.currency, dateLocale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {q.file_storage_path && (
                          <Button variant="ghost" size="icon" onClick={() => viewFile(q.id)} title={t('proveedores.quotations.viewFile')}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(q)}
                          disabled={isPending}
                          title={t('proveedores.quotations.edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {q.supplier_id && (
                          <Button variant="outline" size="sm" onClick={() => openInvoice(q)}>
                            <Receipt className="w-3.5 h-3.5 mr-1.5" />
                            {t('proveedores.quotations.issueInvoice')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(q.id)}
                          disabled={isPending || q.has_invoice}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </DashboardCard>

      <Dialog open={uploadOpen} onOpenChange={open => { setUploadOpen(open); if (!open) resetUploadForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('proveedores.quotations.editTitle') : t('proveedores.quotations.upload')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('proveedores.quotations.fields.supplierOptional')}</Label>
              {suppliers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm">
                  <p className="text-muted-foreground">{t('proveedores.quotations.noSuppliersHint')}</p>
                  <Button variant="link" className="h-auto p-0 mt-2" asChild>
                    <Link href="/dashboard/proveedores/empresas">{t('proveedores.quotations.goToSuppliers')}</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Select
                    value={form.supplier_id || undefined}
                    onValueChange={value => setForm(f => ({ ...f, supplier_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('proveedores.quotations.selectSupplierOptional')} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.company_name}
                          {s.tax_id ? ` · ${s.tax_id}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('proveedores.quotations.supplierOptionalHint')}</p>
                </>
              )}
            </div>

            {isEditing ? (
              editingFileName ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate">{editingFileName}</span>
                  {editingId && (
                    <Button type="button" variant="link" className="h-auto p-0 shrink-0" onClick={() => viewFile(editingId)}>
                      {t('proveedores.quotations.viewFile')}
                    </Button>
                  )}
                </div>
              ) : null
            ) : (
            <div
              className={dropZoneClasses(dialogDragOver)}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDialogDragOver(true) }}
              onDragLeave={() => setDialogDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                setDialogDragOver(false)
                void handleFile(e.dataTransfer.files[0] ?? null)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                onChange={e => void handleFile(e.target.files?.[0] ?? null)}
              />
              {parsingFile ? (
                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
              ) : (
                <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              )}
              <p className="text-sm font-medium">
                {parsingFile ? t('proveedores.quotations.parsing') : t('proveedores.quotations.dropFile')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('proveedores.quotations.fileHint')}</p>
              {file && (
                <p className="text-sm text-primary mt-3 font-medium">{file.name}</p>
              )}
            </div>
            )}

            {hasDetectedData && !isEditing && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{t('proveedores.quotations.autoDetected')}</span>
              </div>
            )}

            <div className="grid gap-2">
              <Label>{t('proveedores.quotations.fields.reference')}</Label>
              <Input
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="COT-001"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>{t('proveedores.quotations.amountTotal')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.total_amount}
                  onChange={e => setForm(f => ({ ...f, total_amount: e.target.value, subtotal_net: e.target.value }))}
                  readOnly={lines.some(l => l.description.trim())}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('proveedores.quotations.fields.currency')}</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="grid gap-2 max-w-xs">
              <Label>{t('proveedores.quotations.fields.quoteDate')}</Label>
              <Input type="date" value={form.quote_date} onChange={e => setForm(f => ({ ...f, quote_date: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t('proveedores.quotations.amountHint')}</p>

            {(totals.amount > 0 || lines.length > 0) && (
              <div className="flex justify-end text-sm rounded-lg bg-muted/40 border border-border px-3 py-2">
                <span className="font-semibold">{t('proveedores.common.total')}: {formatMoney(totals.amount, form.currency, dateLocale)}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('proveedores.quotations.lines.title')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines(l => [...l, emptyLine()])}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t('proveedores.quotations.lines.add')}
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder={t('proveedores.quotations.lines.description')}
                      value={line.description}
                      onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('proveedores.quotations.lines.quantity')}
                      value={line.quantity || ''}
                      onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: Number(e.target.value) } : l))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder={t('proveedores.quotations.lines.unit')}
                      value={line.unit}
                      onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('proveedores.quotations.lines.unitPrice')}
                      value={line.unit_price_net || ''}
                      onChange={e => setLines(prev => prev.map((l, i) => i === idx ? { ...l, unit_price_net: Number(e.target.value) } : l))}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2">
              <Label>{t('proveedores.quotations.commercialConditions')} / {t('proveedores.quotations.fields.notes')}</Label>
              <Textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetUploadForm() }}>{t('proveedores.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={isPending || parsingFile || (!isEditing && !file)}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isEditing ? null : <UploadCloud className="w-4 h-4 mr-2" />}
              {isPending ? t('proveedores.common.saving') : isEditing ? t('proveedores.common.save') : t('proveedores.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('proveedores.quotations.assignSupplierTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('proveedores.quotations.assignSupplierDesc', { count: selectedIds.length })}
          </p>
          <div className="grid gap-2 py-2">
            <Label>{t('proveedores.quotations.fields.supplier')} *</Label>
            <Select value={bulkSupplierId || undefined} onValueChange={setBulkSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder={t('proveedores.quotations.selectSupplier')} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.company_name}
                    {s.tax_id ? ` · ${s.tax_id}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{t('proveedores.common.cancel')}</Button>
            <Button onClick={handleBulkAssign} disabled={isPending || !bulkSupplierId}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('proveedores.quotations.assignSupplier')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] sm:max-w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('proveedores.invoices.issueTitle')}</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm mb-2">
              <p className="font-medium">{selectedQuote.supplier?.company_name}</p>
              <p className="text-muted-foreground">{selectedQuote.reference} · {selectedQuote.currency}</p>
            </div>
          )}

          {loadingInvoiceDetail ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('proveedores.common.loading')}
            </div>
          ) : (
            <>
              {orderLineDrafts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>{t('proveedores.invoices.selectLines')}</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={fillAllOrderQuantities}>
                        {t('proveedores.invoices.fillAllQty')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearAllOrderQuantities}>
                        {t('proveedores.invoices.clearAllQty')}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border overflow-x-auto max-h-80">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={orderLineDrafts.length > 0 && orderLineDrafts.every(l => l.selected)}
                              onCheckedChange={checked => toggleAllOrderLines(checked === true)}
                              aria-label={t('proveedores.quotations.selectAll')}
                            />
                          </TableHead>
                          <TableHead className="min-w-[200px]">{t('proveedores.quotations.lines.description')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap min-w-[100px]">{t('proveedores.invoices.quotedQty')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap min-w-[110px]">{t('proveedores.quotations.lines.unitPrice')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap min-w-[140px]">{t('proveedores.invoices.purchaseQty')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap min-w-[100px]">{t('proveedores.quotations.lines.lineTotal')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderLineDrafts.map(line => {
                          const lineTotal = draftLineTotal(line)
                          const currency = selectedQuote?.currency ?? 'CLP'
                          return (
                            <TableRow key={line.id} className={!line.selected ? 'opacity-50' : undefined}>
                              <TableCell>
                                <Checkbox
                                  checked={line.selected}
                                  onCheckedChange={checked => toggleOrderLine(line.id, checked === true)}
                                  aria-label={line.description}
                                />
                              </TableCell>
                              <TableCell>
                                <span className="text-sm leading-snug">{line.description}</span>
                              </TableCell>
                              <TableCell className="text-right text-sm whitespace-nowrap tabular-nums">
                                {line.quotedQuantity.toLocaleString(dateLocale)} {line.unit}
                              </TableCell>
                              <TableCell className="text-right text-sm whitespace-nowrap tabular-nums">
                                {formatMoney(line.unitPrice, currency, dateLocale)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="h-9 w-28 text-right"
                                    value={line.selected ? (line.orderQuantity || '') : ''}
                                    disabled={!line.selected}
                                    onChange={e => updateOrderQuantity(line.id, e.target.value)}
                                  />
                                  <span className="text-xs text-muted-foreground min-w-[2.5rem]">{line.unit}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                                {line.selected && line.orderQuantity > 0
                                  ? formatMoney(lineTotal, currency, dateLocale)
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{t('proveedores.invoices.orderTotal')}</span>
                    <span className="text-lg font-bold text-foreground">
                      {formatMoney(invoiceSelectedTotal, selectedQuote?.currency ?? 'CLP', dateLocale)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('proveedores.invoices.selectLinesHint')}</p>
                </div>
              )}

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>{t('proveedores.invoices.fields.orderNumber')} *</Label>
                  <Input
                    value={invoiceForm.invoice_number}
                    onChange={e => setInvoiceForm(f => ({ ...f, invoice_number: e.target.value }))}
                    placeholder={t('proveedores.invoices.orderNumberPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('proveedores.invoices.fields.issueDate')}</Label>
                    <Input type="date" value={invoiceForm.issue_date} onChange={e => setInvoiceForm(f => ({ ...f, issue_date: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('proveedores.invoices.fields.dueDate')}</Label>
                    <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t('proveedores.invoices.fields.notes')}</Label>
                  <Textarea rows={3} value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>{t('proveedores.common.cancel')}</Button>
            <Button onClick={handleIssueInvoice} disabled={isPending || loadingInvoiceDetail}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('proveedores.invoices.generateOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
