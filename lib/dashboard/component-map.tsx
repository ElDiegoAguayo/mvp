/**
 * Component Dictionary with Dynamic Imports
 * Maps widget types to their React components
 * Uses Next.js dynamic() to prevent SSR issues with client-only libraries
 */

'use client'

import { Suspense, ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { WidgetType } from '@/lib/dashboard/widget-config'
import { WidgetSkeleton } from '@/components/dashboard/widget-skeleton'

/**
 * Fallback loading component for widgets (dynamic import + Suspense)
 */
const DynamicWidgetSkeleton = () => <WidgetSkeleton />

/**
 * Wrapper component that adds Suspense boundary to widgets
 * Prevents one widget error from breaking the entire dashboard
 */
const WidgetWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<DynamicWidgetSkeleton />}>
    <>{children}</>
  </Suspense>
)

/**
 * Dynamically import all widget components with ssr: false
 * This ensures they never render on the server
 */
const DynamicSmartAlerts = dynamic(() => import('@/components/dashboard/smart-alerts').then(m => ({ default: m.SmartAlerts })), { ssr: false, loading: () => <WidgetSkeleton variant="alerts" minHeight="lg" /> })
const DynamicInputsPriceWidget = dynamic(() => import('@/components/dashboard/inputs-price-widget').then(m => ({ default: m.InputsPriceWidget })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicCurrencyWidget = dynamic(() => import('@/components/dashboard/currency-widget').then(m => ({ default: m.CurrencyWidget })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicAIAssistantChat = dynamic(() => import('@/components/dashboard/ai-assistant-chat').then(m => ({ default: m.AIAssistantChat })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicWeatherWidget = dynamic(() => import('@/components/dashboard/weather-widget').then(m => ({ default: m.WeatherWidget })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicPortMap = dynamic(() => import('@/components/dashboard/port-map'), { ssr: false, loading: () => <WidgetSkeleton variant="map" /> })
const DynamicActivityHeartbeat = dynamic(() => import('@/components/dashboard/activity-heartbeat').then(m => ({ default: m.ActivityHeartbeat })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicDocumentVault = dynamic(() => import('@/components/dashboard/document-vault').then(m => ({ default: m.DocumentVault })), { ssr: false, loading: () => <WidgetSkeleton variant="list" minHeight="lg" /> })
const DynamicMarketWidget = dynamic(() => import('@/components/dashboard/market-widget').then(m => ({ default: m.MarketWidget })), { ssr: false, loading: DynamicWidgetSkeleton })
const DynamicShipTracker = dynamic(() => import('@/components/dashboard/widgets/ship-tracker-widget').then(m => ({ default: m.ShipTrackerWidget })), { ssr: false, loading: () => <WidgetSkeleton variant="map" minHeight="lg" /> })
const DynamicSagAlerts = dynamic(() => import('@/components/dashboard/sag-alerts-widget').then(m => ({ default: m.SagAlertsWidget })), { ssr: false, loading: () => <WidgetSkeleton variant="list" /> })

/**
 * Component Map: Maps widget type strings to actual React components
 * All components use dynamic imports with ssr: false to prevent server-side rendering
 */
export const COMPONENT_MAP: Record<WidgetType, ComponentType<any>> = {
  'smart-alerts': DynamicSmartAlerts,
  'inputs-price': DynamicInputsPriceWidget,
  'currency': DynamicCurrencyWidget,
  'ai-assistant': DynamicAIAssistantChat,
  'weather': DynamicWeatherWidget,
  'port-map': DynamicPortMap,
  'activity-heartbeat': DynamicActivityHeartbeat,
  'document-vault': DynamicDocumentVault,
  'market': DynamicMarketWidget,
  'ship-tracker': DynamicShipTracker,
  'sag-alerts': DynamicSagAlerts,
}

/**
 * Pre-wrapped stable components (created once at module load)
 * Prevents new function creation on every render, avoiding widget remounts
 */
const WRAPPED_COMPONENTS: Record<WidgetType, ComponentType<any>> = Object.fromEntries(
  Object.entries(COMPONENT_MAP).map(([type, Comp]) => [
    type,
    (props: Record<string, unknown>) => (
      <WidgetWrapper>
        <Comp {...props} />
      </WidgetWrapper>
    ),
  ])
) as Record<WidgetType, ComponentType<any>>

/**
 * Utility function to get a widget component with Suspense wrapper
 * Returns a stable component reference (memoized at load time)
 * Returns null if the widget type is not found
 */
export function getWidgetComponent(
  widgetType: WidgetType,
): ComponentType<any> | null {
  return WRAPPED_COMPONENTS[widgetType] ?? null
}

/**
 * Get all registered widget types
 */
export function getAvailableWidgetTypes(): WidgetType[] {
  return Object.keys(COMPONENT_MAP) as WidgetType[]
}
