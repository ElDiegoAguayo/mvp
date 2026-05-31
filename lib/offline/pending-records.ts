import type { OutboxItem } from './types'
import { isLocalRecordId } from './types'

export function collectPendingRecordIds(items: OutboxItem[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.localRecordId) ids.add(item.localRecordId)
    if (item.match?.id) ids.add(String(item.match.id))
  }
  return ids
}

export function isRecordPendingSync(
  recordId: string,
  pendingIds: Set<string>,
): boolean {
  if (isLocalRecordId(recordId)) return true
  return pendingIds.has(recordId)
}
