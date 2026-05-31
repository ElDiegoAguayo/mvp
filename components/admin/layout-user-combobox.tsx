'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { LayoutUserOption } from '@/app/admin/dashboard-layout-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function formatUserLabel(user: LayoutUserOption): string {
  const name = user.full_name?.trim()
  if (name) return `${name} (${user.email})`
  return user.email
}

function userSearchValue(user: LayoutUserOption): string {
  return [user.full_name, user.email, user.id].filter(Boolean).join(' ').toLowerCase()
}

type LayoutUserComboboxProps = {
  id?: string
  users: LayoutUserOption[]
  value: string
  onValueChange: (userId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function LayoutUserCombobox({
  id,
  users,
  value,
  onValueChange,
  placeholder = 'Buscar por nombre o email…',
  disabled = false,
  className,
}: LayoutUserComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedUser = useMemo(
    () => users.find((user) => user.id === value),
    [users, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || users.length === 0}
          className={cn('h-10 w-full justify-between font-normal', className)}
        >
          <span className="truncate text-left">
            {selectedUser ? formatUserLabel(selectedUser) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente…" />
          <CommandList>
            <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
            <CommandGroup className="max-h-[280px] overflow-y-auto">
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={userSearchValue(user)}
                  onSelect={() => {
                    onValueChange(user.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === user.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{formatUserLabel(user)}</span>
                  {user.parent_user_id ? (
                    <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                      Sub
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
