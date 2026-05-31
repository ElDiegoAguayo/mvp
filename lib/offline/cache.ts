import { getOfflineDb } from './db'
import type { CatalogCacheEntry } from './types'

export function harvestCacheKey(userId: string) {
  return `harvest:${userId}`
}

export function phenologyCacheKey(userId: string) {
  return `phenology:${userId}`
}

export async function getCatalogCache<T>(key: string): Promise<T | null> {
  const entry = await getOfflineDb().catalogCache.get(key)
  return (entry?.data as T) ?? null
}

export async function setCatalogCache(
  key: string,
  userId: string,
  module: CatalogCacheEntry['module'],
  data: unknown,
): Promise<void> {
  await getOfflineDb().catalogCache.put({
    key,
    userId,
    module,
    data,
    updatedAt: Date.now(),
  })
}

export async function patchCatalogCache<T extends Record<string, unknown[]>>(
  key: string,
  userId: string,
  module: CatalogCacheEntry['module'],
  patch: Partial<T>,
): Promise<void> {
  const existing = (await getCatalogCache<T>(key)) ?? ({} as T)
  const merged = { ...existing, ...patch }
  await setCatalogCache(key, userId, module, merged)
}
