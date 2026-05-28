import {
  // Agriculture & Nature
  Leaf, Sprout, Wheat, Sun, Droplets, Wind, Thermometer, Globe,
  // Business & Finance
  TrendingUp, TrendingDown, DollarSign, CreditCard, Banknote, LineChart,
  PieChart, BarChart3, BarChart2, Briefcase, Receipt, Wallet,
  // Logistics & Supply
  Truck, Ship, Package, Box, Warehouse, MapPin, Navigation, Plane,
  // Technology
  Database, Cloud, Monitor, Cpu, Wifi, Server, Code, Terminal,
  Laptop, Smartphone,
  // People & Organization
  Users, UserCheck, Building, Building2, Network,
  // Documents & Data
  FileText, FolderLock, ClipboardList, BookOpen, Newspaper, FileSpreadsheet,
  // Operations & Tools
  Settings, Wrench, Factory, Activity, Gauge, Zap, Layers, GitBranch,
  // Environment & Location
  Globe2, Mountain,
  // Time & Communication
  Calendar, Clock, Bell, Mail, MessageSquare, Radio,
  // Security & Other
  Shield, Lock, Eye, Search, Filter, Star, Heart, Target, Bookmark,
  Rocket, LayoutDashboard, Home, Microscope, FlaskConical,
  type LucideIcon,
} from 'lucide-react'

export const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  Leaf, Sprout, Wheat, Sun, Droplets, Wind, Thermometer,
  TrendingUp, TrendingDown, DollarSign, CreditCard, Banknote, LineChart,
  PieChart, BarChart3, BarChart2, Briefcase, Receipt, Wallet,
  Truck, Ship, Package, Box, Warehouse, MapPin, Navigation, Plane,
  Database, Cloud, Monitor, Cpu, Wifi, Server, Code, Terminal,
  Laptop, Smartphone,
  Users, UserCheck, Building, Building2, Network,
  FileText, FolderLock, ClipboardList, BookOpen, Newspaper, FileSpreadsheet,
  Settings, Wrench, Factory, Activity, Gauge, Zap, Layers, GitBranch,
  FlaskConical, Microscope,
  Globe, Globe2, Mountain,
  Calendar, Clock, Bell, Mail, MessageSquare, Radio,
  Shield, Lock, Eye, Search, Filter, Star, Heart, Target, Bookmark,
  Rocket, LayoutDashboard, Home,
}

export type IconCategory = {
  label: string
  icons: string[]
}

export const ICON_CATEGORIES: IconCategory[] = [
  { label: 'Agricultura',  icons: ['Leaf', 'Sprout', 'Wheat', 'Sun', 'Droplets', 'Wind', 'Thermometer'] },
  { label: 'Negocio',      icons: ['TrendingUp', 'TrendingDown', 'DollarSign', 'CreditCard', 'Banknote', 'LineChart', 'PieChart', 'BarChart3', 'BarChart2', 'Briefcase', 'Receipt', 'Wallet'] },
  { label: 'Logistica',    icons: ['Truck', 'Ship', 'Package', 'Box', 'Warehouse', 'MapPin', 'Navigation', 'Plane'] },
  { label: 'Tecnologia',   icons: ['Database', 'Cloud', 'Monitor', 'Cpu', 'Wifi', 'Server', 'Code', 'Terminal', 'Laptop', 'Smartphone'] },
  { label: 'Personas',     icons: ['Users', 'UserCheck', 'Building', 'Building2', 'Network'] },
  { label: 'Documentos',   icons: ['FileText', 'FolderLock', 'ClipboardList', 'BookOpen', 'Newspaper', 'FileSpreadsheet'] },
  { label: 'Operaciones',  icons: ['Settings', 'Wrench', 'Factory', 'Activity', 'Gauge', 'Zap', 'Layers', 'GitBranch', 'FlaskConical', 'Microscope'] },
  { label: 'Naturaleza',   icons: ['Globe', 'Globe2', 'Mountain'] },
  { label: 'Otros',        icons: ['Calendar', 'Clock', 'Bell', 'Mail', 'MessageSquare', 'Radio', 'Shield', 'Lock', 'Eye', 'Search', 'Filter', 'Star', 'Heart', 'Target', 'Bookmark', 'Rocket', 'LayoutDashboard', 'Home'] },
]

export const MODULE_ICON_OPTIONS: { value: string; label: string }[] = Object.keys(
  MODULE_ICON_MAP,
).map((key) => ({ value: key, label: key }))

export function getModuleIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Package
  return MODULE_ICON_MAP[name] ?? Package
}

// ─── Preset color system ───────────────────────────────────────────────────────

export type ModuleColor =
  | 'slate' | 'blue' | 'emerald' | 'rose' | 'orange'
  | 'purple' | 'pink' | 'amber' | 'teal' | 'indigo' | 'cyan' | 'lime'

export interface ModuleColorConfig {
  value: ModuleColor
  label: string
  dot: string
  bg: string
  text: string
  border: string
  hoverBg: string
}

