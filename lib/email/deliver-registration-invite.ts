import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getResendApiKey, getResendFromAddress } from '@/lib/email/config'
import {
  buildRegistrationInviteHtml,
  buildRegistrationInviteSubject,
  buildRegistrationInviteText,
  type RegistrationEmailVariant,
} from '@/lib/email/templates/registration-invite'

export type DeliverRegistrationInviteInput = {
  adminClient: SupabaseClient
  email: string
  redirectTo: string
  linkType: 'invite' | 'recovery'
  variant: RegistrationEmailVariant
  recipientName?: string | null
}

export type DeliverRegistrationInviteResult =
  | { ok: true; userId: string }
  | { ok: false; message: string }

async function sendWithResend(input: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    return {
      ok: false,
      message:
        'Falta RESEND_API_KEY en el servidor. Configúrala en Vercel para enviar invitaciones personalizadas.',
    }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: getResendFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

export async function deliverRegistrationInvite(
  input: DeliverRegistrationInviteInput,
): Promise<DeliverRegistrationInviteResult> {
  const email = input.email.trim().toLowerCase()
  if (!email) {
    return { ok: false, message: 'El correo es obligatorio.' }
  }

  const { data, error } = await input.adminClient.auth.admin.generateLink({
    type: input.linkType,
    email,
    options: {
      redirectTo: input.redirectTo,
    },
  })

  if (error || !data.user) {
    const message = error?.message ?? 'No se pudo generar el enlace de invitación.'
    if (
      message.toLowerCase().includes('already registered') ||
      message.toLowerCase().includes('exists')
    ) {
      return { ok: false, message: 'Ya existe un usuario con ese email.' }
    }
    return { ok: false, message }
  }

  const actionLink = data.properties?.action_link
  if (!actionLink) {
    return { ok: false, message: 'Supabase no devolvió un enlace de activación válido.' }
  }

  const templateInput = {
    actionLink,
    recipientEmail: email,
    recipientName: input.recipientName,
    variant: input.variant,
  }

  const sent = await sendWithResend({
    to: email,
    subject: buildRegistrationInviteSubject(templateInput),
    html: buildRegistrationInviteHtml(templateInput),
    text: buildRegistrationInviteText(templateInput),
  })

  if (!sent.ok) {
    return { ok: false, message: sent.message }
  }

  return { ok: true, userId: data.user.id }
}
