'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarUserFooter } from '@/components/dashboard/sidebar-user-footer'
import { getModuleIcon, getIconShape, getIconSize, resolveIconStyle, resolveTextStyle, resolveIconContainerStyle } from '@/lib/module-icons'
import { GlobalAIAssistant } from '@/components/dashboard/global-ai-assistant'
import { AdminPanelNavLink, AdminSectionLabel } from '@/components/dashboard/admin-panel-nav-link'
import { OfflineProvider } from '@/components/dashboard/offline-provider'
import { OfflineBanner } from '@/components/dashboard/offline-banner'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useLocale } from '@/components/i18n/locale-provider'
import { isModuleRouteActive, resolveModuleHref } from '@/lib/dashboard/module-routes'
import { groupModulesByArea, type ModuleArea } from '@/lib/modules/areas'
import { cn } from '@/lib/utils'
import {
  Menu,
  X,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface ShellUser {
  id: string
  email: string | null
  full_name: string
  role: string
  avatar_url?: string | null
}

interface ShellModule {
  id: string
  slug: string
  name: string
  icon: string
  color?: string | null
  text_color?: string | null
  icon_shape?: string | null
  icon_size?: string | null
  icon_style?: string | null
  menu_badge?: string | null
  description: string | null
  area_id?: string | null
  area?: ModuleArea | null
}

interface DashboardShellProps {
  user: ShellUser
  modules: ShellModule[]
  children: React.ReactNode
  isSupportMode?: boolean
  adminRole?: boolean
  supportBanner?: React.ReactNode
}

export function DashboardShell({
  user,
  modules,
  children,
  isSupportMode = false,
  adminRole = false,
  supportBanner,
}: DashboardShellProps) {
  const pathname = usePathname()
  const { t, tArea, tModule } = useLocale()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isAdmin = adminRole || user.role === 'admin'
  const adminActive = pathname.startsWith('/admin')
  const moduleGroups = useMemo(() => groupModulesByArea(modules), [modules])

  const renderModuleLink = (m: ShellModule, onNavigate?: () => void, compact = collapsed) => {
    const Icon = getModuleIcon(m.icon)
    const shapeCfg = getIconShape(m.icon_shape)
    const sizeCfg = getIconSize(m.icon_size)
    const iconContainer = resolveIconContainerStyle(m.color, shapeCfg.className, m.icon_style)
    const iconStyle = resolveIconStyle(m.color, m.icon_style)
    const textStyle = resolveTextStyle(m.text_color ?? null, m.color)
    const href = resolveModuleHref(m.slug, m.name)
    const active = isModuleRouteActive(pathname, m.slug, m.name)
    const moduleLabel = tModule(m.slug, m.name)
    return (
      <Link
        key={m.id}
        href={href}
        onClick={onNavigate}
        title={compact ? moduleLabel : m.description ?? moduleLabel}
        className={cn(
          'flex items-center rounded-lg text-sm transition-colors',
          compact ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2',
          active ? 'bg-secondary/60' : 'hover:bg-secondary',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center',
            sizeCfg.container,
            iconContainer.className,
          )}
          style={iconContainer.style}
        >
          <Icon
            className={cn('shrink-0', sizeCfg.icon, iconStyle.className)}
            style={iconStyle.style}
          />
        </div>
        {!compact && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'truncate font-medium',
                textStyle.className,
                !textStyle.style && !active && 'text-muted-foreground',
              )}
              style={textStyle.style}
            >
              {moduleLabel}
            </span>
            {m.menu_badge ? (
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                {m.menu_badge}
              </span>
            ) : null}
          </div>
        )}
      </Link>
    )
  }

  // Persist collapsed state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  return (
    <OfflineProvider userId={user.id}>
    <div className="h-screen bg-background bg-grid flex">
      {/* Desktop sidebar - collapsible */}
      <aside
        className={`hidden lg:flex lg:flex-col h-screen shrink-0 bg-card border-r border-border sticky left-0 top-0 transition-[width] duration-300 ease-in-out ${
          collapsed ? 'lg:w-16' : 'lg:w-64'
        }`}
      >
        <div
          className={`h-16 flex items-center border-b border-border shrink-0 ${
            collapsed ? 'flex-col justify-center gap-1.5 py-2 px-1' : 'px-4 gap-2'
          }`}
        >
          <div className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-3 flex-1')}>
            <Image
              src="/logo-upcrop.png"
              alt="Up Crop"
              width={32}
              height={32}
              className="rounded-lg shrink-0"
            />
            {!collapsed && (
              <span className="text-xl font-bold text-foreground truncate">
                Up <span className="text-primary">Crop</span>
              </span>
            )}
          </div>
          <LanguageSwitcher compact={collapsed} className={collapsed ? 'scale-[0.85]' : 'shrink-0'} />
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('shell.expandMenu') : t('shell.collapseMenu')}
          className="absolute top-5 -right-3 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors shadow-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1">
          <Link
            href="/dashboard"
            title={collapsed ? t('shell.home') : undefined}
            className={`flex items-center rounded-lg text-sm transition-colors ${
              collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'
            } ${
              pathname === '/dashboard'
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{t('shell.home')}</span>}
          </Link>

          {!collapsed && modules.length > 0 && <div className="pt-3" />}
          {collapsed && modules.length > 0 && <div className="pt-2" />}

          {modules.length === 0 ? (
            !collapsed && (
              <p className="text-xs text-muted-foreground px-3 py-2">
                {t('shell.noModules')}
              </p>
            )
          ) : collapsed ? (
            moduleGroups.flatMap((group) => group.modules.map((m) => renderModuleLink(m)))
          ) : (
            moduleGroups.map((group) => (
              <div key={group.area.id} className="mb-1">
                <div className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {tArea(group.area.name)}
                  </p>
                </div>
                {group.modules.map((m) => renderModuleLink(m))}
              </div>
            ))
          )}

          {isAdmin && (
            <>
              <AdminSectionLabel collapsed={collapsed} />
              <AdminPanelNavLink collapsed={collapsed} active={adminActive} />
            </>
          )}
        </nav>

        {/* User info fixed at bottom - collapsible */}
        <div className={`border-t border-border shrink-0 ${collapsed ? 'p-2' : 'p-3'}`}>
          <SidebarUserFooter user={user} collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <aside className="w-full h-full bg-card border-r border-border flex flex-col overflow-hidden">
              <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-border shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src="/logo-upcrop.png"
                    alt="Up Crop"
                    width={32}
                    height={32}
                    className="rounded-lg shrink-0"
                  />
                  <span className="text-xl font-bold text-foreground truncate">
                    Up <span className="text-primary">Crop</span>
                  </span>
                </div>
                <LanguageSwitcher compact />
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname === '/dashboard'
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('shell.home')}
                </Link>

                {modules.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">{t('shell.noModules')}</p>
                ) : (
                  moduleGroups.map((group) => (
                    <div key={group.area.id}>
                      <div className="pt-3 pb-1 px-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {tArea(group.area.name)}
                        </p>
                      </div>
                      {group.modules.map((m) => renderModuleLink(m, () => setMobileOpen(false), false))}
                    </div>
                  ))
                )}

                {isAdmin && (
                  <>
                    <AdminSectionLabel />
                    <AdminPanelNavLink active={adminActive} onClick={() => setMobileOpen(false)} />
                  </>
                )}
              </nav>

              <div className="border-t border-border p-3 shrink-0">
                <SidebarUserFooter user={user} onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {supportBanner}
        <OfflineBanner userId={user.id} />
        {/* Mobile top bar */}
        <header className="lg:hidden border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <div className="h-16 px-4 flex items-center justify-between">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary text-foreground"
              aria-label={t('shell.openMenu')}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Image
                src="/logo-upcrop.png"
                alt="Up Crop"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="font-bold text-foreground">
                Up <span className="text-primary">Crop</span>
              </span>
            </div>
            <LanguageSwitcher compact />
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Close drawer button when open */}
      {mobileOpen && (
        <button
          className="fixed top-4 right-4 z-50 lg:hidden p-2 rounded-lg bg-card border border-border text-foreground"
          onClick={() => setMobileOpen(false)}
          aria-label={t('shell.closeMenu')}
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <GlobalAIAssistant />
    </div>
    </OfflineProvider>
  )
}
