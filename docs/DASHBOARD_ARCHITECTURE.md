# Dashboard Layout Architecture

## Overview

Este sistema implementa una arquitectura flexible y basada en configuración para el dashboard de UpCrop. Permite que los administradores personalicen el orden, tamaño y visibilidad de los widgets sin cambiar código.

## Componentes Principales

### 1. **Widget Configuration** (`lib/dashboard/widget-config.ts`)

Define la estructura de configuración de los widgets y proporciona layouts por defecto.

```typescript
interface WidgetConfig {
  id: string              // ID único del widget en el layout
  type: WidgetType        // Tipo de widget (debe estar en COMPONENT_MAP)
  title: string           // Título mostrado en la UI
  gridSize: GridSize      // Tamaño en grid ('sm', 'md', 'lg', 'full')
  moduleId?: string       // ID del módulo para filtrado de permisos
  order: number           // Orden de aparición
  visible: boolean        // Flag de visibilidad
  props?: Record<string, unknown>  // Props opcionales para el widget
}
```

**GridSize values:**
- `sm`: 1 columna en desktop
- `md`: 2 columnas en desktop
- `lg`: 3 columnas en desktop
- `full`: 3 columnas (ancho completo)

### 2. **Component Map** (`lib/dashboard/component-map.tsx`)

Mapeo centralizado de tipos de widgets a componentes React. Permite agregar nuevos widgets sin cambiar la lógica de renderizado.

```typescript
const COMPONENT_MAP: Record<WidgetType, ComponentType> = {
  'smart-alerts': SmartAlerts,
  'inputs-price': InputsPriceWidget,
  'currency': CurrencyWidget,
  // ... más widgets
}
```

### 3. **Layout Permissions** (`lib/dashboard/layout-permissions.ts`)

Utilidades para filtrar widgets basándose en permisos del usuario:
- Revisa el flag `visible` de cada widget
- Revisa permisos del módulo (si el widget tiene `moduleId` asignado)
- Ordena widgets por su propiedad `order`

```typescript
function filterWidgetsByPermissions(
  widgets: WidgetConfig[],
  permissions: UserPermissions,
): WidgetConfig[]
```

### 4. **Dashboard Layout Renderer** (`components/dashboard/dashboard-layout.tsx`)

Componente cliente que renderiza widgets de forma dinámica:
- Filtra widgets por permisos
- Aplica grid responsivo
- Proporciona error boundaries para cada widget
- Carga lazy components con Suspense

### 5. **Hook para Obtener Layout** (`hooks/use-dashboard-layout.ts`)

Proporciona dos funciones:

**Cliente (hook):**
```typescript
const { widgets, permissions, isLoading, error, refetch } = useDashboardLayout(userId)
```

**Servidor (async):**
```typescript
const { widgets, permissions } = await getDashboardLayoutAsync(supabase, userId)
```

## Flujo de Datos

```
┌─────────────────────────────────────────────────┐
│ dashboard/page.tsx (Server Component)           │
├─────────────────────────────────────────────────┤
│ 1. Obtiene user ID                              │
│ 2. Llama getDashboardLayoutAsync()              │
│    ├─ Fetch user_module_access (permisos)      │
│    ├─ Fetch dashboard_layouts (config custom)  │
│    └─ filterWidgetsByPermissions()              │
│ 3. Pasa widgets y permissions a <DashboardLayout/>
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ <DashboardLayout> (Client Component)            │
├─────────────────────────────────────────────────┤
│ 1. Recibe widgets[] y permissions               │
│ 2. Filtra widgets por permisos (redundante)     │
│ 3. Ordena por order                             │
│ 4. Para cada widget:                            │
│    ├─ Busca componente en COMPONENT_MAP         │
│    ├─ Aplica gridSize                           │
│    └─ Renderiza con ErrorBoundary               │
└─────────────────────────────────────────────────┘
```

## Cómo Agregar un Nuevo Widget

### 1. Crear el Componente
```typescript
// components/dashboard/my-widget.tsx
export function MyWidget(props: MyWidgetProps) {
  return <div>My Widget</div>
}
```

