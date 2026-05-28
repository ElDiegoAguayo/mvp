'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { CreateUserDialog } from './create-user-dialog'

export function RegisterClientButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-lime-dark text-primary-foreground glow-lime-sm"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        Registrar Nuevo Cliente
      </Button>
      <CreateUserDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
