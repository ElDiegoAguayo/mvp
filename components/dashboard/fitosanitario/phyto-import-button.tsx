'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { importPhytoWorkbookAction } from '@/app/actions/fitosanitario-extended-actions'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/i18n/locale-provider'
import { FileSpreadsheet, Loader2 } from 'lucide-react'

export function PhytoImportButton({ onImported }: { onImported?: () => void }) {
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await importPhytoWorkbookAction(fd)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      const s = res.summary
      toast.success(
        t('fitosanitario.import.success', {
          warehouses: s.warehouses,
          products: s.products,
          movements: s.movements,
          invoices: s.invoices,
          programItems: s.programItems,
        }),
      )
      onImported?.()
    })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
        {t('fitosanitario.import.button')}
      </Button>
    </>
  )
}
