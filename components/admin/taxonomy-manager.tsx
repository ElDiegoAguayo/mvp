'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  KeyboardEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ListTree,
  Download,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  obtenerTaxonomiaCompleta,
  guardarNiveles,
  crearOpcion,
  actualizarOpcion,
  eliminarOpcion,
  importarOpcionesDefault,
  type Nivel,
  type OpcionNivel,
} from '@/app/actions/taxonomy'

// ─────────────────────────────────────────────────────────────────────────────
// Option chip
// ─────────────────────────────────────────────────────────────────────────────

interface OptionChipProps {
  option: OpcionNivel
  clienteId: string
  onUpdated: (updated: OpcionNivel) => void
  onDeleted: (id: string) => void
}

function OptionChip({ option, clienteId, onUpdated, onDeleted }: OptionChipProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(option.opcion_texto)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const saveEdit = async () => {
    if (!draft.trim() || draft.trim() === option.opcion_texto) {
      setEditing(false)
      setDraft(option.opcion_texto)
      return
    }
    setBusy(true)
    const res = await actualizarOpcion(option.id, clienteId, draft.trim(), option.activo, option.orden)
    setBusy(false)
    if (res.ok) {
      onUpdated({ ...option, opcion_texto: draft.trim() })
      setEditing(false)
    } else {
      toast.error(res.message)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') { setEditing(false); setDraft(option.opcion_texto) }
  }

  const handleDelete = async () => {
    setBusy(true)
    const res = await eliminarOpcion(option.id, clienteId)
    setBusy(false)
    if (res.ok) onDeleted(option.id)
    else toast.error(res.message)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-1.5 py-0.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-xs font-medium text-foreground outline-none w-28 min-w-0"
        />
        {busy ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <>
            <button onClick={saveEdit} className="text-emerald-500 hover:text-emerald-400 shrink-0">
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(option.opcion_texto) }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        )}
      </span>
    )
  }

  return (
    <span
      className={`group inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
        option.activo
          ? 'border-border bg-secondary/60 text-foreground hover:border-primary/40 hover:bg-secondary'
          : 'border-dashed border-border bg-transparent text-muted-foreground/50'
      }`}
    >
      <GripVertical className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0" />
      <span>{option.opcion_texto}</span>
      <button
        onClick={() => { setEditing(true); setDraft(option.opcion_texto) }}
        className="ml-0.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
      >
        <Pencil className="w-2.5 h-2.5" />
      </button>
      <button
        onClick={handleDelete}
        disabled={busy}
        className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
      >
        {busy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <X className="w-2.5 h-2.5" />}
      </button>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Add option inline input
// ─────────────────────────────────────────────────────────────────────────────

interface AddOptionInputProps {
  clienteId: string
  nivelNumero: number
  existingCount: number
  onAdded: (option: OpcionNivel) => void
}

function AddOptionInput({ clienteId, nivelNumero, existingCount, onAdded }: AddOptionInputProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const save = async () => {
    if (!text.trim()) return
    setBusy(true)
    const res = await crearOpcion(clienteId, nivelNumero, text.trim(), existingCount)
    setBusy(false)
    if (res.ok && res.id) {
      onAdded({
        id: res.id,
        nivel_numero: nivelNumero,
        opcion_texto: text.trim(),
        activo: true,
        orden: existingCount,
      })
      setText('')
      inputRef.current?.focus()
    } else {
      toast.error(res.message)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setOpen(false); setText('') }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus className="w-3 h-3" />
        Añadir opción
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/5 px-2 py-1">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe y presiona Enter…"
        className="bg-transparent text-xs text-foreground outline-none w-44 min-w-0 placeholder:text-muted-foreground/50"
      />
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
      ) : (
        <>
          <button onClick={save} className="text-emerald-500 hover:text-emerald-400 shrink-0" disabled={!text.trim()}>
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={() => { setOpen(false); setText('') }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Level section
// ─────────────────────────────────────────────────────────────────────────────

interface LevelSectionProps {
  nivel: Nivel
  options: OpcionNivel[]
  clienteId: string
  onRename: (numero: number, newLabel: string) => void
  onDelete: (numero: number) => void
  onOptionAdded: (option: OpcionNivel) => void
  onOptionUpdated: (updated: OpcionNivel) => void
  onOptionDeleted: (id: string, nivelNumero: number) => void
  onImportDefault: (nivelNumero: number) => void
  importing: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: (numero: number) => void
  onMoveDown: (numero: number) => void
}

function LevelSection({
  nivel,
  options,
  clienteId,
  onRename,
  onDelete,
  onOptionAdded,
  onOptionUpdated,
  onOptionDeleted,
  onImportDefault,
  importing,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: LevelSectionProps) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(nivel.label)
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingLabel) labelInputRef.current?.focus()
  }, [editingLabel])

  const saveLabel = () => {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== nivel.label) onRename(nivel.numero, trimmed)
    setEditingLabel(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Level header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {/* Move up/down */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={() => onMoveUp(nivel.numero)}
              disabled={isFirst}
              className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => onMoveDown(nivel.numero)}
              disabled={isLast}
              className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Level badge */}
          <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
            N{nivel.numero}
          </span>

          {/* Label editable */}
          {editingLabel ? (
            <input
              ref={labelInputRef}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setEditingLabel(false); setLabelDraft(nivel.label) } }}
              className="bg-transparent border-b border-primary text-sm font-semibold text-foreground outline-none w-36 min-w-0"
            />
          ) : (
            <button
              onClick={() => { setEditingLabel(true); setLabelDraft(nivel.label) }}
              className="flex items-center gap-1.5 group text-left"
            >
              <span className="text-sm font-semibold text-foreground">{nivel.label}</span>
              <Pencil className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          <span className="text-[11px] text-muted-foreground ml-1">
            {options.length} {options.length === 1 ? 'opción' : 'opciones'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {options.length === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              onClick={() => onImportDefault(nivel.numero)}
              disabled={importing}
            >
              {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Opciones por defecto
            </Button>
          )}
          <button
            onClick={() => onDelete(nivel.numero)}
            className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded"
            title="Eliminar nivel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Options area */}
      <div className="px-4 py-3 flex flex-wrap gap-2 min-h-[52px]">
        {options.map((opt) => (
          <OptionChip
            key={opt.id}
            option={opt}
            clienteId={clienteId}
            onUpdated={onOptionUpdated}
            onDeleted={(id) => onOptionDeleted(id, nivel.numero)}
          />
        ))}
        <AddOptionInput
          clienteId={clienteId}
          nivelNumero={nivel.numero}
          existingCount={options.length}
          onAdded={onOptionAdded}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface TaxonomyManagerProps {
  clienteId: string
}

export function TaxonomyManager({ clienteId }: TaxonomyManagerProps) {
  const [loading, setLoading] = useState(true)
  const [niveles, setNiveles] = useState<Nivel[]>([])
  const [opciones, setOpciones] = useState<Record<number, OpcionNivel[]>>({})
  const [importing, setImporting] = useState<number | null>(null)
  const [savingNiveles, setSavingNiveles] = useState(false)

  const [deleteState, setDeleteState] = useState<{ open: boolean; numero: number | null }>({
    open: false,
    numero: null,
  })

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res = await obtenerTaxonomiaCompleta(clienteId)
    setLoading(false)
    if (res.ok) {
      setNiveles(res.config.niveles)
      setOpciones(res.opciones)
    } else {
      toast.error(res.message ?? 'Error al cargar taxonomía.')
    }
  }, [clienteId])

  useEffect(() => { load() }, [load])

  // ── Persist niveles helper ───────────────────────────────────────────────

  const persistNiveles = useCallback(async (newNiveles: Nivel[]) => {
    setSavingNiveles(true)
    const res = await guardarNiveles(clienteId, newNiveles)
    setSavingNiveles(false)
    if (!res.ok) { toast.error(res.message); return false }
    return true
  }, [clienteId])

  // ── Add level ────────────────────────────────────────────────────────────

  const handleAddLevel = async () => {
    const maxNum = niveles.reduce((m, n) => Math.max(m, n.numero), 0)
    const newNivel: Nivel = { numero: maxNum + 1, label: `Nivel ${maxNum + 1}` }
    const updated = [...niveles, newNivel]
    setNiveles(updated)
    await persistNiveles(updated)
  }

  // ── Rename level ─────────────────────────────────────────────────────────

  const handleRenameLevel = async (numero: number, newLabel: string) => {
    const updated = niveles.map((n) => n.numero === numero ? { ...n, label: newLabel } : n)
    setNiveles(updated)
    const ok = await persistNiveles(updated)
    if (ok) toast.success('Nivel renombrado.')
  }

  // ── Delete level ─────────────────────────────────────────────────────────

  const handleDeleteLevelConfirm = async () => {
    const numero = deleteState.numero
    if (numero == null) return
    setDeleteState({ open: false, numero: null })

    const updated = niveles.filter((n) => n.numero !== numero)
    if (updated.length === 0) { toast.error('Debe quedar al menos un nivel.'); return }
    setNiveles(updated)
    setOpciones((prev) => { const next = { ...prev }; delete next[numero]; return next })
    await persistNiveles(updated)
    toast.success('Nivel eliminado.')
  }

  // ── Move level up/down ───────────────────────────────────────────────────

  const handleMove = async (numero: number, direction: 'up' | 'down') => {
    const idx = niveles.findIndex((n) => n.numero === numero)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= niveles.length) return

    const updated = [...niveles]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    setNiveles(updated)
    await persistNiveles(updated)
  }

  // ── Option events ────────────────────────────────────────────────────────

  const handleOptionAdded = useCallback((option: OpcionNivel) => {
    setOpciones((prev) => ({
      ...prev,
      [option.nivel_numero]: [...(prev[option.nivel_numero] ?? []), option],
    }))
  }, [])

  const handleOptionUpdated = useCallback((updated: OpcionNivel) => {
    setOpciones((prev) => ({
      ...prev,
      [updated.nivel_numero]: (prev[updated.nivel_numero] ?? []).map((o) =>
        o.id === updated.id ? updated : o,
      ),
    }))
  }, [])

  const handleOptionDeleted = useCallback((id: string, nivelNumero: number) => {
    setOpciones((prev) => ({
      ...prev,
      [nivelNumero]: (prev[nivelNumero] ?? []).filter((o) => o.id !== id),
    }))
  }, [])

  // ── Import defaults for a level ──────────────────────────────────────────

  const handleImportDefault = async (nivelNumero: number) => {
    setImporting(nivelNumero)
    const res = await importarOpcionesDefault(clienteId, nivelNumero)
    setImporting(null)
    if (res.ok) {
      toast.success(res.message)
      await load()
    } else {
      toast.error(res.message)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <ListTree className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Clasificación del Cliente</h3>
            <p className="text-[11px] text-muted-foreground">
              Define los niveles y opciones disponibles para clasificar gastos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savingNiveles && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Guardando…
            </span>
          )}
          <Button
            size="sm"
            onClick={handleAddLevel}
            disabled={loading || savingNiveles}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir nivel
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-[11px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 border border-border">
        <strong>Cómo usar:</strong> cada bloque es un nivel de clasificación.
        Haz clic en el nombre del nivel para renombrarlo. Usa los chips para gestionar opciones
        — haz clic en el lápiz para editar o en la <strong>×</strong> para eliminar.
        Presiona <kbd className="bg-background border border-border rounded px-1 text-[10px]">Enter</kbd> para guardar una nueva opción rápidamente.
      </p>

      {/* Levels */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {niveles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center border border-dashed border-border rounded-lg">
              <ListTree className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay niveles configurados.</p>
              <Button size="sm" onClick={handleAddLevel} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Añadir primer nivel
              </Button>
            </div>
          ) : (
            niveles.map((nivel, idx) => (
              <LevelSection
                key={nivel.numero}
                nivel={nivel}
                options={opciones[nivel.numero] ?? []}
                clienteId={clienteId}
                onRename={handleRenameLevel}
                onDelete={(num) => setDeleteState({ open: true, numero: num })}
                onOptionAdded={handleOptionAdded}
                onOptionUpdated={handleOptionUpdated}
                onOptionDeleted={handleOptionDeleted}
                onImportDefault={handleImportDefault}
                importing={importing === nivel.numero}
                isFirst={idx === 0}
                isLast={idx === niveles.length - 1}
                onMoveUp={(num) => handleMove(num, 'up')}
                onMoveDown={(num) => handleMove(num, 'down')}
              />
            ))
          )}
        </div>
      )}

      {/* Delete level confirm */}
      <AlertDialog
        open={deleteState.open}
        onOpenChange={(o) => { if (!o) setDeleteState({ open: false, numero: null }) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este nivel?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el nivel de clasificación y todas sus opciones dejarán de mostrarse.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLevelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar nivel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
