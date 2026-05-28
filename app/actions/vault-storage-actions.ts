'use server'

import { getMyVaultDataAction, type VaultStorageInfo } from '@/app/actions/vault-documents-actions'

export type { VaultStorageInfo }

export async function getMyVaultStorageAction(): Promise<VaultStorageInfo | null> {
  const data = await getMyVaultDataAction()
  return data?.storage ?? null
}
