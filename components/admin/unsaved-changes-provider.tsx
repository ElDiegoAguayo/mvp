'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type UnsavedChangesContextValue = {
  hasUnsaved: boolean
  setDirty: (key: string, dirty: boolean) => void
  confirmNavigation: (
    action: () => void,
    options?: { message?: string; when?: boolean },
  ) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null)

export function AdminUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMessage, setDialogMessage] = useState('')
  const pendingActionRef = useRef<(() => void) | null>(null)

  const hasUnsaved = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap],
  )

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyMap((prev) => {
      if (!dirty && !prev[key]) return prev
      if (dirty && prev[key]) return prev
      const next = { ...prev }
      if (dirty) next[key] = true
      else delete next[key]
      return next
    })
  }, [])

  const confirmNavigation = useCallback(
    (action: () => void, options?: { message?: string; when?: boolean }) => {
      const shouldConfirm = options?.when ?? hasUnsaved
      if (!shouldConfirm) {
        action()
        return
      }
      pendingActionRef.current = action
      setDialogMessage(
        options?.message ??
          'Tienes cambios sin guardar en el layout de Inicio. Si sales ahora, se perderán.',
      )
      setDialogOpen(true)
    },
    [hasUnsaved],
  )

  const handleDiscard = () => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setDialogOpen(false)
    action?.()
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsaved])

  const value = useMemo(
    () => ({ hasUnsaved, setDirty, confirmNavigation }),
    [hasUnsaved, setDirty, confirmNavigation],
  )

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                pendingActionRef.current = null
              }}
            >
              Seguir editando
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                handleDiscard()
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  )
}

export function useAdminUnsavedChanges(key: string, isDirty: boolean) {
  const ctx = useContext(UnsavedChangesContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setDirty(key, isDirty)
    return () => ctx.setDirty(key, false)
  }, [ctx, key, isDirty])
}

export function useAdminNavigationGuard() {
  const ctx = useContext(UnsavedChangesContext)
  return (
    action: () => void,
    options?: { message?: string; when?: boolean },
  ) => {
    if (ctx) ctx.confirmNavigation(action, options)
    else action()
  }
}
