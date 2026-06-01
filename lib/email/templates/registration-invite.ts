import { BRAND_NAME } from '@/lib/brand'
import { resolveSiteUrl } from '@/lib/auth/site-url'

export type RegistrationEmailVariant = 'invite' | 'welcome'

export type RegistrationInviteTemplateInput = {
  actionLink: string
  recipientEmail: string
  recipientName?: string | null
  variant: RegistrationEmailVariant
}

const BRAND_PRIMARY = '#4063ca'
const BRAND_PRIMARY_DARK = '#2e4ba0'
const TEXT_MUTED = '#64748b'
const SURFACE = '#f8fafc'

function greeting(name?: string | null): string {
  const trimmed = name?.trim()
  return trimmed ? `Hola, ${trimmed}` : 'Hola'
}

function copyForVariant(variant: RegistrationEmailVariant): {
  subject: string
  headline: string
  body: string
  cta: string
  footnote: string
} {
  if (variant === 'welcome') {
    return {
      subject: `Define tu acceso a ${BRAND_NAME}`,
      headline: 'Tu cuenta está lista',
      body: 'Ya tienes acceso a la plataforma. Haz clic en el botón para crear tu contraseña personal y entrar al dashboard.',
      cta: 'Crear mi contraseña',
      footnote: 'Este enlace es personal. Si no solicitaste acceso, puedes ignorar este correo.',
    }
  }

  return {
    subject: `Te invitaron a ${BRAND_NAME}`,
    headline: 'Bienvenido a Up Crop',
    body: 'Fuiste invitado a la plataforma para exportadores agrícolas. Activa tu cuenta con el botón de abajo, elige tu contraseña y completa tu perfil.',
    cta: 'Activar mi cuenta',
    footnote: 'Si no esperabas esta invitación, puedes ignorar este mensaje con tranquilidad.',
  }
}

export function buildRegistrationInviteSubject(
  input: Pick<RegistrationInviteTemplateInput, 'variant'>,
): string {
  return copyForVariant(input.variant).subject
}

export function buildRegistrationInviteHtml(
  input: RegistrationInviteTemplateInput,
): string {
  const copy = copyForVariant(input.variant)
  const siteUrl = resolveSiteUrl()
  const logoUrl = `${siteUrl}/branding/logo-horizontal.png`
  const greetingLine = greeting(input.recipientName)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef2f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_PRIMARY_DARK} 100%);">
              <img src="${logoUrl}" alt="${BRAND_NAME}" width="168" style="display:block;max-width:168px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_PRIMARY};">${BRAND_NAME}</p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:700;color:#0f172a;">${copy.headline}</h1>
              <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#334155;">${greetingLine},</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#334155;">${copy.body}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:999px;background:${BRAND_PRIMARY};">
                    <a href="${input.actionLink}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${copy.cta}</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:${SURFACE};border:1px solid #e2e8f0;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.06em;">Correo de acceso</p>
                    <p style="margin:0;font-size:15px;color:#0f172a;">${input.recipientEmail}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">${copy.footnote}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">Si el botón no funciona, copia y pega este enlace en tu navegador:<br /><a href="${input.actionLink}" style="color:${BRAND_PRIMARY};word-break:break-all;">${input.actionLink}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};text-align:center;">© ${year} ${BRAND_NAME}. Plataforma para exportadores agrícolas.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildRegistrationInviteText(
  input: RegistrationInviteTemplateInput,
): string {
  const copy = copyForVariant(input.variant)
  const greetingLine = greeting(input.recipientName)

  return `${copy.headline}

${greetingLine},

${copy.body}

${copy.cta}: ${input.actionLink}

Correo de acceso: ${input.recipientEmail}

${copy.footnote}
`
}
