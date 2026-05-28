'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { resolveClientIp, resolveClientIpOrUnknown } from '@/lib/client-ip'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 60

function createAuthSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookies()).getAll(),
        setAll: async (cookiesToSet) => {
          const cookieStore = await cookies()
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    },
  )
}

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Resolve client IP on the server (single source of truth for login security). */
export async function getLoginClientIpAction(): Promise<string> {
  return resolveClientIpOrUnknown(await resolveClientIp())
}

/**
 * Check if an IP is manually blocked by an admin.
 * Uses service role because blocked_ips RLS is admin-only.
 */
export async function checkIpBlocked(ipAddress: string): Promise<{
  blocked: boolean
  reason?: string | null
}> {
  const ip = ipAddress?.trim()
  if (!ip || ip === 'unknown') return { blocked: false }

  const admin = getServiceClient()
  if (!admin) return { blocked: false }

  const { data, error } = await admin
    .from('blocked_ips')
    .select('reason')
    .eq('ip_address', ip)
    .maybeSingle()

  if (error || !data) return { blocked: false }
  return { blocked: true, reason: data.reason }
}

/**
 * Check if an email/IP combination is currently locked out due to failed attempts.
 */
export async function checkLoginLockout(
  rawEmail: string,
  ipAddress: string,
): Promise<{
  isBlocked: boolean
  remainingMinutes: number
  error?: string
}> {
  try {
    const email = rawEmail.toLowerCase().trim()

    if (!email || !ipAddress) {
      console.warn('[v0] Invalid email or IP for lockout check')
      return { isBlocked: false, remainingMinutes: 0 }
    }

    const supabase = createAuthSupabase()
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: countData, error: countError } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: false })
      .eq('email', email)
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gte('attempted_at', hourAgo)

    if (countError) {
      console.error('[v0] Error counting login attempts:', countError.message)
      return { isBlocked: false, remainingMinutes: 0 }
    }

    const failedAttemptCount = (countData || []).length

    if (failedAttemptCount < MAX_LOGIN_ATTEMPTS) {
      return { isBlocked: false, remainingMinutes: 0 }
    }

    const { data: firstAttempt, error: firstError } = await supabase
      .from('login_attempts')
      .select('attempted_at')
      .eq('email', email)
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gte('attempted_at', hourAgo)
      .order('attempted_at', { ascending: true })
      .limit(1)
      .single()

    if (firstError || !firstAttempt) {
      return { isBlocked: true, remainingMinutes: 60, error: 'Acceso bloqueado. Demasiados intentos fallidos.' }
    }

    const firstAttemptTime = new Date(firstAttempt.attempted_at).getTime()
    const lockoutExpiresTime = firstAttemptTime + LOCKOUT_DURATION_MINUTES * 60 * 1000
    const nowTime = Date.now()

    if (nowTime >= lockoutExpiresTime) {
      return { isBlocked: false, remainingMinutes: 0 }
    }

    const remainingMinutes = Math.ceil((lockoutExpiresTime - nowTime) / (60 * 1000))

    return {
      isBlocked: true,
      remainingMinutes,
      error: `Acceso bloqueado por demasiados intentos fallidos (5+ intentos). Intenta de nuevo en ${remainingMinutes} minuto${remainingMinutes !== 1 ? 's' : ''}.`,
    }
  } catch (error) {
    console.error('[v0] Login lockout check error:', error instanceof Error ? error.message : error)
    return { isBlocked: false, remainingMinutes: 0 }
  }
}

/** Record a login attempt (failed or successful). */
export async function recordLoginAttempt(
  rawEmail: string,
  ipAddress: string,
  userAgent: string,
  success: boolean,
): Promise<void> {
  try {
    const email = rawEmail.toLowerCase().trim()
    const supabase = createAuthSupabase()

    const { error } = await supabase.from('login_attempts').insert({
      email,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
    })

    if (error) {
      console.error('[v0] Error recording login attempt:', error.message)
    }
  } catch (error) {
    console.error('[v0] Record login attempt error:', error instanceof Error ? error.message : error)
  }
}

/** Log security event in audit logs. */
export async function auditSecurityEvent(
  actor_email: string,
  actor_name: string,
  action_type: string,
  description: string,
  ip_address: string,
  user_agent: string,
): Promise<void> {
  try {
    const supabase = createAuthSupabase()

    const { error } = await supabase.from('audit_logs').insert({
      actor_email,
      actor_name,
      actor_kind: 'anonymous',
      action_type,
      description,
      target_type: 'AUTH',
      target_label: actor_email,
      metadata: {
        ip_address,
        user_agent,
      },
    })

    if (error) {
      console.error('[v0] Error auditing security event:', error)
    }
  } catch (error) {
    console.error('[v0] Audit security event error:', error)
  }
}
