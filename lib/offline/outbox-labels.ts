import type { Locale } from '@/lib/i18n/config'
import { translate } from '@/lib/i18n/translate'
import type { OutboxItem, OfflineTable } from './types'

const TABLE_KEYS: Record<OfflineTable, string> = {
  harvest_fields: 'offline.outbox.tables.harvest_fields',
  harvest_blocks: 'offline.outbox.tables.harvest_blocks',
  harvest_estimates: 'offline.outbox.tables.harvest_estimates',
  phenology_observations: 'offline.outbox.tables.phenology_observations',
  phenology_stages: 'offline.outbox.tables.phenology_stages',
  phenology_observation_images: 'offline.outbox.tables.phenology_observation_images',
}

const OP_KEYS: Record<OutboxItem['operation'], string> = {
  insert: 'offline.outbox.operations.insert',
  update: 'offline.outbox.operations.update',
  upsert: 'offline.outbox.operations.upsert',
  delete: 'offline.outbox.operations.delete',
}

export function outboxItemLabel(item: OutboxItem, locale: Locale): string {
  const p = item.payload
  const tableKey = TABLE_KEYS[item.table]
  const base = tableKey ? translate(locale, tableKey) : item.table
  const noBlock = translate(locale, 'offline.outbox.noBlock')

  if (item.table === 'harvest_estimates') {
    const block = p.block_name ? String(p.block_name) : noBlock
    const variety = p.variety ? String(p.variety) : p.crop ? String(p.crop) : ''
    return `${base}: ${block}${variety ? ` · ${variety}` : ''}`
  }

  if (item.table === 'phenology_observations') {
    const block = p.block_name ? String(p.block_name) : noBlock
    const date = p.observed_at ? String(p.observed_at) : ''
    const stage = p.stage_name ? String(p.stage_name) : ''
    return `${base}: ${block}${date ? ` · ${date}` : ''}${stage ? ` · ${stage}` : ''}`
  }

  if (item.table === 'harvest_blocks' || item.table === 'harvest_fields') {
    const name = p.block_name ?? p.name ?? p.field_name
    return name ? `${base}: ${String(name)}` : base
  }

  const op = translate(locale, OP_KEYS[item.operation])
  return `${base} (${op})`
}

export function outboxItemMeta(item: OutboxItem, locale: Locale): string {
  const parts = [translate(locale, OP_KEYS[item.operation])]
  if (item.status === 'failed') parts.push(translate(locale, 'offline.outbox.error'))
  if (item.lastError) parts.push(item.lastError.slice(0, 80))
  return parts.join(' · ')
}
