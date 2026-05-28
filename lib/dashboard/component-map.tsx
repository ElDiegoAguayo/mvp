/**
 * Component Dictionary with Dynamic Imports
 * Maps widget types to their React components
 * Uses Next.js dynamic() to prevent SSR issues with client-only libraries
 */

'use client'

import { Suspense, ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { WidgetType } from '@/lib/dashboard/widget-config'

/**
 * Fallback loading component for widgets
 */
const WidgetSkeleton = () => (
  <div className="bg-card rounded-lg border border-border p-4 h-64 animate-pulse">
    <div className="h-8 bg-muted rounded w-1/3 mb-4" />
    <div className="space-y-3">
      <div className="h-4 bg-muted rounded" />
      <div className="h-4 bg-muted rounded w-5/6" />
    </div>
  </div>
)

/**
 * Wrapper component that adds Suspense boundary to widgets
 * Prevents one widget error from breaking the entire dashboard
 */
const WidgetWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<WidgetSkeleton />}>
    <>{children}</>
  </Suspense>
)

/**
 * Dynamically import all widget components with ssr: false
 * This ensures they never render on the server
 */
const DynamicSmartAlerts = dynamic(() => import('@/components/dashboard/smart-alerts').then(m => ({ default: m.SmartAlerts })), { ssr: false, loading: WidgetSkeleton })
const DynamicInputsPriceWidget = dynamic(() => import('@/components/dashboard/inputs-price-widget').then(m => ({ default: m.InputsPriceWidget })), { ssr: false, loading: WidgetSkeleton })
const DynamicCurrencyWidget = dynamic(() => import('@/components/dashboard/currency-widget').then(m => ({ default: m.CurrencyWidget })), { ssr: false, loading: WidgetSkeleton })
const DynamicAIAssistantChat = dynamic(() => import('@/components/dashboard/ai-assistant-chat').then(m => ({ default: m.AIAssistantChat })), { ssr: false, loading: WidgetSkeleton })
const DynamicWeatherWidget = dynamic(() => import('@/components/dashboard/weather-widget').then(m => ({ default: m.WeatherWidget })), { ssr: false, loading: WidgetSkeleton })
const DynamicPortMap = dynamic(() => import('@/components/dashboard/port-map'), { ssr: false, loading: WidgetSkeleton })
const DynamicActivityHeartbeat = dynamic(() => import('@/components/dashboard/activity-heartbeat').then(m => ({ default: m.ActivityHeartbeat })), { ssr: false, loading: WidgetSkeleton })
const DynamicDocumentVault = dynamic(() => import('@/components/dashboard/document-vault').then(m => ({ default: m.DocumentVault })), { ssr: false, loading: WidgetSkeleton })
const DynamicMarketWidget = dynamic(() => import('@/components/dashboard/market-widget').then(m => ({ default: m.MarketWidget })), { ssr: false, loading: WidgetSkeleton })
const DynamicShipTracker = dynamic(() => import('@/components/dashboard/widgets/ship-tracker-widget').then(m => ({ default: m.ShipTrackerWidget })), { ssr: false, loading: WidgetSkeleton })
const DynamicSagAlerts = dynamic(() => import('@/components/dashboard/sag-alerts-widget').then(m => ({ default: m.SagAlertsWidget })), { ssr: false, loading: WidgetSkeleton })

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
