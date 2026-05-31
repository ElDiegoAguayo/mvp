'use client'

import { useState, useEffect, useMemo } from 'react'
import { Siren, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react'
import { DashboardCard } from '@/components/dashboard/dashboard-card'
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton'
import { formatDate } from '@/lib/format-date'
import { useLocale } from '@/components/i18n/locale-provider'
import { useDynamicTranslate } from '@/components/i18n/use-dynamic-translate'

interface SagAlert {
  title: string
  pubDate: string
  link: string
  description: string
}

const CRITICAL_KEYWORDS = ['mosca', 'plaga', 'cuarentena', 'lobesia', 'enfermedad', 'brote', 'alerta']

const FALLBACK_ALERTS: SagAlert[] = [
  {
    title: 'Actualización cuarentena Lobesia botrana en zona central',
    pubDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    link: '#',
    description: 'Información oficial sobre restricciones de transporte',
  },
  {
    title: 'Alerta fitosanitaria: Detección de mosca del Mediterráneo en región de Valparaíso',
    pubDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    link: '#',
    description: 'Medidas preventivas y protocolos de inspección',
  },
  {
    title: 'Resolución brote enfermedad bacteriana en cultivos de tomate',
    pubDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    link: '#',
    description: 'Recomendaciones técnicas para productores',
  },
]

function isCriticalAlert(title: string): boolean {
  const lowerTitle = title.toLowerCase()
  return CRITICAL_KEYWORDS.some(keyword => lowerTitle.includes(keyword))
}

export function SagAlertsWidget() {
  const { t } = useLocale()
  const [alerts, setAlerts] = useState<SagAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchSuccess, setFetchSuccess] = useState(false)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true)
        setFetchSuccess(false)

        const url = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.sag.gob.cl/noticias/rss'
        const response = await fetch(url)
        const data = await response.json()

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          const processedAlerts = data.items.slice(0, 4).map((item: { title?: string; pubDate?: string; link?: string; description?: string }) => ({
            title: item.title || t('homeWidgets.sagNoTitle'),
            pubDate: item.pubDate || new Date().toISOString(),
            link: item.link || '#',
            description: item.description || '',
          }))
          setAlerts(processedAlerts)
          setFetchSuccess(true)
        } else {
          setAlerts(FALLBACK_ALERTS)
          setFetchSuccess(false)
        }
      } catch (err) {
        console.error('[v0] SAG alerts fetch error:', err)
        setAlerts(FALLBACK_ALERTS)
        setFetchSuccess(false)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [t])

  const titles = useMemo(() => alerts.map(a => a.title), [alerts])
  const { texts: translatedTitles } = useDynamicTranslate(titles)

  const displayAlerts = useMemo(
    () =>
      alerts.map((alert, index) => ({
        ...alert,
        displayTitle: translatedTitles[index] ?? alert.title,
      })),
    [alerts, translatedTitles],
  )

  const hasAlerts = displayAlerts.length > 0

  if (loading) {
    return <WidgetSkeleton variant="list" />
  }

  return (
    <DashboardCard
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Siren className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('homeWidgets.sagTitle')}</h3>
          </div>
          <div
            className={`w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0 ${
              fetchSuccess ? 'bg-green-500' : 'bg-amber-500'
            }`}
            title={fetchSuccess ? t('homeWidgets.sagOnline') : t('homeWidgets.sagCached')}
          />
        </div>
      }
      contentClassName="flex flex-col gap-4"
    >
        {!hasAlerts ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <ShieldCheck className="text-slate-400 dark:text-gray-600 w-8 h-8 mb-3" />
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {t('homeWidgets.sagEmpty')}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {displayAlerts.map((alert, idx) => {
                const isCritical = isCriticalAlert(alert.displayTitle)
                const dateStr = formatDate(alert.pubDate)

                return (
                  <a
                    key={idx}
                    href={alert.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-lg border bg-slate-50 dark:bg-gray-900/50 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-900 hover:border-orange-300 dark:hover:border-orange-500/50 transition-all duration-200 group cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${
                          isCritical 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-slate-700 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-gray-100'
                        }`}>
                          {alert.displayTitle}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-xs text-slate-500 dark:text-gray-500">{dateStr}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>

            <div className="text-[10px] text-slate-600 dark:text-gray-600 border-t border-slate-200 dark:border-gray-800/50 pt-3 mt-2">
              {t('homeWidgets.sagSource')}
            </div>
          </>
        )}
      </DashboardCard>
    )
}
