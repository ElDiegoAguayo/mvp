'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2, Plus, Pencil, Trash2, ListTree, Sparkles, Upload, Download, ImagePlus, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { COMMON_CROPS, DEFAULT_PHENOLOGY_STAGES } from '@/lib/agronomy/constants'
import { currentSeasonLabel } from '@/lib/agronomy/format'
import {
  parsePhenologyFile,
  phenologyObservationKey,
  resolveStageFromCatalog,
  type ParsedEmbeddedImage,
} from '@/lib/agronomy/parse-phenology-xlsx'
import { exportPhenologyToExcel } from '@/lib/agronomy/export-phenology-xlsx'
import { getVarietiesForCrop } from '@/lib/agronomy/harvest-yields'
import {
  BlockTimelineGrid,
  fmtObsDate,
  type PhenologyTimelineImage,
  type PhenologyTimelineObservation,
} from '@/components/dashboard/phenology/block-timeline-grid'
import { PhenologySeasonSummary } from '@/components/dashboard/phenology/phenology-season-summary'
import {
  buildPhenologyAlerts,
  suggestsHarvestCount,
  predictNextStage,
  fmtShortDate,
} from '@/lib/agronomy/phenology-predictions'
import Link from 'next/link'
import { useLocale } from '@/components/i18n/locale-provider'
import { ClientStorageBar } from '@/components/vault/vault-storage-bar'
import { parseClientStorageRpc, type ClientStorageInfo } from '@/lib/client-storage'
import { formatAvailableStorage } from '@/lib/vault-storage'
import { loadPhenologyModuleData, offlineWrite, savePhenologyObservationOffline } from '@/lib/offline/agronomy-offline'
import { OFFLINE_EVENT } from '@/lib/offline/types'

interface HarvestBlockRef {
  id: string
  field_name: string
  block_name: string
  crop: string
  variety: string | null
}

const MANUAL_BLOCK = '__manual__'

interface PhenologyStage {
  id: string
  crop: string
  stage_name: string
  stage_code: string | null
  sort_order: number
  typical_days: number | null
  description: string | null
}

interface PhenologyObservation extends PhenologyTimelineObservation {
  crop: string
  stage_id: string | null
}

const ALL_BLOCKS = '__all__'
const ALL_VARIETIES = '__all_varieties__'
const BLOCKS_PAGE_SIZE = 10
const MAX_IMAGES = 8
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const EMPTY_OBS = {
  block_name: '',
  crop: 'Arándano',
  variety: '',
  stage_id: '',
  stage_name: '',
  observed_at: new Date().toISOString().slice(0, 10),
  season_label: currentSeasonLabel(),
  hilera: '',
  arbol: '',
  notes: '',
}

const EMPTY_STAGE = {
  crop: 'Arándano',
  stage_name: '',
  stage_code: '',
  sort_order: '1',
  typical_days: '',
  description: '',
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
}

