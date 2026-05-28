'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { getModuleIcon, getIconShape, resolveIconStyle, resolveTextStyle, resolveIconContainerStyle } from '@/lib/module-icons'
import { cn } from '@/lib/utils'
import {
  Shield,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
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
  description: string | null
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [userMenuOpenMobile, setUserMenuOpenMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isAdmin = adminRole || user.role === 'admin'

  // Persist collapsed state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  // Close user menu when sidebar collapses
  useEffect(() => {
    if (collapsed) setUserMenuOpen(false)
  }, [collapsed])

  return (
    <div className="h-screen bg-background bg-grid flex">
      {/* Desktop sidebar - collapsible */}
      <aside
        className={`hidden lg:flex lg:flex-col h-screen shrink-0 bg-card border-r border-border sticky left-0 top-0 transition-[width] duration-300 ease-in-out ${
          collapsed ? 'lg:w-16' : 'lg:w-64'
        }`}
      >
        <div
          className={`h-16 flex items-center border-b border-border shrink-0 ${
            collapsed ? 'justify-center px-2' : 'px-4 gap-3'
          }`}
        >
          <Image
            src="/logo-upcrop.png"
            alt="UpCrop Logo"
            width={32}
            height={32}
            className="rounded-lg shrink-0"
          />
          {!collapsed && (
            <span className="text-xl font-bold text-primary truncate">UpCrop</span>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
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
            title={collapsed ? 'Inicio' : undefined}
            className={`flex items-center rounded-lg text-sm transition-colors ${
              collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'
            } ${
              pathname === '/dashboard'
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Inicio</span>}
          </Link>

          {!collapsed && (
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Módulos
              </p>
            </div>
          )}
          {collapsed && <div className="pt-2" />}

          {modules.length === 0 ? (
            !collapsed && (
              <p className="text-xs text-muted-foreground px-3 py-2">
                Sin módulos asignados.
              </p>
            )
          ) : (
            modules.map((m) => {
              const Icon = getModuleIcon(m.icon)
              const shapeCfg = getIconShape(m.icon_shape)
              const iconContainer = resolveIconContainerStyle(m.color, shapeCfg.className)
              const iconStyle = resolveIconStyle(m.color)
              const textStyle = resolveTextStyle(m.text_color ?? null, m.color)
              const href = `/dashboard/${m.slug}`
              const active = pathname === href
              return (
                <Link
                  key={m.id}
                  href={href}
                  title={collapsed ? m.name : undefined}
                  className={cn(
                    'flex items-center rounded-lg text-sm transition-colors',
                    collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2',
                    active ? 'bg-secondary/60' : 'hover:bg-secondary'
                  )}
                >
                  {/* Icon with color + shape container */}
                  <div
                    className={cn('w-7 h-7 flex items-center justify-center shrink-0', iconContainer.className)}
                    style={iconContainer.style}
                  >
                    <Icon
                      className={cn('w-4 h-4 shrink-0', iconStyle.className)}
                      style={iconStyle.style}
                    />
                  </div>
                  {!collapsed && (
                    <span
                      className={cn('truncate font-medium', textStyle.className, !textStyle.style && !active && 'text-muted-foreground')}
                      style={textStyle.style}
                    >
                      {m.name}
                    </span>
                  )}
                </Link>
              )
            })
          )}

          {isAdmin && (
            <>
              {!collapsed ? (
                <div className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Administración
                  </p>
                </div>
              ) : (
                <div className="pt-2" />
              )}
              <Link
                href="/admin"
                title={collapsed ? 'Panel Admin' : undefined}
                className={`flex items-center rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${
                  collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">Panel Admin</span>}
              </Link>
            </>
          )}
        </nav>

        {/* User info fixed at bottom - collapsible */}
        <div className={`border-t border-border shrink-0 ${collapsed ? 'p-2' : 'p-3'}`}>
          {collapsed ? (
            <Link
              href="/dashboard"
              title={user.full_name}
              className="w-10 h-10 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              <span className="text-xs font-semibold text-primary">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </Link>
          ) : (
            <>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary bg-primary/10 w-full h-full flex items-center justify-center">
                      {user.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <div
                className={`grid transition-all duration-200 ${
                  userMenuOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <LogoutButton />
                </div>
              </div>
            </>
          )}
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
              <div className="h-16 px-4 flex items-center gap-3 border-b border-border shrink-0">
                <Image
                  src="/logo-upcrop.png"
                  alt="UpCrop Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-primary">UpCrop</span>
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
                  Inicio
                </Link>

                <div className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Módulos
                  </p>
                </div>

                {modules.map((m) => {
                  const Icon = getModuleIcon(m.icon)
                  const shapeCfg = getIconShape(m.icon_shape)
                  const iconContainer = resolveIconContainerStyle(m.color, shapeCfg.className)
                  const iconStyle = resolveIconStyle(m.color)
                  const textStyle = resolveTextStyle(m.text_color ?? null, m.color)
                  const href = `/dashboard/${m.slug}`
                  const active = pathname === href
                  return (
                    <Link
                      key={m.id}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active ? 'bg-secondary/60' : 'hover:bg-secondary'
                      )}
                    >
                      <div
                        className={cn('w-7 h-7 flex items-center justify-center shrink-0', iconContainer.className)}
                        style={iconContainer.style}
                      >
                        <Icon className={cn('w-4 h-4', iconStyle.className)} style={iconStyle.style} />
                      </div>
                      <span
                        className={cn('font-medium', textStyle.className, !textStyle.style && !active && 'text-muted-foreground')}
                        style={textStyle.style}
                      >
                        {m.name}
                      </span>
                    </Link>
                  )
                })}

                {isAdmin && (
                  <>
                    <div className="pt-3 pb-1 px-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Administración
                      </p>
                    </div>
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Panel Admin
                    </Link>
                  </>
                )}
              </nav>

              <div className="border-t border-border p-3 shrink-0">
                <button
                  onClick={() => setUserMenuOpenMobile((v) => !v)}
                  aria-expanded={userMenuOpenMobile}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-primary bg-primary/10 w-full h-full flex items-center justify-center">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${userMenuOpenMobile ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`grid transition-all duration-200 ${
                    userMenuOpenMobile ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <LogoutButton />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {supportBanner}
        {/* Mobile top bar */}
        <header className="lg:hidden border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <div className="h-16 px-4 flex items-center justify-between">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary text-foreground"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Image
                src="/logo-upcrop.png"
                alt="UpCrop Logo"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="font-bold text-primary">UpCrop</span>
            </div>
            <div className="w-9" />
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
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
