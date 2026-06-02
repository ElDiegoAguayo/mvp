# Manual de Usuario — Up Crop

**Plataforma:** https://mvp-smoky-tau.vercel.app  
**Audiencia:** CEO, clientes, equipo comercial y usuarios finales (sin conocimientos técnicos)  
**Versión:** Mayo 2026

---

## Tabla de contenidos

1. [¿Qué es Up Crop?](#1-qué-es-up-crop)
2. [Tipos de usuario](#2-tipos-de-usuario)
3. [Acceso a la plataforma](#3-acceso-a-la-plataforma)
4. [Navegación y elementos globales](#4-navegación-y-elementos-globales)
5. [Inicio — Tablero principal](#5-inicio--tablero-principal)
6. [Mi perfil](#6-mi-perfil)
7. [Módulos del cliente](#7-módulos-del-cliente)
8. [Panel de Administración](#8-panel-de-administración)
9. [Página pública de documentos compartidos](#9-página-pública-de-documentos-compartidos)
10. [Seguridad](#10-seguridad)
11. [Flujo de un cliente nuevo](#11-flujo-de-un-cliente-nuevo)
12. [Glosario](#12-glosario)
13. [Mapa completo de la plataforma](#13-mapa-completo-de-la-plataforma)

---

## 1. ¿Qué es Up Crop?

Up Crop es una plataforma web para empresas agrícolas y agroindustrias. Centraliza en un solo lugar:

- Datos de **producción** (campo, cosecha, fenología)
- **Logística** e inventarios
- **Costos** y gastos del negocio
- **Comercio exterior** y mercado
- **Documentos** seguros
- **Asistencia técnica** en terreno
- Un **tablero de inicio** con alertas, clima, divisas y más

Cada cliente ve **solo los módulos que Up Crop le habilitó**. No todos tienen los mismos módulos ni el mismo diseño de Inicio.

---

## 2. Tipos de usuario

| Tipo | ¿Quién es? | ¿Qué ve al entrar? |
|------|------------|-------------------|
| **Cliente principal** | La empresa contratante (ej. una exportadora) | Inicio + módulos contratados + perfil completo |
| **Sub usuario** | Persona de la misma empresa con permisos limitados | Solo módulos activados para él; comparte plan y almacenamiento con la cuenta principal |
| **Inspector de campo** | Técnico que trabaja en terreno | **Asistencia técnica**, **Estados fenológicos** y **Estimación de cosecha (conteo)**; al entrar va directo a Asistencia técnica (no ve Inicio) |
| **Administrador Up Crop** | Equipo interno | Todo + **Panel Admin** para gestionar clientes |

**Regla importante:** nadie se registra solo. Up Crop envía una **invitación por correo** o crea la cuenta desde el panel admin.

### Cliente principal
- Empresa contratante
- Puede **aprobar proformas** de asistencia técnica
- Puede tener **sub usuarios** vinculados
- Comparte almacenamiento con sus sub usuarios

### Sub usuario
- Solo ve módulos que el admin activó **y** que el cliente principal tiene
- Ve la **cuenta principal** en Mi perfil
- **No** aprueba proformas
- Mismo plan de servicio y almacenamiento que el padre

### Inspector de campo
- Módulos **Asistencia técnica**, **Estados fenológicos** y **Estimación de cosecha** (pestaña Conteo)
- Marca entrada/salida con validación GPS (geocerca)
- Puede tener varios clientes asignados

### Administrador Up Crop
- Panel Admin + todos los módulos
- Gestiona clientes, permisos, datos, backups, notificaciones
- Puede entrar en **modo soporte** (ver la plataforma como un cliente)

---

## 3. Acceso a la plataforma

### 3.1 Iniciar sesión (`/auth/login`)

**Qué ves:**
- Logo Up Crop
- Campo **Email**
- Campo **Contraseña** (botón mostrar/ocultar)
- Botón **Iniciar sesión**
- Enlace **¿Olvidaste tu contraseña?**
- Selector de **idioma** (español / inglés)

**Qué pasa al iniciar sesión:**
1. Se valida que email y contraseña no estén vacíos.
2. El sistema revisa si la **IP está bloqueada** manualmente.
3. Revisa **intentos fallidos** (bloqueo temporal tras ~5 intentos).
4. Autentica la cuenta.
5. Verifica el **perfil** (cuenta activa, no suspendida).
6. Si todo OK → mensaje de bienvenida → **Inicio** (o Asistencia técnica si eres inspector).

**Mensajes que puedes ver:**

| Mensaje | Significado |
|---------|-------------|
| Credenciales inválidas | Email o contraseña incorrectos |
| Demasiados intentos | Bloqueo temporal; espera el tiempo indicado |
| Cuenta suspendida | Morosidad o suspensión; contactar administración |
| Acceso denegado desde esta IP | IP bloqueada por el admin |
| Mensaje de mantenimiento | Plataforma en mantenimiento (solo admins entran) |

### 3.2 Activar cuenta — Registro por invitación (`/auth/registro`)

Solo con **enlace de invitación** por correo.

**Qué completas:**
- Nombre completo (mínimo 2 caracteres)
- Nueva contraseña (mínimo 8 caracteres)
- Confirmar contraseña

**Flujo:** abrir enlace → completar formulario → **Activar cuenta** → entrar a la plataforma.

**Errores comunes:** enlace expirado, contraseñas no coinciden, nombre incompleto.

### 3.3 Recuperar contraseña (`/auth/recuperar-contrasena`)

**Paso 1:** ingresar email → **Enviar enlace** → revisar correo (y spam).

**Paso 2:** desde el enlace, elegir nueva contraseña → **Guardar contraseña** → volver al login.

### 3.4 Cerrar sesión

Botón **Cerrar sesión** en el pie del menú lateral.

---

## 4. Navegación y elementos globales

### 4.1 Menú lateral (sidebar)

**Parte superior:**
- Logo Up Crop
- Botón **colapsar/expandir** menú
- En móvil: menú hamburguesa

**Cuerpo:** módulos agrupados por **departamento/área** (Producción, Logística, Comercio exterior, Finanzas, Documentos, General). Cada ítem tiene icono, nombre, badge opcional y resaltado cuando estás ahí.

**Pie del menú:**

| Elemento | Qué hace |
|----------|----------|
| Avatar / nombre | Clic → **Mi perfil** |
| Icono del plan | Esencial (bronce), Enterprise (plata), Business (dorado) |
| **Cerrar sesión** | Sale de la plataforma |
| **Panel Admin** | Solo administradores |
| **Selector de idioma** | ES / EN |

### 4.2 Modo soporte (solo admins)

Banda superior: *“Viendo la plataforma como [nombre]”* + botón **Salir del modo soporte**. El admin ve exactamente lo del usuario impersonado. Queda registrado en auditoría.

### 4.3 Asistente IA (chat flotante)

Disponible en todas las páginas del dashboard. Chat de ayuda “IA Up Crop”. No reemplaza soporte humano para contratos o permisos.

### 4.4 Modo sin conexión (offline)

En **Estados fenológicos** y **Estimación de cosecha**:
- Banner cuando no hay internet
- Registros guardados localmente en cola
- Sincronización al reconectar
- Badge en filas pendientes de subir

---

## 5. Inicio — Tablero principal

**Ruta:** `/dashboard` — primer pantallazo (excepto inspectores).

### 5.1 Encabezado
Saludo personalizado: *“Bienvenido a Up Crop, [nombre]”*.

### 5.2 Widgets configurables

Up Crop configura qué widgets ves y en qué orden (Admin → pestaña Inicio).

#### Alertas inteligentes (ancho completo)

Combina avisos del admin + alertas automáticas:

| Tipo | Origen | Ejemplo |
|------|--------|---------|
| Mensajes Up Crop | Admin → Notificaciones | Mantenimiento, novedades |
| Alerta de helada | API clima | Riesgo de bajas temperaturas |
| Tipo de cambio | API divisas | Variación relevante del dólar |
| Stock bajo inventario | Tu inventario | Material bajo el mínimo |
| Sin alertas | — | “No hay alertas críticas” |

Severidades en avisos admin: información, éxito, advertencia, crítico.

#### Precios de insumos / Combustibles
Petróleo WTI, Brent, diésel, gas natural. Fuente: mercados energéticos (NYMEX/ICE).

#### Monedas / Divisas
Dólar, UF, Euro, Yuan + conversor CLP ↔ otras monedas (mindicador.cl y APIs globales).

#### Alertas SAG
Feed de resoluciones fitosanitarias oficiales del SAG Chile.

#### Clima
Regiones de Chile (Coquimbo a Los Lagos): temperatura, humedad, viento, precipitación, pronóstico 7 días.

#### Mapa de puertos
Puertos de embarque exportación (mapa interactivo).

#### Mercado (resumen)
Snapshot de precios de fruta con tendencia.

#### Rastreo satelital
Buscador de contenedor/booking + mapa + naviera.

#### Bóveda documental (acceso rápido)
Documentos recientes sin entrar al módulo completo.

---

## 6. Mi perfil

**Ruta:** menú lateral → **Mi perfil** (`/dashboard/perfil`)

### 6.1 Plan contratado (tarjeta superior)
Plan Esencial, Enterprise o Business; descripción; valor en UF; badge **Activo**; contacto Up Crop.

| Plan | Idea general | Referencia |
|------|--------------|------------|
| **Esencial** | Primer paso digital | ~12,5 UF/mes — 3 módulos, analista, IA, soporte |
| **Enterprise** | Operaciones escaladas | ~18,5 UF/mes — 5 módulos avanzados, IA predictiva, ERP |
| **Business** | Holdings / agroindustria | A medida — módulos ilimitados, personal en terreno |

### 6.2 Datos personales
- Nombre (color según plan + icono del plan)
- Correo electrónico
- Rol (Administrador / Cliente / Sub usuario)
- Conteo de módulos activos
- **Miembro desde**
- **Sub usuarios vinculados** (cliente principal)
- **Cuenta principal** (sub usuario: nombre y correo del padre)

### 6.3 Almacenamiento
- Barra de uso vs. cuota (10 / 25 / 50 / 100 GB)
- Desglose por módulo (Mis documentos, Fenología, etc.)
- Avisos de cuota casi agotada
- Ampliar plan: contactar soporte

### 6.4 Módulos activos
Lista con icono y nombre de cada módulo habilitado.

### 6.5 Ubicación de trabajo
(Solo con asistencia técnica) dirección, mapa, radio de geocerca en metros.

### 6.6 Catálogo comercial de planes
Tarjetas Esencial, Enterprise, Business con beneficios y contacto (WhatsApp, correo).

---

## 7. Módulos del cliente

Los módulos se organizan por departamentos en el menú. Si un módulo no aparece, no está activo en tu cuenta.

---

### 7.1 Inventario

#### Para qué sirve
Controlar **bodegas**, **materiales** y **movimientos de stock**, con alertas cuando el stock baja del mínimo.

#### Vista del cliente (módulo en el menú)

El cliente **consulta** el inventario; no crea bodegas ni registra movimientos desde aquí.

**KPIs:** total registros, OK, bajo mínimo, sin stock.

**Tabla de stock:**

| Columna | Qué muestra |
|---------|-------------|
| Bodega | Nombre del almacén |
| Material | Nombre del insumo |
| Stock | Cantidad actual (desde movimientos) |
| Unidad | kg, cajas, etc. |
| Estado | OK / Próximo / Bajo mínimo / Sin stock |
| Último movimiento | Fecha y tipo (entrada ↑, salida ↓, ajuste ±) |

**Filtros:** búsqueda, bodega, estado, paginación, botón Actualizar.

#### Configuración admin (Admin → Clientes → Inventario)

**Pestaña Movimientos**
- Registrar **entrada**, **salida** o **ajuste**
- Campos: bodega, material, cantidad, unidad, fecha, **costo CLP** (opcional), responsable, observación
- Historial con búsqueda y filtros; editar y eliminar

**Pestaña Bodegas y Materiales**
- **Bodegas:** crear (nombre + ubicación), editar, eliminar
- **Materiales:** crear (bodega + nombre + unidad), editar, eliminar; stock en vivo

**Pestaña Stock mínimo**
- Umbral por bodega + material → alertas automáticas

**Pestaña Reporte**
- Por rango de fechas: entradas, salidas, ajustes, stock final, costo promedio

#### Flujo típico
1. Up Crop crea bodegas y materiales.
2. Registra movimientos (compras = entrada, consumo = salida).
3. Configura mínimos.
4. Cliente consulta stock y alertas en su módulo.

---

### 7.2 Estados fenológicos

#### Para qué sirve
Seguimiento **semanal** del cultivo por cuartel con **fotos de campo**.

#### Pestaña Seguimiento
- Filtros: cultivo, temporada, variedad, cuartel
- Resumen: cuarteles, lecturas, fotos, alertas, enlace a Estimación de cosecha
- Línea de tiempo por semana: fecha, estado, hilera, árbol, notas, imágenes

**Acciones:**

| Acción | Detalle |
|--------|---------|
| Nueva lectura semanal | Cuartel, fecha, variedad, etapa, hilera/árbol, notas |
| Editar / eliminar lectura | Con confirmación |
| Subir fotos | Hasta 8 imágenes (máx. 10 MB c/u) |
| Renombrar cuartel | En todas las lecturas del cultivo |
| Importar / exportar Excel | Misma estructura planilla tradicional; fotos embebidas |
| Plantilla por cultivo | Descarga formato vacío |
| Modo offline | Cola de sincronización |

#### Pestaña Catálogo
- Etapas de referencia por cultivo (días típicos entre etapas)
- Crear, editar, eliminar etapas
- Cargar plantilla predeterminada

---

### 7.3 Estimación de cosecha (incluye Plan de cosecha)

#### Para qué sirve
Del **conteo en campo** a **kilos estimados** y **plan de cosecha**.

#### Gestión transversal
- **Campos** y **cuarteles** (cultivo, variedad, ha, plantas/ha)
- Filtros: temporada, cultivo, campo, cuartel, variedad
- Importar/exportar Excel; vaciar datos (destructivo)

#### Pestaña Conteo
- Muestras por árbol: dardos, ramillas, primordios, % cuaja, pre/post poda
- Vistas: promedios por cuartel, detalle por árbol, gráficos
- Nuevo conteo, editar, eliminar, importar/exportar Excel

#### Pestaña Estimación de cosecha
- kg/planta, kg/ha, kg totales desde fórmulas agronómicas
- Calcular desde conteo, guardar calculadas, estimación manual
- Tabla + gráficos; exportar Excel
- Aviso si faltan hectáreas en cuarteles

#### Pestaña Plan de cosecha
- Ventanas de cosecha (fecha inicio/fin) por cuartel
- Diagrama Gantt + tabla
- El menú “Plan de cosecha” redirige aquí (`?tab=plan`)

---

### 7.4 Planificación de Producción / Proyección de Embalaje

#### Para qué sirve
Cuántas **cajas/pallets** puedes armar con stock de materiales de embalaje.

**Vista cliente:**
- Semáforo por código: Crítico / Bajo / OK
- Cajas armables, pallets completos, desglose de materiales por receta
- **Insumos a reponer** + exportar lista de compra Excel
- **Simulador de compra:** “si compro X, ¿cuántas cajas más?”
- Catálogo searchable de materiales

**Admin (Clientes → Producción):**
- Importar Excel (hojas Códigos embalaje + Inventario)
- Editar stock de materiales y recetas (BOM)

---

### 7.5 Costos y Gastos

#### Para qué sirve
**Libro de Compras SII** → clasificar gastos → **centros de costo** y márgenes.

**Flujo:** Importar SII (admin) → Clasificar (cliente) → Centro de Costos (cliente)

#### Admin (Clientes → Costos)
- Importar Libro SII (Excel)
- Historial de importaciones
- Taxonomía de clasificación
- Entidades de centro de costo

#### Pestaña Clasificación
- KPIs: gasto total, proveedores, pendientes
- Grid de **contrapartes** (proveedores); badge amarillo = pendientes
- Clasificar facturas: categoría + centro de costo
- **Dividir asignación** entre varios centros
- Filtro por período de devengo

#### Pestaña Centro de Costos
- Árbol: módulos → entidades → montos
- **Márgenes:** costo por kilo, margen real vs. producción

---

### 7.6 Mercado

#### Para qué sirve
Precios **FOB de referencia** de fruta exportada.

**Filtros:** fruta, variedad, país, puerto (auto-mejor precio), moneda (USD, EUR, UF, CLP…).

**Pantalla:**
- Precio actual + variación vs. ayer
- Mapa de puertos
- Historial 7 días (exportable Excel)
- Noticias Portal Frutícola
- Gráfico ~360 días (por mes o rango personalizado)

---

### 7.7 Comercio Exterior

Operaciones de exportación/importación + **rastreo satelital**:
- Buscar contenedor/booking + naviera
- Mapa en tiempo real
- Tablas/gráficos dinámicos configurados por Up Crop

---

### 7.8 Mis documentos (Bóveda documental)

#### Para qué sirve
Repositorio seguro de archivos de la empresa.

| Acción | Detalle |
|--------|---------|
| Carpetas | Crear, navegar, eliminar (recursivo) |
| Subir archivos | PDF, Excel, Word, imágenes; arrastrar o clic |
| Vencimiento | Opcional al subir |
| Vista previa | Tipos soportados |
| Descargar / eliminar | |
| Mover | Entre carpetas; selección múltiple |
| Compartir enlace | 1, 7, 14 o 30 días |
| Buscar y filtrar | Por nombre y tipo |
| Cuota | Barra de almacenamiento compartida empresa |

---

### 7.9 Generación de Documentos

Crear **contratos, informes o facturas** en PDF o DOCX desde tablas de la plataforma.

**Pasos:** tipo documento → tabla origen → fila → columnas → generar y descargar.

---

### 7.10 Asistencia técnica

#### Vista Cliente
- **Registros / Planilla:** historial entradas/salidas inspectores; exportar Excel
- **Proformas:** aprobar o rechazar (solo cliente principal)

#### Vista Inspector
- Seleccionar cliente y servicio
- **Entrada / Salida** con validación GPS (geocerca)
- Editar/eliminar registros del día
- Mapa, agenda, horas auto-calculadas

#### Vista Admin Up Crop
- **Servicios:** labores, vigencia, precio neto, cobro por ha/día
- **Corrección:** ajustar cualquier registro
- **Planilla:** todos los registros + Excel
- **Ubicaciones:** GPS + radio geocerca (1 por cliente)
- **Proformas:** crear, enviar a aprobación, estados (borrador → aprobada/rechazada)

---

### 7.11 Trazabilidad y módulos personalizados

Módulos dinámicos (Centro de Control, Producto Terminado, Plata, Productores, Check List, etc.):

**Tablas:** filtros, edición inline (si permitido), agregar filas/columnas, import Excel.

**Gráficos:** barras, línea, torta, área, donut, mapas; tiempo real.

**Embeds especiales:**
- Slug “inventario” → vista stock (7.1)
- Slug “documento” → generador (7.9)
- Slug “comercio” → rastreo satelital (7.7)
- Enlaces Looker Studio embebidos

**Admin configura** en Clientes: tablas, gráficos, permisos, Excel.

---

### 7.12 Proveedores (Suppliers)

**Ruta:** `/dashboard/proveedores` — módulo nativo del área **Costos y finanzas**.  
**Idioma UI:** inglés y español (selector global de idioma).

Gestiona el ciclo **proveedor → cotización → factura de compra**, complementario al Libro de Compras SII (7.5).

#### Pestañas

| Pestaña | Ruta | Función |
|---------|------|---------|
| **Empresas** | `/dashboard/proveedores/empresas` | Alta y edición de empresas proveedoras (razón social, RUT, contacto, estado activo/inactivo) |
| **Cotizaciones** | `/dashboard/proveedores/cotizaciones` | Subir cotizaciones (empresa opcional), selección múltiple para asignar empresa en lote, adjuntar archivo, detalle de líneas opcional |
| **Facturas de compra** | `/dashboard/proveedores/facturas` | Facturas emitidas desde cotizaciones aceptadas; KPIs y estados de pago |

#### Flujo recomendado

1. **Registrar empresas** en la pestaña Empresas (recomendado antes de aceptar o facturar).
2. **Subir cotización:** arrastra PDF/Excel/Word; el sistema **extrae texto del PDF** y detecta referencia, montos, fechas, líneas de detalle y condiciones comerciales cuando el documento lo permite. La **empresa proveedora es opcional** al subir — puedes dejarla sin asignar. **No se puede subir el mismo archivo dos veces** (el sistema lo detecta automáticamente).
3. **Asignar empresa (individual o en lote):** marca una o varias cotizaciones con la casilla de la tabla y pulsa **Asignar empresa**; elige la misma empresa para todas. Las cotizaciones sin empresa muestran la etiqueta **Sin empresa** y no se pueden aceptar hasta asignarla.
4. **Revisar y editar:** las cotizaciones quedan **aceptadas** al subir. Usa el botón **Editar** (lápiz) para corregir referencia, empresa, productos o notas.
5. **Generar orden de compra:** indica **cuánto comprar** de cada producto (kg, mil, rollo, unidad…) — el total se calcula solo. Luego confirma N° de orden y genera el PDF. Puedes **generar varias órdenes** desde la misma cotización (por ejemplo, compras parciales en fechas distintas); usa un **número de orden distinto** en cada una.
6. **Gestionar órdenes:** en Facturas de compra verás el detalle y el PDF.

#### Estados

**Cotización:** borrador, pendiente, aceptada, rechazada, vencida.  
**Factura de compra:** borrador, emitida, pagada, anulada.

#### Archivos y almacenamiento

Los archivos de cotización se guardan en la **bóveda documental** del cliente (`proveedores/cotizaciones/…`). Al emitir factura, se conserva la referencia al mismo adjunto.

#### Admin Up Crop

- El módulo aparece en **Admin → Usuarios** como **Proveedores / Suppliers** (icono tienda).
- Activar o desactivar por cliente con el switch de módulos (igual que Inventario, Costos, etc.).
- No requiere configuración adicional en **Clientes**; es módulo nativo.
- En **modo soporte** (“Ver como cliente”), el admin ve los proveedores del cliente impersonado.

#### Relación con Costos y Gastos

Las facturas de compra registradas aquí son el control interno previo o paralelo al **Libro de Compras SII**. La vinculación automática con registros SII (`registro_compras_sii_id`) queda preparada en base de datos para integraciones futuras.

---

## 8. Panel de Administración

**Ruta:** `/admin` — solo rol **admin**.

**Header:** Registro de Actividad (`/admin/auditoria`) + Volver al dashboard.

### 8.1 Pestaña Resumen

**Modo mantenimiento:** activar/desactivar, mensaje a clientes, presets guardados. Clientes no entran; admins sí.

**Resumen plataforma:** salud sistema, usuarios en línea, uso BD, almacenamiento (bóveda + backups), último backup, top clientes bóveda.

**Chips rápidos:** usuarios, bloqueados, módulos, auditoría, enlaces compartidos, avisos.

**Uso (7 días):** clientes activos, logins, vistas módulo, exportaciones, alertas inventario, gráfico diario, ranking módulos.

### 8.2 Pestaña Usuarios

**Toolbar:** planes de servicio, crear inspector, registrar cliente, gestionar áreas, crear módulo, exportar Excel permisos.

**Por usuario:**
- Switches módulos on/off
- Editar, invitar, cambiar contraseña
- Acceso a tablas/gráficos, orden menú, plan servicio
- Crear sub usuario, asignar clientes (inspector)
- **Ver como cliente/inspector** (modo soporte)
- Bloquear/desbloquear cuenta
- Última actividad

**Móvil:** acordeón; flecha gris abre detalle.

### 8.3 Pestaña Clientes

Selector cliente → módulo → gestión de datos (tablas, gráficos, SII, inventario, producción, ubicación, sub usuarios). Ver secciones 7.1, 7.4, 7.5, 7.11.

### 8.4 Pestaña Mis documentos (admin)

- Cuotas y planes por cliente
- Explorador archivos del cliente
- Enlaces compartidos: listar, revocar, copiar URL

### 8.5 Pestaña Notificaciones

Crear avisos para Inicio: título, mensaje, severidad, audiencia (todos/admins/clientes), vigencia desde-hasta. Crear, editar, eliminar.

### 8.6 Pestaña Backups

Crear, listar, descargar, restaurar (confirmación doble), eliminar. Incluye perfiles, permisos, tablas, inventario, bóveda, links, etc.

### 8.7 Pestaña Inicio (layout widgets)

**Por cliente:** activar/desactivar widgets, orden, tamaño, guardar, copiar de otro, resetear, previsualizar.

**Plantilla global:** default Up Crop; aplicar a todos.

### 8.8 Pestaña Enlaces

URLs Looker Studio (u otros informes) por módulo y cliente.

### 8.9 Registro de Actividad (`/admin/auditoria`)

Logins, bloqueos, impersonación, bóveda, permisos, backups, mantenimiento. Filtrable por fecha, usuario, acción.

---

## 9. Página pública de documentos compartidos

**Ruta:** `/compartir/[código]` — sin login.

- Acceso con enlace temporal (1/7/14/30 días)
- Un solo archivo
- Descarga directa
- Revocable por admin o dueño

No da acceso a la bóveda ni a la plataforma.

---

## 10. Seguridad

| Medida | Beneficio |
|--------|-----------|
| Invitación cerrada | No hay registro público |
| Bloqueo por intentos | Anti fuerza bruta (~5 intentos) |
| Bloqueo manual IP | Cortar abusos |
| Cuentas suspendibles | Morosidad → sin acceso |
| Modo mantenimiento | Actualizar sin clientes |
| Datos aislados (RLS) | Un cliente no ve datos de otro |
| Bóveda por empresa | Sub usuarios solo su empresa |
| Auditoría | Trazabilidad de acciones |
| Modo soporte auditado | Admin como cliente queda registrado |
| Enlaces con expiración | Compartir sin abrir bóveda permanentemente |
| Geocerca | Inspector debe estar en sitio |

---

## 11. Flujo de un cliente nuevo

1. Admin crea cliente o **envía invitación**.
2. Cliente activa nombre y contraseña.
3. Admin **activa módulos** y asigna **plan servicio + almacenamiento**.
4. Admin configura **tablas, gráficos e Inicio** (Clientes).
5. Si aplica: **ubicación** asistencia técnica.
6. Cliente opera; se crean **sub usuarios** si hace falta.
7. Up Crop monitorea en **Resumen** y **Auditoría**.

---

## 12. Glosario

| Término | Significado |
|---------|-------------|
| **Módulo** | Sección de la app (Inventario, Mercado, etc.) |
| **Widget** | Tarjeta del Inicio (clima, divisas, alertas…) |
| **Cuartel** | Subdivisión de un campo/predio |
| **Fenología** | Etapas del ciclo del cultivo |
| **FOB** | Precio franco a bordo (exportación) |
| **Geocerca** | Radio en mapa para marcar asistencia |
| **Proforma** | Documento previo a factura (asistencia técnica) |
| **Cotización (proveedor)** | Oferta de precio de un proveedor externo, con archivo adjunto opcional |
| **Factura de compra (proveedor)** | Documento interno emitido a partir de una cotización aceptada |
| **UF** | Unidad de Fomento (planes en Chile) |
| **SII** | Servicio de Impuestos Internos (Libro de Compras) |
| **Sub usuario** | Persona de la misma empresa, acceso limitado |
| **RLS** | Seguridad en BD: cada fila solo la ve quien debe |
| **Modo soporte** | Admin navegando como cliente |

---

## 13. Mapa completo de la plataforma

```
ACCESO
├── Login (email, contraseña, recuperar, bloqueos)
├── Registro por invitación
└── Recuperar contraseña

DASHBOARD
├── Menú lateral (módulos por área, perfil, logout, admin)
├── Modo soporte (bandera admin)
├── Asistente IA (chat global)
├── Modo offline (fenología, estimación)
├── INICIO (widgets configurables)
│   ├── Alertas inteligentes
│   ├── Combustibles / insumos
│   ├── Divisas
│   ├── SAG
│   ├── Clima
│   ├── Mapa puertos
│   ├── Mercado resumen
│   ├── Rastreo satelital
│   └── Bóveda rápida
├── MÓDULOS
│   ├── PRODUCCIÓN: Fenología, Estimación (+ Plan cosecha)
│   ├── LOGÍSTICA: Centro Control, Inventario, Producto Terminado, Embalaje
│   ├── COMERCIO EXT.: Comercio Exterior, Mercado, Productores
│   ├── FINANZAS: Costos y Gastos, Proveedores, Plata
│   ├── DOCUMENTOS: Generación docs, Mis documentos
│   └── GENERAL: Asistencia técnica, Trazabilidad, dinámicos
└── MI PERFIL (plan, datos, storage, módulos, ubicación)

ADMIN (/admin)
├── Resumen (salud, mantenimiento, métricas)
├── Usuarios (permisos, invitaciones, bloqueos, soporte)
├── Clientes (tablas, gráficos, SII, inventario, producción)
├── Bóveda admin (cuotas, enlaces, explorador)
├── Notificaciones
├── Backups
├── Inicio (layout widgets)
├── Enlaces Looker
└── Auditoría

PÚBLICO
└── /compartir/[código]
```

---

## Índice de módulos en el menú (referencia)

| Slug / nombre | Área típica |
|---------------|-------------|
| Inicio | — (dashboard) |
| Estados fenológicos | Producción |
| Estimación de cosecha | Producción |
| Plan de cosecha | Producción (pestaña dentro de Estimación) |
| Planificación de producción / Proyección embalaje | Logística |
| Inventario | Logística |
| Producto terminado | Logística |
| Centro de control | Logística |
| Comercio exterior | Comercio exterior |
| Mercado | Comercio exterior |
| Costos y gastos | Finanzas |
| Generación de documentos | Documentos |
| Mis documentos (bóveda) | Documentos |
| Asistencia técnica | General |
| Trazabilidad | General |

*Otros módulos (Plata, Productores, Check List, etc.) son dinámicos y se crean según contrato.*

---

*Documento generado para Up Crop — MVP. Para ampliaciones de plan, permisos o capacitación, contactar al equipo Up Crop.*
