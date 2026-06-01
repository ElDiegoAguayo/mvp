import { BRAND_NAME } from '@/lib/brand'

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null
}

export function getResendFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (from) return from
  return `${BRAND_NAME} <onboarding@resend.dev>`
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey())
}
