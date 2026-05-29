'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { useViewAsUserId } from '@/components/dashboard/view-as-provider'
import {
  Thermometer, TrendingUp, Bell, CheckCircle2, Loader2,
  Package, Megaphone, AlertTriangle, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WeatherData {
  daily: { temperature_2m_min: number[]; precipitation_probability_max: number[] }
}
interface CurrencyData {
  dolar: { valor: number }
}
interface InventoryWarehouse { id: string; name: string }
interface InventoryMaterial  { id: string; name: string; unit: string }
interface InventoryMovement  {
  id: string; warehouse_id: string; material_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number; unit: string; movement_date: string
}
interface InventoryMinLevel { id: string; warehouse_id: string; material_id: string; min_quantity: number }

interface AdminNotif {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  target_role?: string
}

interface Alert {
  id: string
  type: 'admin' | 'frost' | 'export' | 'inventory'
  severity: 'critical' | 'warning' | 'success' | 'info'
  title: string
  description: string
  isAdmin?: boolean
}

// ─── Style helpers ──────────────────────────────────────────────────────────────

function getAlertStyles(severity: Alert['severity'], isAdmin?: boolean) {
  if (isAdmin) {
    switch (severity) {
      case 'critical': return { bg: 'bg-rose-500/10',    border: 'border-rose-500/40',    icon: 'text-rose-500'    }
      case 'warning':  return { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   icon: 'text-amber-500'   }
      case 'success':  return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', icon: 'text-emerald-500' }
      default:         return { bg: 'bg-[#4A6CF7]/10',   border: 'border-[#4A6CF7]/40',   icon: 'text-[#4A6CF7]'   }
    }
  }
  switch (severity) {
    case 'critical': return { bg: 'bg-red-500/10',   border: 'border-red-500/30',   icon: 'text-red-500'   }
    case 'warning':  return { bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  icon: 'text-blue-500'  }
    case 'success':  return { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-500' }
    default:         return { bg: 'bg-muted',         border: 'border-border',       icon: 'text-muted-foreground' }
  }
}

function AlertIcon({ type, severity, isAdmin }: { type: Alert['type']; severity: Alert['severity']; isAdmin?: boolean }) {
  const styles = getAlertStyles(severity, isAdmin)
  const cls    = `w-5 h-5 ${styles.icon}`
  if (isAdmin) {
    switch (severity) {
      case 'critical': return <AlertTriangle className={cls} />
      case 'warning':  return <AlertTriangle className={cls} />
      case 'success':  return <CheckCircle2 className={cls} />
      default:         return <Megaphone className={cls} />
    }
  }
  switch (type) {
    case 'frost':     return <Thermometer className={cls} />
    case 'export':    return <TrendingUp className={cls} />
    case 'inventory': return <Package className={cls} />
    default:          return <Info className={cls} />
  }
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function SmartAlerts() {
  const [alerts,  setAlerts]  = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const viewAsUserId = useViewAsUserId()

  useEffect(() => {
    const supabase = createClient()
    let isMounted  = true

    async function evaluateAlerts() {
      const adminAlerts:  Alert[] = []
      const systemAlerts: Alert[] = []

      // ── 1. Broadcast notifications (role-filtered) ───────────────────────────
      try {
        // Rol de quien se está viendo (cliente en modo soporte, no el admin de sesión)
        const { userId: viewingUserId } = await getEffectiveUserId(supabase, viewAsUserId)
        let userRole = 'user'
        if (viewingUserId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', viewingUserId)
            .single()
          userRole = profile?.role ?? 'user'
        }
        const isPlatformAdmin = userRole === 'admin'

        const { data: notifs } = await supabase
          .from('admin_notifications')
          .select('id, title, message, severity, target_role')
          .lte('active_from', new Date().toISOString())
          .gte('active_until', new Date().toISOString())
          .order('created_at', { ascending: false })

        for (const n of (notifs ?? []) as AdminNotif[]) {
          const targetRole = n.target_role ?? 'admin'

          // Avisos del equipo: solo administradores de la plataforma
          const showAsTeamNotice =
            isPlatformAdmin && (targetRole === 'admin' || targetRole === 'all')

          // Mensajes a clientes: cuentas cliente (no admin)
          const showAsClientNotice =
            !isPlatformAdmin && (targetRole === 'user' || targetRole === 'all')

          if (!showAsTeamNotice && !showAsClientNotice) continue

          adminAlerts.push({
            id:          `admin:${n.id}`,
            type:        'admin',
            severity:    n.severity,
            title:       n.title,
            description: n.message,
            isAdmin:     showAsTeamNotice,
          })
        }
      } catch {
        // Silent fail
      }

      // ── 2. Weather / frost ──────────────────────────────────────────────────
      try {
        const weatherRes = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-36.79&longitude=-73.08&daily=temperature_2m_min,precipitation_probability_max&timezone=America/Santiago&forecast_days=7'
        )
        if (weatherRes.ok) {
          const weather: WeatherData = await weatherRes.json()
          if (weather.daily.temperature_2m_min.some(t => t < 3)) {
            const minTemp = Math.min(...weather.daily.temperature_2m_min)
            systemAlerts.push({
              id: 'frost', type: 'frost', severity: 'critical',
              title: 'Alerta de Helada',
              description: `Riesgo de bajas temperaturas esta semana. Mínima pronosticada: ${minTemp.toFixed(1)}°C`,
            })
          }
        }
      } catch { /* silent */ }

      // ── 3. Currency ─────────────────────────────────────────────────────────
      try {
        const currencyRes = await fetch('https://mindicador.cl/api')
        if (currencyRes.ok) {
          const currency: CurrencyData = await currencyRes.json()
          if (currency.dolar?.valor > 900) {
            systemAlerts.push({
              id: 'export', type: 'export', severity: 'success',
              title: 'Oportunidad de Exportación',
              description: `El Dólar Observado supera los $900 CLP. Valor actual: $${currency.dolar.valor.toFixed(2)}`,
            })
          }
        }
      } catch { /* silent */ }

      // ── 4. Inventory min stock ───────────────────────────────────────────────
      try {
        const { effectiveUserId } = await getEffectiveUserId(supabase)
        if (effectiveUserId) {
          const [warehouseRes, materialRes, movementRes, minLevelRes] = await Promise.all([
            supabase.from('inventory_warehouses').select('id, name').eq('user_id', effectiveUserId).order('name'),
            supabase.from('inventory_materials').select('id, name, unit').eq('user_id', effectiveUserId).order('name'),
            supabase.from('inventory_movements').select('id, warehouse_id, material_id, type, quantity, unit, movement_date').eq('user_id', effectiveUserId).order('movement_date', { ascending: false }),
            supabase.from('inventory_min_levels').select('id, warehouse_id, material_id, min_quantity').eq('user_id', effectiveUserId),
          ])

          if (!warehouseRes.error && !materialRes.error && !movementRes.error && !minLevelRes.error) {
            const warehouses = (warehouseRes.data ?? []) as InventoryWarehouse[]
            const materials  = (materialRes.data ?? [])  as InventoryMaterial[]
            const movements  = (movementRes.data ?? [])  as InventoryMovement[]
            const minLevels  = (minLevelRes.data ?? [])  as InventoryMinLevel[]

            const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]))
            const materialMap  = new Map(materials.map(m => [m.id, m]))
            const stockMap     = new Map<string, { stock: number; unit: string }>()

            for (const mv of movements) {
              const material = materialMap.get(mv.material_id)
              const unit     = mv.unit || material?.unit || '—'
              const key      = `${mv.warehouse_id}:${mv.material_id}`
              const existing = stockMap.get(key) ?? { stock: 0, unit }
              existing.stock += mv.type === 'salida' ? -(Number(mv.quantity) || 0) : (Number(mv.quantity) || 0)
              existing.unit   = unit
              stockMap.set(key, existing)
            }

            for (const level of minLevels) {
              const key  = `${level.warehouse_id}:${level.material_id}`
              const info = stockMap.get(key)
              if (!info) continue
              if (info.stock <= level.min_quantity) {
                systemAlerts.push({
                  id: `inventory:${level.warehouse_id}:${level.material_id}`,
                  type: 'inventory', severity: 'critical',
                  title: 'Stock en mínimo',
                  description: `${materialMap.get(level.material_id)?.name ?? 'Material'} en ${warehouseMap.get(level.warehouse_id) ?? 'Bodega'}: ${info.stock} ${info.unit} (mínimo ${level.min_quantity}).`,
                })
              }
            }
          }
        }
      } catch { /* silent */ }

      if (isMounted) {
        // Admin alerts first, then system alerts
        setAlerts([...adminAlerts, ...systemAlerts])
        setLoading(false)
      }
    }

    evaluateAlerts()
    return () => { isMounted = false }
  }, [viewAsUserId])

  const adminCount = alerts.filter(a => a.isAdmin).length

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Centro de Notificaciones</h3>
        {adminCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4A6CF7]/15 text-[#4A6CF7] border border-[#4A6CF7]/30">
            <Megaphone className="w-2.5 h-2.5" />
            {adminCount} aviso{adminCount !== 1 ? 's' : ''} admin
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-3 py-6 px-4 bg-muted/50 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-muted-foreground">No hay alertas críticas en este momento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Client broadcast messages (from UpCrop to clients) */}
          {alerts.filter(a => a.isAdmin === false && a.type === 'admin').length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Mensajes de UpCrop</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              {alerts.filter(a => a.isAdmin === false && a.type === 'admin').map(alert => {
                const styles = getAlertStyles(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border',
                      styles.bg, styles.border,
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      <AlertIcon type={alert.type} severity={alert.severity} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Team notices — platform admins only */}
          {adminCount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-[#4A6CF7]" />
                <span className="text-xs font-semibold text-[#4A6CF7] uppercase tracking-wide">Avisos del equipo</span>
                <div className="h-px flex-1 bg-[#4A6CF7]/20" />
              </div>
              {alerts.filter(a => a.isAdmin).map(alert => {
                const styles = getAlertStyles(alert.severity, true)
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border-2',
                      styles.bg, styles.border
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      <AlertIcon type={alert.type} severity={alert.severity} isAdmin />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* System alerts section */}
          {alerts.filter(a => a.type !== 'admin').length > 0 && (
            <>
              {(adminCount > 0 || alerts.some(a => a.type === 'admin' && !a.isAdmin)) && (
                <div className="flex items-center gap-2 mt-1">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alertas automáticas</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {alerts.filter(a => a.type !== 'admin').map(alert => {
                const styles = getAlertStyles(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${styles.bg} ${styles.border}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <AlertIcon type={alert.type} severity={alert.severity} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
