import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggleFloat } from '@/components/theme-toggle-float'
import { ActivityHeartbeat } from '@/components/dashboard/activity-heartbeat'
import { LocaleProvider } from '@/components/i18n/locale-provider'
import { defaultLocale, isLocale, LOCALE_COOKIE } from '@/lib/i18n/config'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: 'Up Crop',
    template: '%s · Up Crop',
  },
  description:
    'Plataforma Up Crop para exportadores agrícolas. Monitoree operaciones, costos, cosecha y documentación en un solo lugar.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const initialLocale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return (
    <html lang={initialLocale} className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider initialLocale={initialLocale}>
            <ActivityHeartbeat />
            {children}
            <ThemeToggleFloat />
            <Toaster theme="dark" position="top-right" richColors closeButton />
          </LocaleProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