### 2. Agregar al Component Map
```typescript
// lib/dashboard/component-map.tsx
import { MyWidget } from '@/components/dashboard/my-widget'

type WidgetType = 
  | 'smart-alerts'
  | 'my-widget'  // ← Agregar aquí

export const COMPONENT_MAP: Record<WidgetType, ComponentType> = {
  // ...
  'my-widget': MyWidget,
}
```

### 3. Agregar al Default Layout (opcional)
```typescript
// lib/dashboard/widget-config.ts
export const DEFAULT_DASHBOARD_LAYOUT: WidgetConfig[] = [
  // ...
  {
    id: 'widget-my-widget',
    type: 'my-widget',
    title: 'Mi Widget',
    gridSize: 'md',
    order: 10,
    visible: true,
  },
]
```

## Cómo Usar Permisos de Módulos

### Asignar Módulo a Widget
```typescript
const config: WidgetConfig = {
  id: 'widget-smart-alerts',
  type: 'smart-alerts',
  title: 'Smart Alerts',
  moduleId: 'smart-alerts-module-id', // ← Vincula a módulo
  gridSize: 'full',
  order: 0,
  visible: true,
}
```

### Sistema de Permisos Integrado
El sistema **automáticamente** oculta widgets si:
1. El widget tiene un `moduleId`
2. El usuario NO tiene acceso a ese módulo (`user_module_access.enabled = false`)
3. El módulo está inactivo en la base de datos (`modules.is_active = false`)

## Uso en Client Components

Para usar el layout en componentes cliente:

```typescript
'use client'

import { useDashboardLayout } from '@/hooks/use-dashboard-layout'

export function MyDashboard() {
  const { widgets, permissions, isLoading } = useDashboardLayout(userId)

  if (isLoading) return <div>Cargando...</div>

  return (
    <DashboardLayout 
      widgets={widgets} 
      permissions={permissions}
    />
  )
}
```

## Futura Característica: Panel de Administración

Esta arquitectura está lista para una futura característica donde los administradores pueden:

1. **Reordenar widgets** (cambiar `order`)
2. **Activar/desactivar widgets** (cambiar `visible`)
3. **Cambiar tamaños** (cambiar `gridSize`)
4. **Vincular a módulos** (asignar `moduleId`)
5. **Guardar configuraciones personalizadas** en tabla `dashboard_layouts`

La función `getDashboardLayoutAsync()` ya intenta cargar una tabla `dashboard_layouts` para soportar esto.

## Estructura de Tabla Supabase (Futura)

```sql
CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  configuration JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id)
);
```

## Debugging

### Ver Widgets Disponibles
```typescript
import { getAvailableWidgetTypes } from '@/lib/dashboard/component-map'

const types = getAvailableWidgetTypes()
console.log('Available widgets:', types)
```

### Validar Configuración
```typescript
import { validateWidgetConfig } from '@/lib/dashboard/layout-permissions'

const { valid, errors } = validateWidgetConfig(widgetConfig)
if (!valid) console.error('Invalid widget:', errors)
```

### Revisar Permisos del Usuario
```typescript
const permissions = createPermissions(enabledModuleIds)
const hasAccess = permissions.hasAccess(moduleId)
```

## Error Handling

Cada widget está envuelto en un `ErrorBoundary`:
- Si un widget falla, muestra un mensaje de error aislado
- No afecta a otros widgets
- El resto del dashboard sigue funcionando

Errores de componentes no encontrados:
- Se muestra una tarjeta de advertencia
- Se registra en console
- El dashboard continúa renderizando otros widgets

## Performance

- Cada widget está dentro de un `Suspense` boundary
- Los widgets lentos no bloquean otros
- Los errores están aislados por widget
- Render optimizado con React keys

## Ejemplos de Uso

### Mostrar widgets según rol de usuario
```typescript
const widgets = DEFAULT_DASHBOARD_LAYOUT.filter(w => {
  if (userRole === 'admin') return true
  return w.visible // usuarios normales solo ven widgets visibles
})
```

### Crear diferentes layouts por cliente
```typescript
const layouts = {
  client_a: [{ type: 'smart-alerts', ... }],
  client_b: [{ type: 'inputs-price', ... }],
}
```

### Filtro dinámico por disponibilidad de datos
```typescript
const filteredWidgets = widgets.filter(w => {
  if (w.type === 'market' && !hasMarketData) return false
  return true
})
```
