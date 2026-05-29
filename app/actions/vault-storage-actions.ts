'use server'

import { getMyClientStorageAction, type ClientStorageInfo } from '@/app/actions/client-storage-actions'
import type { VaultStorageInfo } from '@/app/actions/vault-documents-actions'

export type { ClientStorageInfo, VaultStorageInfo }

export async function getMyVaultStorageAction(): Promise<ClientStorageInfo | null> {
  return getMyClientStorageAction()
}