export function PhenologicalStatesManager() {
  const { t } = useLocale()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [tab, setTab] = useState<'observations' | 'catalog'>('observations')
  const [stages, setStages] = useState<PhenologyStage[]>([])
  const [harvestBlocks, setHarvestBlocks] = useState<HarvestBlockRef[]>([])
  const [observations, setObservations] = useState<PhenologyObservation[]>([])
  const [filterCrop, setFilterCrop] = useState('Arándano')
  const [filterSeason, setFilterSeason] = useState(currentSeasonLabel())
  const [filterVariety, setFilterVariety] = useState(ALL_VARIETIES)
  const [filterBlock, setFilterBlock] = useState(ALL_BLOCKS)
  const [obsDialog, setObsDialog] = useState(false)
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameBlockOldName, setRenameBlockOldName] = useState('')
  const [renameBlockNewName, setRenameBlockNewName] = useState('')
  const [stageDialog, setStageDialog] = useState(false)
  const [editingObs, setEditingObs] = useState<PhenologyObservation | null>(null)
  const [editingStage, setEditingStage] = useState<PhenologyStage | null>(null)
  const [obsForm, setObsForm] = useState(EMPTY_OBS)
  const [stageForm, setStageForm] = useState(EMPTY_STAGE)
  const [existingImages, setExistingImages] = useState<PhenologyTimelineImage[]>([])
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<Record<string, string>>({})
  const [blocksPage, setBlocksPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [storageInfo, setStorageInfo] = useState<ClientStorageInfo | null>(null)

  const loadStorage = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_client_storage_for_user', {
        p_user_id: userId,
      })
      if (error) {
        setStorageInfo(null)
        return
      }
      setStorageInfo(parseClientStorageRpc(data))
    } catch {
      setStorageInfo(null)
    }
  }, [supabase])

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      const { effectiveUserId } = await getEffectiveUserId(supabase)
      if (!effectiveUserId) return
      setOwnerId(effectiveUserId)

      const data = await loadPhenologyModuleData(supabase, effectiveUserId)

      if (data.fromCache && data.observations.length === 0 && data.stages.length === 0) {
        toast.info(t('estadosFenologicos.toasts.offlinePreload'))
      }

      setStages((data.stages ?? []) as unknown as PhenologyStage[])
      setHarvestBlocks((data.blocks ?? []) as unknown as HarvestBlockRef[])

      const imagesByObs = new Map<string, PhenologyTimelineImage[]>()
      for (const img of data.images ?? []) {
        const obsId = String(img.observation_id)
        const list = imagesByObs.get(obsId) ?? []
        list.push({
          id: String(img.id),
          storage_path: String(img.storage_path),
          file_name: String(img.file_name),
          mime_type: img.mime_type ? String(img.mime_type) : null,
        })
        imagesByObs.set(obsId, list)
      }

      setObservations(
        (data.observations ?? []).map((row) => ({
          ...(row as unknown as PhenologyObservation),
          images: imagesByObs.get(String(row.id)) ?? [],
        })),
      )

      if (!data.fromCache) void loadStorage(effectiveUserId)
    } catch (e) {
      console.error(e)
      toast.error(t('estadosFenologicos.toasts.loadFailed'))
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [supabase, loadStorage, t])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onSyncDone = (event: Event) => {
      const detail = (event as CustomEvent<{ synced?: number; failed?: number }>).detail
      if ((detail?.synced ?? 0) > 0) void load({ silent: true })
    }
    window.addEventListener(OFFLINE_EVENT.syncDone, onSyncDone)
    return () => {
      window.removeEventListener(OFFLINE_EVENT.syncDone, onSyncDone)
    }
  }, [load])

  useEffect(() => {
    if (!obsDialog) {
      setExistingImageUrls({})
      return
    }
    const active = existingImages.filter((img) => !removedImageIds.includes(img.id))
    if (active.length === 0) {
      setExistingImageUrls({})
      return
    }
    let cancelled = false
    async function loadUrls() {
      const next: Record<string, string> = {}
      await Promise.all(
        active.map(async (img) => {
          const { data } = await supabase.storage.from('fenologia').createSignedUrl(img.storage_path, 3600)
          if (data?.signedUrl) next[img.id] = data.signedUrl
        }),
      )
      if (!cancelled) setExistingImageUrls(next)
    }
    loadUrls()
    return () => { cancelled = true }
  }, [obsDialog, existingImages, removedImageIds, supabase])

  const cropsInUse = useMemo(() => {
    const set = new Set<string>(COMMON_CROPS.filter((c) => c !== 'Otro'))
    stages.forEach((s) => { if (s.crop !== 'Otro') set.add(s.crop) })
    observations.forEach((o) => { if (o.crop !== 'Otro') set.add(o.crop) })
    return [...set]
  }, [stages, observations])

  const seasonsInUse = useMemo(() => {
    const set = new Set<string>([currentSeasonLabel(), filterSeason])
    observations.forEach((o) => { if (o.season_label) set.add(o.season_label) })
    return [...set].sort().reverse()
  }, [observations, filterSeason])

  const cropSeasonObservations = useMemo(
    () => observations.filter((o) =>
      o.crop === filterCrop && (o.season_label || '') === filterSeason,
    ),
    [observations, filterCrop, filterSeason],
  )

  const varietiesInUse = useMemo(() => {
    const set = new Set<string>()
    for (const v of getVarietiesForCrop(filterCrop)) set.add(v.name)
    for (const o of cropSeasonObservations) {
      if (o.variety?.trim()) set.add(o.variety.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [filterCrop, cropSeasonObservations])

  const seasonObservations = useMemo(() => {
    if (filterVariety === ALL_VARIETIES) return cropSeasonObservations
    return cropSeasonObservations.filter((o) => (o.variety ?? '') === filterVariety)
  }, [cropSeasonObservations, filterVariety])

  const catalogBlocksForCrop = useMemo(
    () => harvestBlocks.filter((b) => b.crop === filterCrop),
    [harvestBlocks, filterCrop],
  )

  const stagesForCrop = useMemo(
    () => stages.filter((s) => s.crop === filterCrop).sort((a, b) => a.sort_order - b.sort_order),
    [stages, filterCrop],
  )

  const phenologyAlerts = useMemo(
    () => buildPhenologyAlerts(
      seasonObservations.map((o) => ({
        block_name: o.block_name,
        stage_name: o.stage_name,
        stage_id: o.stage_id,
        observed_at: o.observed_at,
        season_label: o.season_label,
        images: o.images,
      })),
      stagesForCrop,
    ),
    [seasonObservations, stagesForCrop],
  )

  const harvestHintCount = useMemo(() => {
    const blocks = new Set<string>()
    for (const obs of seasonObservations) {
      if (suggestsHarvestCount(obs.stage_name, obs.crop)) blocks.add(obs.block_name)
    }
    return blocks.size
  }, [seasonObservations])

  const photoCount = useMemo(
    () => seasonObservations.reduce((sum, o) => sum + (o.images?.length ?? 0), 0),
    [seasonObservations],
  )

  const blocksInUse = useMemo(() => {
    const set = new Set<string>()
    for (const obs of seasonObservations) set.add(obs.block_name)
    for (const b of catalogBlocksForCrop) set.add(b.block_name)
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [seasonObservations, catalogBlocksForCrop])

  const timelineByBlock = useMemo(() => {
    const map = new Map<string, PhenologyObservation[]>()
    for (const obs of seasonObservations) {
      const list = map.get(obs.block_name) ?? []
      list.push(obs)
      map.set(obs.block_name, list)
    }
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => a.observed_at.localeCompare(b.observed_at)))
    }
    return map
  }, [seasonObservations])

  const visibleBlocks = useMemo(() => {
    if (filterBlock === ALL_BLOCKS) return blocksInUse
    if (filterBlock) return [filterBlock]
    return []
  }, [filterBlock, blocksInUse])

  const blocksTotalPages = Math.max(1, Math.ceil(visibleBlocks.length / BLOCKS_PAGE_SIZE))

  const paginatedBlocks = useMemo(() => {
    if (filterBlock !== ALL_BLOCKS) return visibleBlocks
    const start = blocksPage * BLOCKS_PAGE_SIZE
    return visibleBlocks.slice(start, start + BLOCKS_PAGE_SIZE)
  }, [visibleBlocks, filterBlock, blocksPage])

  useEffect(() => {
    setBlocksPage(0)
  }, [filterBlock, filterCrop, filterSeason, filterVariety])

  useEffect(() => {
    setFilterVariety(ALL_VARIETIES)
  }, [filterCrop, filterSeason])

  useEffect(() => {
    if (filterVariety !== ALL_VARIETIES && !varietiesInUse.includes(filterVariety)) {
      setFilterVariety(ALL_VARIETIES)
    }
  }, [filterVariety, varietiesInUse])

  useEffect(() => {
    if (blocksPage > blocksTotalPages - 1) {
      setBlocksPage(Math.max(0, blocksTotalPages - 1))
    }
  }, [blocksPage, blocksTotalPages])

  const timelineObs = useMemo(() => {
    if (!filterBlock || filterBlock === ALL_BLOCKS) return []
    return timelineByBlock.get(filterBlock) ?? []
  }, [filterBlock, timelineByBlock])

  const varietyOptionsForForm = useMemo(() => {
    const names = new Set<string>()
    for (const v of getVarietiesForCrop(obsForm.crop)) names.add(v.name)
    for (const o of observations) {
      if (o.crop === obsForm.crop && o.variety?.trim()) names.add(o.variety.trim())
    }
    if (obsForm.variety.trim()) names.add(obsForm.variety.trim())
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [obsForm.crop, obsForm.variety, observations])

  async function seedDefaultStages() {
    if (!ownerId) return
    const defaults = DEFAULT_PHENOLOGY_STAGES[filterCrop]
    if (!defaults) {
      toast.error(t('estadosFenologicos.toasts.noTemplate'))
      return
    }
    if (stagesForCrop.length > 0 && !confirm(t('estadosFenologicos.toasts.templateExists'))) return

    setSaving(true)
    const rows = defaults.map((d) => ({
      user_id: ownerId,
      crop: filterCrop,
      ...d,
    }))
    const { error } = await supabase.from('phenology_stages').insert(rows)
    setSaving(false)
    if (error) {
      toast.error(t('estadosFenologicos.toasts.templateLoadFailed'))
      return
    }
    toast.success(t('estadosFenologicos.toasts.templateLoaded', { crop: filterCrop }))
    load()
  }

  function resetImageState(
    images: PhenologyTimelineImage[] = [],
  ) {
    setExistingImages(images)
    setPendingImages([])
    setRemovedImageIds([])
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function openObsCreate(blockName?: string, prefillDate?: string) {
    setEditingObs(null)
    const targetBlock = blockName ?? (filterBlock !== ALL_BLOCKS ? filterBlock : '')
    const last = targetBlock ? timelineByBlock.get(targetBlock)?.at(-1) : seasonObservations.at(-1)
    const nextDate = prefillDate
      ?? (last ? addDays(last.observed_at, 7) : new Date().toISOString().slice(0, 10))
    const defaultVariety = last?.variety?.trim()
      || getVarietiesForCrop(filterCrop)[0]?.name
      || ''
    setObsForm({
      ...EMPTY_OBS,
      crop: filterCrop,
      block_name: targetBlock,
      season_label: filterSeason,
      observed_at: nextDate,
      variety: defaultVariety,
      hilera: last?.hilera != null ? String(last.hilera) : '',
      arbol: last?.arbol != null ? String(last.arbol) : '',
      stage_id: '',
      stage_name: '',
    })
    resetImageState()
    setObsDialog(true)
  }

  function openObsEdit(row: PhenologyObservation) {
    setEditingObs(row)
    setObsForm({
      block_name: row.block_name,
      crop: row.crop,
      variety: row.variety ?? '',
      stage_id: row.stage_id ?? '',
      stage_name: row.stage_name,
      observed_at: row.observed_at,
      season_label: row.season_label || filterSeason,
      hilera: row.hilera != null ? String(row.hilera) : '',
      arbol: row.arbol != null ? String(row.arbol) : '',
      notes: row.notes ?? '',
    })
    resetImageState(row.images ?? [])
    setObsDialog(true)
  }

  function handleImagePick(files: FileList | null) {
    if (!files?.length) return
    const next = [...pendingImages]
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('estadosFenologicos.toasts.notImage', { name: file.name }))
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t('estadosFenologicos.toasts.fileTooLarge', { name: file.name }))
        continue
      }
      const total = existingImages.length - removedImageIds.length + next.length
      if (total >= MAX_IMAGES) {
        toast.error(t('estadosFenologicos.toasts.maxImages', { count: MAX_IMAGES }))
        break
      }
      next.push(file)
    }
    setPendingImages(next)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function assertStorageAvailable(additionalBytes: number) {
    if (!storageInfo || additionalBytes <= 0) return true
    if (storageInfo.usedBytes + additionalBytes <= storageInfo.quotaBytes) return true
    toast.error(
      t('estadosFenologicos.toasts.storageInsufficient', {
        available: formatAvailableStorage(storageInfo.usedBytes, storageInfo.quotaBytes),
      }),
    )
    return false
  }

  async function uploadObservationImages(observationId: string) {
    if (!ownerId || pendingImages.length === 0) return

    const pendingBytes = pendingImages.reduce((sum, f) => sum + f.size, 0)
    if (!assertStorageAvailable(pendingBytes)) {
      throw new Error('storage_quota_exceeded')
    }

    const startOrder = existingImages.length - removedImageIds.length
    for (let i = 0; i < pendingImages.length; i++) {
      const file = pendingImages[i]
      const safeName = sanitizeFileName(file.name)
      const storagePath = `${ownerId}/phenology/${observationId}/${Date.now()}-${i}-${safeName}`
      const { error: upErr } = await supabase.storage.from('fenologia').upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase.from('phenology_observation_images').insert({
        observation_id: observationId,
        user_id: ownerId,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: file.type,
        file_size: file.size,
        sort_order: startOrder + i,
      })
      if (dbErr) throw dbErr
    }
  }

  async function removeMarkedImages() {
    if (removedImageIds.length === 0) return
    const toRemove = existingImages.filter((img) => removedImageIds.includes(img.id))
    if (toRemove.length === 0) return

    const { error: dbErr } = await supabase
      .from('phenology_observation_images')
      .delete()
      .in('id', removedImageIds)
    if (dbErr) throw dbErr

    const paths = toRemove.map((img) => img.storage_path)
    await supabase.storage.from('fenologia').remove(paths)
  }

  async function saveObservation(options?: { addAnotherWeek?: boolean }) {
    if (!ownerId || !obsForm.block_name.trim()) {
      toast.error(t('estadosFenologicos.toasts.blockRequired'))
      return
    }
    const stageName = obsForm.stage_name.trim()
    if (!stageName) {
      toast.error(t('estadosFenologicos.toasts.stageRequired'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        user_id: ownerId,
        block_name: obsForm.block_name.trim(),
        crop: obsForm.crop,
        variety: obsForm.variety.trim() || null,
        stage_id: obsForm.stage_id || null,
        stage_name: stageName,
        observed_at: obsForm.observed_at,
        season_label: obsForm.season_label.trim() || filterSeason,
        hilera: obsForm.hilera ? Number(obsForm.hilera) : null,
        arbol: obsForm.arbol ? Number(obsForm.arbol) : null,
        notes: obsForm.notes.trim() || null,
      }

      if (editingObs && removedImageIds.length > 0 && !editingObs.id.startsWith('local-')) {
        await removeMarkedImages()
      }

      const result = await savePhenologyObservationOffline(supabase, {
        userId: ownerId,
        payload,
        editingId: editingObs?.id,
        pendingImages: pendingImages.length > 0 ? pendingImages : undefined,
        startImageOrder: existingImages.length - removedImageIds.length,
      })

      if (!result.ok) throw new Error(result.error ?? 'Error al guardar')

      setFilterBlock(payload.block_name)
      setFilterSeason(payload.season_label)

      const continueWithNextWeek = options?.addAnotherWeek && !editingObs
      const savedMsg = result.offline
        ? t('estadosFenologicos.toasts.savedLocal')
        : continueWithNextWeek
          ? t('estadosFenologicos.toasts.weekSaved', { date: fmtObsDate(payload.observed_at) })
          : t('estadosFenologicos.toasts.readingSaved')

      if (continueWithNextWeek) {
        toast.success(savedMsg)
        setObsForm({
          ...EMPTY_OBS,
          crop: filterCrop,
          block_name: payload.block_name,
          season_label: payload.season_label,
          observed_at: addDays(payload.observed_at, 7),
          variety: payload.variety ?? '',
          hilera: payload.hilera != null ? String(payload.hilera) : '',
          arbol: payload.arbol != null ? String(payload.arbol) : '',
          stage_id: '',
          stage_name: '',
          notes: '',
        })
        resetImageState()
        setEditingObs(null)
        load()
      } else {
        toast.success(savedMsg)
        setObsDialog(false)
        load()
      }
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('storage_quota_exceeded')) {
        toast.error(t('estadosFenologicos.toasts.storageQuota'))
      } else {
        toast.error(t('estadosFenologicos.toasts.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteObservation(row: PhenologyObservation) {
    if (!confirm(
      t('estadosFenologicos.confirms.deleteReading', { date: fmtObsDate(row.observed_at) }),
    )) return
    setSaving(true)
    try {
      const paths = (row.images ?? []).map((img) => img.storage_path)
      const result = await offlineWrite(supabase, {
        userId: ownerId!,
        table: 'phenology_observations',
        operation: 'delete',
        payload: {},
        match: { id: row.id },
        cacheModule: 'phenology',
        cacheListKey: 'observations',
      })
      if (!result.ok) throw new Error(result.error)
      if (!result.offline && paths.length > 0) await supabase.storage.from('fenologia').remove(paths)
      toast.success(result.offline ? t('estadosFenologicos.toasts.deleteQueued') : t('estadosFenologicos.toasts.deleted'))
      setObsDialog(false)
      load()
    } catch (e) {
      console.error(e)
      toast.error(t('estadosFenologicos.toasts.deleteFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function renameBlock(oldName: string, newName: string) {
    if (!ownerId) return
    const trimmed = newName.trim()
    if (!trimmed) {
      toast.error(t('estadosFenologicos.toasts.blockNameRequired'))
      return
    }
    if (trimmed === oldName) {
      setRenameDialog(false)
      return
    }

    const blockObs = observations.filter((o) => o.crop === filterCrop && o.block_name === oldName)
    if (blockObs.length === 0) {
      toast.error(t('estadosFenologicos.toasts.blockNoReadings'))
      return
    }

    const duplicate = observations.some(
      (o) => o.crop === filterCrop && o.block_name === trimmed,
    )
    if (duplicate) {
      toast.error(t('estadosFenologicos.toasts.blockExists', { name: trimmed }))
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('phenology_observations')
        .update({ block_name: trimmed })
        .eq('user_id', ownerId)
        .eq('crop', filterCrop)
        .eq('block_name', oldName)
      if (error) throw error

      toast.success(t('estadosFenologicos.toasts.blockRenamed', { name: trimmed }))
      if (filterBlock === oldName) setFilterBlock(trimmed)
      setRenameDialog(false)
      load()
    } catch (e) {
      console.error(e)
      toast.error(t('estadosFenologicos.toasts.renameFailed'))
    } finally {
      setSaving(false)
    }
  }

  function openRenameBlock(blockName: string) {
    setRenameBlockOldName(blockName)
    setRenameBlockNewName(blockName)
    setRenameDialog(true)
  }

  async function uploadEmbeddedImages(
    observationId: string,
    images: ParsedEmbeddedImage[],
    startOrder: number,
  ) {
    if (!ownerId || images.length === 0) return

    const pendingBytes = images.reduce((sum, img) => sum + img.buffer.byteLength, 0)
    if (!assertStorageAvailable(pendingBytes)) {
      throw new Error('storage_quota_exceeded')
    }

    for (let i = 0; i < images.length; i++) {
      if (startOrder + i >= MAX_IMAGES) break
      const img = images[i]
      const mime =
        img.extension === 'png'
          ? 'image/png'
          : img.extension === 'gif'
            ? 'image/gif'
            : img.extension === 'webp'
              ? 'image/webp'
              : 'image/jpeg'
      const ext = img.extension === 'jpeg' ? 'jpg' : img.extension
      const fileName = `import-${Date.now()}-${i}.${ext}`
      const storagePath = `${ownerId}/phenology/${observationId}/${fileName}`
      const blob = new Blob([img.buffer], { type: mime })

      const { error: upErr } = await supabase.storage.from('fenologia').upload(storagePath, blob, {
        contentType: mime,
        upsert: false,
      })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase.from('phenology_observation_images').insert({
        observation_id: observationId,
        user_id: ownerId,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mime,
        file_size: img.buffer.byteLength,
        sort_order: startOrder + i,
      })
      if (dbErr) throw dbErr
    }
  }

  async function handleImport(file: File) {
    if (!ownerId) return
    setSaving(true)
    try {
      const parsed = await parsePhenologyFile(file, filterCrop)
      if (parsed.length === 0) {
        toast.error(t('estadosFenologicos.import.noReadings'))
        return
      }

      const catalogStages = stages.filter((s) => s.crop === filterCrop)
      const existingByKey = new Map<string, PhenologyObservation>()
      for (const obs of observations.filter((o) => o.crop === filterCrop)) {
        existingByKey.set(phenologyObservationKey(obs), obs)
      }

      let created = 0
      let updated = 0
      let unchanged = 0
      let unmatchedStages = 0
      let imagesImported = 0

      for (const row of parsed) {
        const resolved = resolveStageFromCatalog(row.stage_name, catalogStages)
        if (!resolved.catalogMatch) unmatchedStages++

        const key = phenologyObservationKey(row)
        const existing = existingByKey.get(key)
        const payload = {
          user_id: ownerId,
          block_name: row.block_name,
          crop: row.crop,
          variety: row.variety,
          stage_id: resolved.stage_id,
          stage_name: resolved.stage_name,
          observed_at: row.observed_at,
          season_label: row.season_label.trim() || filterSeason,
          hilera: row.hilera,
          arbol: row.arbol,
          notes: row.notes,
        }

        if (existing) {
          const sameData =
            existing.stage_name === payload.stage_name &&
            existing.stage_id === payload.stage_id &&
            (existing.notes ?? null) === (payload.notes ?? null) &&
            existing.hilera === payload.hilera &&
            existing.arbol === payload.arbol
          const hasImages = (existing.images?.length ?? 0) > 0
          const wantsImages = row.embeddedImages.length > 0 && !hasImages

          if (sameData && !wantsImages) {
            unchanged++
            continue
          }

          const { error } = await supabase
            .from('phenology_observations')
            .update(payload)
            .eq('id', existing.id)
          if (error) throw error
          updated++

          if (wantsImages) {
            await uploadEmbeddedImages(existing.id, row.embeddedImages, existing.images?.length ?? 0)
            imagesImported += row.embeddedImages.length
          }
        } else {
          const { data, error } = await supabase
            .from('phenology_observations')
            .insert(payload)
            .select('id')
            .single()
          if (error) throw error

          const observationId = String(data.id)
          created++

          if (row.embeddedImages.length > 0) {
            await uploadEmbeddedImages(observationId, row.embeddedImages, 0)
            imagesImported += row.embeddedImages.length
          }
        }
      }

      const parts = [
        t('estadosFenologicos.import.new', { count: created }),
        t('estadosFenologicos.import.updated', { count: updated }),
      ]
      if (unchanged > 0) parts.push(t('estadosFenologicos.import.unchanged', { count: unchanged }))
      if (imagesImported > 0) parts.push(t('estadosFenologicos.import.photos', { count: imagesImported }))
      toast.success(t('estadosFenologicos.import.summary', { parts: parts.join(', ') }))

      if (unmatchedStages > 0) {
        toast.warning(t('estadosFenologicos.import.unmatchedStages', { count: unmatchedStages }))
      }

      load()
    } catch (e) {
      console.error(e)
      toast.error(t('estadosFenologicos.import.failed'))
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleExport() {
    if (seasonObservations.length === 0) {
      toast.error(t('estadosFenologicos.export.noReadings'))
      return
    }

    setExporting(true)
    setExportStatus(t('estadosFenologicos.export.preparing'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    try {
      const result = await exportPhenologyToExcel(
        seasonObservations.map((o) => ({
          block_name: o.block_name,
          season_label: o.season_label || filterSeason,
          observed_at: o.observed_at,
          variety: o.variety,
          stage_name: o.stage_name,
          hilera: o.hilera,
          arbol: o.arbol,
          notes: o.notes,
          images: o.images?.map((img) => ({
            storage_path: img.storage_path,
            file_name: img.file_name,
            mime_type: img.mime_type,
          })),
        })),
        {
          crop: filterCrop,
          seasonLabel: filterSeason,
          onProgress: (msg) => {
            if (msg.startsWith('Preparando')) {
              setExportStatus(t('estadosFenologicos.export.preparing'))
            } else {
              const dl = msg.match(/Descargando fotos \((\d+) de (\d+)\)/)
              if (dl) {
                setExportStatus(t('estadosFenologicos.export.downloadingPhotos', {
                  current: dl[1],
                  total: dl[2],
                }))
              } else if (msg.startsWith('Generando')) {
                setExportStatus(t('estadosFenologicos.export.generatingFile'))
              } else {
                setExportStatus(msg)
              }
            }
          },
        },
        async (path) => {
          const { data, error } = await supabase.storage.from('fenologia').download(path)
          if (error || !data) return null
          return data.arrayBuffer()
        },
      )

      if (result.embedded === 0 && result.skipped > 0) {
        toast.warning(t('estadosFenologicos.export.noPhotos'))
      } else if (result.skipped > 0) {
        const webpNote = result.webpConverted > 0
          ? t('estadosFenologicos.export.webpConverted', { count: result.webpConverted })
          : ''
        toast.success(t('estadosFenologicos.export.withPhotosSkipped', {
          embedded: result.embedded,
          skipped: result.skipped,
          webp: webpNote,
        }))
      } else if (result.embedded > 0) {
        const webpNote = result.webpConverted > 0
          ? t('estadosFenologicos.export.webpNote', { count: result.webpConverted })
          : ''
        toast.success(t('estadosFenologicos.export.withPhotos', { count: result.embedded }) + webpNote)
      } else {
        toast.success(t('estadosFenologicos.export.success'))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('estadosFenologicos.export.failed'))
    } finally {
      setExporting(false)
      setExportStatus('')
    }
  }

  function openStageCreate() {
    setEditingStage(null)
    setStageForm({
      ...EMPTY_STAGE,
      crop: filterCrop,
      sort_order: String(stagesForCrop.length + 1),
    })
    setStageDialog(true)
  }

  function openStageEdit(row: PhenologyStage) {
    setEditingStage(row)
    setStageForm({
      crop: row.crop,
      stage_name: row.stage_name,
      stage_code: row.stage_code ?? '',
      sort_order: String(row.sort_order),
      typical_days: row.typical_days != null ? String(row.typical_days) : '',
      description: row.description ?? '',
    })
    setStageDialog(true)
  }

  async function saveStage() {
    if (!ownerId || !stageForm.stage_name.trim()) {
      toast.error(t('estadosFenologicos.toasts.stageNameRequired'))
      return
    }
    setSaving(true)
    const payload = {
      user_id: ownerId,
      crop: stageForm.crop,
      stage_name: stageForm.stage_name.trim(),
      stage_code: stageForm.stage_code.trim() || null,
      sort_order: Number(stageForm.sort_order) || 0,
      typical_days: stageForm.typical_days ? Number(stageForm.typical_days) : null,
      description: stageForm.description.trim() || null,
    }
    const { error } = editingStage
      ? await supabase.from('phenology_stages').update(payload).eq('id', editingStage.id)
      : await supabase.from('phenology_stages').insert(payload)
    setSaving(false)
    if (error) {
      toast.error(t('estadosFenologicos.toasts.stageSaveFailed'))
      return
    }
    toast.success(t('estadosFenologicos.toasts.stageSaved'))
    setStageDialog(false)
    load()
  }

  async function deleteStage(row: PhenologyStage) {
    if (!confirm(t('estadosFenologicos.confirms.deleteStage', { name: row.stage_name }))) return
    const { error } = await supabase.from('phenology_stages').delete().eq('id', row.id)
    if (error) toast.error(t('estadosFenologicos.toasts.deleteFailed'))
    else { toast.success(t('estadosFenologicos.toasts.deleted')); load() }
  }

  const visibleImageCount = existingImages.length - removedImageIds.length + pendingImages.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {t('estadosFenologicos.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {storageInfo && (
        <ClientStorageBar
          usedBytes={storageInfo.usedBytes}
          quotaBytes={storageInfo.quotaBytes}
          modules={storageInfo.modules}
        />
      )}

      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-2xl">
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground">{t('estadosFenologicos.filters.crop')}</label>
              <Select value={filterCrop} onValueChange={setFilterCrop}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cropsInUse.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {tab === 'observations' && (
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-muted-foreground">{t('estadosFenologicos.filters.season')}</label>
                <Select value={filterSeason} onValueChange={setFilterSeason}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {seasonsInUse.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant={tab === 'observations' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('observations')}
            >
              {t('estadosFenologicos.tabs.tracking')}
            </Button>
            <Button
              variant={tab === 'catalog' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('catalog')}
            >
              <ListTree className="w-4 h-4 mr-1" /> {t('estadosFenologicos.tabs.catalog')}
            </Button>
          </div>
        </div>
        {tab === 'observations' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/60">
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground">{t('estadosFenologicos.filters.variety')}</label>
              <Select value={filterVariety} onValueChange={setFilterVariety}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('estadosFenologicos.filters.allVarieties')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VARIETIES}>{t('estadosFenologicos.filters.allVarieties')}</SelectItem>
                  {varietiesInUse.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground">{t('estadosFenologicos.filters.block')}</label>
              <Select value={filterBlock || ALL_BLOCKS} onValueChange={setFilterBlock}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('estadosFenologicos.filters.allBlocks')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BLOCKS}>{t('estadosFenologicos.filters.allBlocks')}</SelectItem>
                  {blocksInUse.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {tab === 'observations' && (
        <>
          <PhenologySeasonSummary
            blockCount={blocksInUse.length}
            readingCount={seasonObservations.length}
            photoCount={photoCount}
            alerts={phenologyAlerts}
            harvestHintCount={harvestHintCount}
          />
          {harvestHintCount > 0 && filterCrop === 'Cerezo' && (
            <p className="text-sm">
              <Link href="/dashboard/estimacion-cosecha" className="text-primary font-medium hover:underline">
                {t('estadosFenologicos.summary.goToHarvest')}
              </Link>
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('estadosFenologicos.tracking.excelStructure')}
            </p>
            <div className="flex gap-2 flex-wrap">
              {stagesForCrop.length === 0 && DEFAULT_PHENOLOGY_STAGES[filterCrop] && (
                <Button variant="outline" size="sm" onClick={seedDefaultStages} disabled={saving}>
                  <Sparkles className="w-4 h-4 mr-1" /> {t('estadosFenologicos.tracking.template', { crop: filterCrop })}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                <Upload className="w-4 h-4 mr-1" /> {t('estadosFenologicos.tracking.importExcel')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || seasonObservations.length === 0}
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {exporting ? t('estadosFenologicos.tracking.exporting') : t('estadosFenologicos.tracking.exportExcel')}
              </Button>
              <Button
                size="sm"
                onClick={() => openObsCreate(filterBlock !== ALL_BLOCKS ? filterBlock : undefined)}
                className="gap-1"
              >
                <Plus className="w-4 h-4" /> {t('estadosFenologicos.tracking.newWeek')}
              </Button>
            </div>
          </div>

          {seasonObservations.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              <p className="font-medium text-foreground mb-1">
                {t('estadosFenologicos.tracking.noReadingsTitle', {
                  crop: filterCrop,
                  variety: filterVariety !== ALL_VARIETIES ? ` · ${filterVariety}` : '',
                  season: filterSeason,
                })}
              </p>
              <p className="text-sm mb-4">
                {t('estadosFenologicos.tracking.noReadingsDesc')}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => openObsCreate()}>{t('estadosFenologicos.tracking.registerReading')}</Button>
              </div>
            </div>
          ) : filterBlock === ALL_BLOCKS ? (
            <div className="space-y-6">
              {visibleBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                  <p className="font-medium text-foreground">{t('estadosFenologicos.tracking.seasonEmptyTitle', { season: filterSeason })}</p>
                  <p className="text-sm mt-1">{t('estadosFenologicos.tracking.seasonEmptyDesc')}</p>
                </div>
              ) : (
                <>
                  {blocksTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        {t('estadosFenologicos.tracking.blocksRange', {
                          from: blocksPage * BLOCKS_PAGE_SIZE + 1,
                          to: Math.min((blocksPage + 1) * BLOCKS_PAGE_SIZE, visibleBlocks.length),
                          total: visibleBlocks.length,
                        })}
                        {' · '}
                        {t('estadosFenologicos.tracking.page', {
                          current: blocksPage + 1,
                          total: blocksTotalPages,
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBlocksPage((p) => Math.max(0, p - 1))}
                          disabled={blocksPage === 0}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          {t('estadosFenologicos.tracking.previous')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBlocksPage((p) => Math.min(blocksTotalPages - 1, p + 1))}
                          disabled={blocksPage >= blocksTotalPages - 1}
                        >
                          {t('estadosFenologicos.tracking.next')}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {paginatedBlocks.map((blockName) => (
                    <BlockTimelineGrid
                      key={blockName}
                      blockName={blockName}
                      seasonLabel={filterSeason}
                      crop={filterCrop}
                      observations={timelineByBlock.get(blockName) ?? []}
                      onEdit={(obs) => openObsEdit(obs as PhenologyObservation)}
                      onDelete={(obs) => void deleteObservation(obs as PhenologyObservation)}
                      onAddWeek={() => openObsCreate(blockName)}
                      onRenameBlock={() => openRenameBlock(blockName)}
                      compact
                    />
                  ))}
                  {blocksTotalPages > 1 && (
                    <div className="flex justify-center gap-2 pt-2">
                      {Array.from({ length: blocksTotalPages }, (_, i) => (
                        <Button
                          key={i}
                          variant={i === blocksPage ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setBlocksPage(i)}
                        >
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <BlockTimelineGrid
              blockName={filterBlock}
              seasonLabel={filterSeason}
              crop={filterCrop}
              observations={timelineObs}
              onEdit={(obs) => openObsEdit(obs as PhenologyObservation)}
              onDelete={(obs) => void deleteObservation(obs as PhenologyObservation)}
              onAddWeek={() => openObsCreate(filterBlock)}
              onRenameBlock={() => openRenameBlock(filterBlock)}
            />
          )}
        </>
      )}

      {tab === 'catalog' && (
        <>
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('estadosFenologicos.catalog.stagesFor', { crop: filterCrop })}
            </p>
            <div className="flex gap-2">
              {DEFAULT_PHENOLOGY_STAGES[filterCrop] && (
                <Button variant="outline" size="sm" onClick={seedDefaultStages} disabled={saving}>
                  <Sparkles className="w-4 h-4 mr-1" /> {t('estadosFenologicos.catalog.template')}
                </Button>
              )}
              <Button size="sm" onClick={openStageCreate} className="gap-1">
                <Plus className="w-4 h-4" /> {t('estadosFenologicos.catalog.stage')}
              </Button>
            </div>
          </div>

          {stagesForCrop.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              {t('estadosFenologicos.catalog.empty', { crop: filterCrop })}
            </div>
          ) : (
            <div className="relative pl-6 space-y-0">
              {stagesForCrop.map((stage, idx) => (
                <div key={stage.id} className="relative pb-6 last:pb-0">
                  {idx < stagesForCrop.length - 1 && (
                    <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                  )}
                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-lime-500 bg-background" />
                  <div className="ml-4 rounded-lg border bg-card p-4 flex justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {stage.stage_code && (
                          <Badge variant="secondary" className="text-xs">{stage.stage_code}</Badge>
                        )}
                        <span className="font-medium">{stage.stage_name}</span>
                      </div>
                      {stage.description && (
                        <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                      )}
                      {stage.typical_days != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('estadosFenologicos.catalog.daysFromPrevious', { days: stage.typical_days })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openStageEdit(stage)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteStage(stage)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={obsDialog} onOpenChange={setObsDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingObs ? t('estadosFenologicos.dialogs.editReading') : t('estadosFenologicos.dialogs.newReading')}
            </DialogTitle>
            {!editingObs && (
              <p className="text-sm text-muted-foreground">
                {t('estadosFenologicos.dialogs.saveAnotherHint')}
              </p>
            )}
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.block')}</label>
                {catalogBlocksForCrop.length > 0 ? (
                  <>
                    <Select
                      value={
                        obsForm.block_name &&
                        catalogBlocksForCrop.some((b) => b.block_name === obsForm.block_name)
                          ? obsForm.block_name
                          : MANUAL_BLOCK
                      }
                      onValueChange={(v) => {
                        if (v === MANUAL_BLOCK) {
                          setObsForm({ ...obsForm, block_name: '' })
                          return
                        }
                        const block = catalogBlocksForCrop.find((b) => b.block_name === v)
                        setObsForm({
                          ...obsForm,
                          block_name: v,
                          variety: block?.variety ?? obsForm.variety,
                        })
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={t('estadosFenologicos.dialogs.selectBlock')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MANUAL_BLOCK}>{t('estadosFenologicos.dialogs.writeManual')}</SelectItem>
                        {catalogBlocksForCrop.map((b) => (
                          <SelectItem key={b.id} value={b.block_name}>
                            {b.block_name}{b.field_name ? ` · ${b.field_name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(obsForm.block_name === '' ||
                      !catalogBlocksForCrop.some((b) => b.block_name === obsForm.block_name)) && (
                      <Input
                        className="mt-2"
                        value={obsForm.block_name}
                        onChange={(e) => setObsForm({ ...obsForm, block_name: e.target.value })}
                        placeholder={t('estadosFenologicos.dialogs.blockNamePlaceholder')}
                      />
                    )}
                  </>
                ) : (
                  <Input
                    value={obsForm.block_name}
                    onChange={(e) => setObsForm({ ...obsForm, block_name: e.target.value })}
                    placeholder={t('estadosFenologicos.dialogs.blockLegacyPlaceholder')}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.filters.season')}</label>
                <Input
                  value={obsForm.season_label}
                  onChange={(e) => setObsForm({ ...obsForm, season_label: e.target.value })}
                  placeholder="2025-2026"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.timeline.date')} *</label>
                <Input type="date" value={obsForm.observed_at} onChange={(e) => setObsForm({ ...obsForm, observed_at: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.filters.variety')}</label>
                <Select
                  value={obsForm.variety || 'none'}
                  onValueChange={(v) => setObsForm({ ...obsForm, variety: v === 'none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder={t('estadosFenologicos.dialogs.selectVariety')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('estadosFenologicos.dialogs.selectOption')}</SelectItem>
                    {varietyOptionsForForm.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.timeline.row')}</label>
                <Input type="number" min="0" value={obsForm.hilera} onChange={(e) => setObsForm({ ...obsForm, hilera: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.timeline.tree')}</label>
                <Input type="number" min="0" value={obsForm.arbol} onChange={(e) => setObsForm({ ...obsForm, arbol: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.catalogShortcut')}</label>
              <Select
                value={obsForm.stage_id || 'none'}
                onValueChange={(v) => {
                  if (v === 'none') {
                    setObsForm({ ...obsForm, stage_id: '' })
                    return
                  }
                  const st = stages.find((s) => s.id === v)
                  setObsForm({
                    ...obsForm,
                    stage_id: v,
                    stage_name: st?.stage_name ?? obsForm.stage_name,
                  })
                }}
              >
                <SelectTrigger><SelectValue placeholder={t('estadosFenologicos.dialogs.optional')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {stages.filter((s) => s.crop === obsForm.crop).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.stage_code ? `${s.stage_code} · ` : ''}{s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {obsForm.stage_id && (() => {
              const st = stages.find((s) => s.id === obsForm.stage_id)
              const prediction = st && obsForm.observed_at
                ? predictNextStage(
                  { block_name: obsForm.block_name, stage_name: obsForm.stage_name, stage_id: obsForm.stage_id, observed_at: obsForm.observed_at, season_label: obsForm.season_label },
                  stagesForCrop,
                )
                : null
              if (!prediction) return null
              return (
                <p className="text-xs text-muted-foreground rounded-lg border bg-muted/20 px-3 py-2">
                  {t('estadosFenologicos.dialogs.nextStageExpected', {
                    stage: prediction.nextStageName,
                    date: fmtShortDate(prediction.expectedDate),
                  })}
                </p>
              )
            })()}
            <div>
              <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.phenologyState')}</label>
              <Textarea
                value={obsForm.stage_name}
                onChange={(e) => setObsForm({ ...obsForm, stage_name: e.target.value })}
                rows={3}
                placeholder={t('estadosFenologicos.dialogs.phenologyPlaceholder')}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('estadosFenologicos.timeline.notes')}</label>
              <Textarea value={obsForm.notes} onChange={(e) => setObsForm({ ...obsForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-foreground">{t('estadosFenologicos.dialogs.fieldImages')}</label>
                <span className="text-xs text-muted-foreground">{visibleImageCount}/{MAX_IMAGES}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {existingImages
                  .filter((img) => !removedImageIds.includes(img.id))
                  .map((img) => {
                    const url = existingImageUrls[img.id]
                    return (
                      <div key={img.id} className="relative group">
                        <div className="aspect-square w-full rounded-lg border-2 border-border overflow-hidden bg-muted">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={img.file_name} className="w-full h-full object-contain bg-muted/50" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                              {img.file_name}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md opacity-90 hover:opacity-100"
                          onClick={() => setRemovedImageIds((prev) => [...prev, img.id])}
                          title={t('estadosFenologicos.dialogs.removePhoto')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate" title={img.file_name}>
                          {img.file_name}
                        </p>
                      </div>
                    )
                  })}
                {pendingImages.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative">
                    <div className="aspect-square w-full rounded-lg border-2 border-lime-500/40 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-contain bg-muted/50" />
                    </div>
                    <button
                      type="button"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                      onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                      title={t('estadosFenologicos.dialogs.remove')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate" title={file.name}>
                      {t('estadosFenologicos.dialogs.newPhoto', { name: file.name })}
                    </p>
                  </div>
                ))}
                {visibleImageCount < MAX_IMAGES && (
                  <button
                    type="button"
                    className="aspect-square w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-lime-500/50 hover:bg-muted/30 transition-colors min-h-[280px]"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImagePlus className="w-8 h-8 mb-2" />
                    <span className="text-xs font-medium">{t('estadosFenologicos.dialogs.addPhoto')}</span>
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                {t('estadosFenologicos.dialogs.photoHint')}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editingObs ? (
              <Button variant="destructive" onClick={() => deleteObservation(editingObs)} disabled={saving}>
                {t('common.actions.delete')}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setObsDialog(false)} disabled={saving}>
                {t('common.actions.cancel')}
              </Button>
              {!editingObs && (
                <Button
                  variant="secondary"
                  onClick={() => saveObservation({ addAnotherWeek: true })}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {t('estadosFenologicos.dialogs.saveAndAnother')}
                </Button>
              )}
              <Button onClick={() => saveObservation()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('common.actions.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('estadosFenologicos.dialogs.renameBlock')}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t('estadosFenologicos.dialogs.renameHint', { name: renameBlockOldName, crop: filterCrop })}
            </p>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.newName')}</label>
            <Input
              value={renameBlockNewName}
              onChange={(e) => setRenameBlockNewName(e.target.value)}
              placeholder={t('estadosFenologicos.dialogs.blockLegacyPlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameBlock(renameBlockOldName, renameBlockNewName)
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameDialog(false)} disabled={saving}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={() => renameBlock(renameBlockOldName, renameBlockNewName)}
              disabled={saving || !renameBlockNewName.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('estadosFenologicos.dialogs.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage ? t('estadosFenologicos.dialogs.editStage') : t('estadosFenologicos.dialogs.newStage')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.filters.crop')}</label>
                <Select value={stageForm.crop} onValueChange={(v) => setStageForm({ ...stageForm, crop: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cropsInUse.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.order')}</label>
                <Input type="number" min="0" value={stageForm.sort_order} onChange={(e) => setStageForm({ ...stageForm, sort_order: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.name')}</label>
                <Input value={stageForm.stage_name} onChange={(e) => setStageForm({ ...stageForm, stage_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.code')}</label>
                <Input value={stageForm.stage_code} onChange={(e) => setStageForm({ ...stageForm, stage_code: e.target.value })} placeholder={t('estadosFenologicos.dialogs.codePlaceholder')} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.typicalDays')}</label>
              <Input type="number" min="0" value={stageForm.typical_days} onChange={(e) => setStageForm({ ...stageForm, typical_days: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('estadosFenologicos.dialogs.description')}</label>
              <Textarea value={stageForm.description} onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>{t('common.actions.cancel')}</Button>
            <Button onClick={saveStage} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {exporting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div
            className="rounded-xl border bg-card px-6 py-5 shadow-xl flex items-start gap-3 max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-5 h-5 animate-spin text-lime-600 dark:text-lime-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">{t('estadosFenologicos.export.title')}</p>
              <p className="text-xs text-muted-foreground mt-1">{exportStatus || t('estadosFenologicos.export.preparing')}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-2">
                {t('estadosFenologicos.export.waitHint')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
