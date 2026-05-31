'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HardHat } from 'lucide-react'
import { CreateFieldInspectorDialog } from './create-field-inspector-dialog'

export function RegisterFieldInspectorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
      >
        <HardHat className="w-4 h-4 mr-2" />
        Crear inspector de campo
      </Button>
      <CreateFieldInspectorDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
