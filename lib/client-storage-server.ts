import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { formatQuotaLimit } from '@/lib/vault-storage'
import { parseClientStorageRpc, type ClientStorageInfo } from '@/lib/client-storage'

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function fetchClientStorageForUser(actingUserId: string): Promise<ClientStorageInfo | null> {
  const service = getServiceClient()
  if (!service) return null

  const { data, error } = await service.rpc('get_client_storage_for_user', {
    p_user_id: actingUserId,
  })

  if (error) {
    console.error('[client-storage] rpc failed:', error.message)
    return null
  }

  const parsed = parseClientStorageRpc(data)
  if (!parsed) return null

  return {
    ...parsed,
    quotaLabel: formatQuotaLimit(parsed.quotaBytes),
  }
}