export const MODULE_COLOR_OPTIONS: ModuleColorConfig[] = [
  { value: 'slate',   label: 'Gris',    dot: 'bg-slate-500',   bg: 'bg-slate-500/15',   text: 'text-slate-600 dark:text-slate-400',    border: 'border-slate-500/40',   hoverBg: 'hover:bg-slate-500/20'   },
  { value: 'blue',    label: 'Azul',    dot: 'bg-blue-500',    bg: 'bg-blue-500/15',    text: 'text-blue-600 dark:text-blue-400',      border: 'border-blue-500/40',    hoverBg: 'hover:bg-blue-500/20'    },
  { value: 'emerald', label: 'Verde',   dot: 'bg-emerald-500', bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/40', hoverBg: 'hover:bg-emerald-500/20' },
  { value: 'rose',    label: 'Rojo',    dot: 'bg-rose-500',    bg: 'bg-rose-500/15',    text: 'text-rose-600 dark:text-rose-400',      border: 'border-rose-500/40',    hoverBg: 'hover:bg-rose-500/20'    },
  { value: 'orange',  label: 'Naranja', dot: 'bg-orange-500',  bg: 'bg-orange-500/15',  text: 'text-orange-600 dark:text-orange-400',  border: 'border-orange-500/40',  hoverBg: 'hover:bg-orange-500/20'  },
  { value: 'amber',   label: 'Ambar',   dot: 'bg-amber-500',   bg: 'bg-amber-500/15',   text: 'text-amber-600 dark:text-amber-400',    border: 'border-amber-500/40',   hoverBg: 'hover:bg-amber-500/20'   },
  { value: 'lime',    label: 'Lima',    dot: 'bg-lime-500',    bg: 'bg-lime-500/15',    text: 'text-lime-600 dark:text-lime-500',      border: 'border-lime-500/40',    hoverBg: 'hover:bg-lime-500/20'    },
  { value: 'teal',    label: 'Teal',    dot: 'bg-teal-500',    bg: 'bg-teal-500/15',    text: 'text-teal-600 dark:text-teal-400',      border: 'border-teal-500/40',    hoverBg: 'hover:bg-teal-500/20'    },
  { value: 'cyan',    label: 'Cyan',    dot: 'bg-cyan-500',    bg: 'bg-cyan-500/15',    text: 'text-cyan-600 dark:text-cyan-400',      border: 'border-cyan-500/40',    hoverBg: 'hover:bg-cyan-500/20'    },
  { value: 'indigo',  label: 'Indigo',  dot: 'bg-indigo-500',  bg: 'bg-indigo-500/15',  text: 'text-indigo-600 dark:text-indigo-400',  border: 'border-indigo-500/40',  hoverBg: 'hover:bg-indigo-500/20'  },
  { value: 'purple',  label: 'Violeta', dot: 'bg-purple-500',  bg: 'bg-purple-500/15',  text: 'text-purple-600 dark:text-purple-400',  border: 'border-purple-500/40',  hoverBg: 'hover:bg-purple-500/20'  },
  { value: 'pink',    label: 'Rosa',    dot: 'bg-pink-500',    bg: 'bg-pink-500/15',    text: 'text-pink-600 dark:text-pink-400',      border: 'border-pink-500/40',    hoverBg: 'hover:bg-pink-500/20'    },
]

// ─── Icon shape system ─────────────────────────────────────────────────────────

export type IconShape = 'rounded' | 'circle' | 'square'

export interface IconShapeConfig {
  value: IconShape
  label: string
  className: string
}

export const ICON_SHAPE_OPTIONS: IconShapeConfig[] = [
  { value: 'rounded', label: 'Redondeado', className: 'rounded-xl' },
  { value: 'circle',  label: 'Circulo',    className: 'rounded-full' },
  { value: 'square',  label: 'Cuadrado',   className: 'rounded-md'  },
]

export function getModuleColor(color: string | null | undefined): ModuleColorConfig {
  return MODULE_COLOR_OPTIONS.find(c => c.value === color) ?? MODULE_COLOR_OPTIONS[1]
}

export function getIconShape(shape: string | null | undefined): IconShapeConfig {
  return ICON_SHAPE_OPTIONS.find(s => s.value === shape) ?? ICON_SHAPE_OPTIONS[0]
}

// ─── Hex color helpers ─────────────────────────────────────────────────────────

export function isHexColor(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v)
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Returns style/class props for the icon container (bg + border)
export function resolveIconContainerStyle(
  color: string | null | undefined,
  shapeClassName: string,
): { className: string; style?: Record<string, string> } {
  if (isHexColor(color)) {
    return {
      className: `border ${shapeClassName}`,
      style: {
        backgroundColor: hexToRgba(color, 0.15),
        borderColor: hexToRgba(color, 0.4),
      },
    }
  }
  const cfg = getModuleColor(color)
  return { className: `border ${cfg.bg} ${cfg.border} ${shapeClassName}` }
}

// Returns style/class props for the icon itself
export function resolveIconStyle(
  color: string | null | undefined,
): { className: string; style?: Record<string, string> } {
  if (isHexColor(color)) {
    return { className: '', style: { color } }
  }
  const cfg = getModuleColor(color)
  return { className: cfg.text }
}

// Returns style/class props for text labels
export function resolveTextStyle(
  textColor: string | null | undefined,
  fallbackIconColor: string | null | undefined,
): { className: string; style?: Record<string, string> } {
  // Use textColor if explicitly set, else fall back to icon color
  const val = textColor || fallbackIconColor
  if (isHexColor(val)) {
    return { className: '', style: { color: val as string } }
  }
  const cfg = getModuleColor(val)
  return { className: cfg.text }
}
