# Manual del Cliente — Up Crop

**Plataforma:** https://mvp-smoky-tau.vercel.app  
**Audiencia:** Clientes principales y sub usuarios de empresas contratantes  
**Versión:** Mayo 2026

> Este manual describe **solo lo que tú ves y puedes hacer** como cliente.  
> Para una visión completa de la plataforma (incluido el equipo Up Crop), consulta `MANUAL-USUARIO-UP-CROP.md`.

---

## Tabla de contenidos

1. [Bienvenida](#1-bienvenida)
2. [Tu cuenta](#2-tu-cuenta)
3. [Entrar y salir de la plataforma](#3-entrar-y-salir-de-la-plataforma)
4. [Cómo moverte por Up Crop](#4-cómo-moverte-por-up-crop)
5. [Inicio — tu tablero principal](#5-inicio--tu-tablero-principal)
6. [Mi perfil](#6-mi-perfil)
7. [Módulos disponibles](#7-módulos-disponibles)
8. [Compartir documentos con terceros](#8-compartir-documentos-con-terceros)
9. [Seguridad y buenas prácticas](#9-seguridad-y-buenas-prácticas)
10. [Preguntas frecuentes](#10-preguntas-frecuentes)
11. [Glosario](#11-glosario)
12. [Mapa de lo que ves como cliente](#12-mapa-de-lo-que-ves-como-cliente)

---

## 1. Bienvenida

### ¿Qué es Up Crop?

Up Crop es la plataforma web de tu empresa agrícola o agroindustrial. Desde aquí puedes consultar y operar la información de tu negocio: producción en campo, inventarios, costos, mercado, documentos y más, según lo que tu contrato incluya.

### Lo más importante que debes saber

| Punto | Detalle |
|-------|---------|
| **Solo ves lo contratado** | Cada empresa tiene módulos distintos. Si no ves una sección en el menú, no está activa en tu cuenta. |
| **No te registras solo** | Up Crop te envía una invitación o crea tu acceso. No hay registro público. |
| **Sub usuarios** | Personas de tu misma empresa con permisos más acotados; comparten plan y almacenamiento contigo. |
| **Soporte humano** | Para ampliar plan, módulos o permisos, contacta a Up Crop (WhatsApp o correo en Mi perfil). |

### ¿Eres cliente principal o sub usuario?

| | Cliente principal | Sub usuario |
|---|-------------------|-------------|
| **Quién** | La empresa contratante | Colaborador de la misma empresa |
| **Inicio** | Sí | Sí (si tiene permiso) |
| **Mi perfil** | Completo + sub usuarios vinculados | Ve la cuenta principal a la que pertenece |
| **Proformas asistencia técnica** | Puede aprobar/rechazar | No |
| **Plan y almacenamiento** | El de la empresa | Hereda el del cliente principal |

---

## 2. Tu cuenta

### Plan de servicio

Up Crop asigna a tu empresa uno de estos planes (o ninguno hasta activar contrato):

| Plan | Para quién | Referencia |
|------|------------|------------|
| **Esencial** | Primer paso digital | ~12,5 UF/mes |
| **Enterprise** | Operaciones escaladas | ~18,5 UF/mes |
| **Business** | Agroindustria / holdings | A medida |

En **Mi perfil** verás:

- Nombre del plan y descripción
- Estado: **Activo**, **Por vencer** o **Vencido**
- **Fecha y hora de activación** del plan actual
- **Fecha y hora de vencimiento** (vigencia de 1 mes por ciclo; Up Crop renueva al gestionar el contrato)

Si el plan está por vencer o vencido, contacta a Up Crop para renovar.

### Almacenamiento (bóveda)

Tu empresa tiene una cuota compartida (10, 25, 50 o 100 GB según contrato). La barra de uso aparece en **Mi perfil** y en **Mis documentos**. Los sub usuarios consumen la misma cuota.

### Idioma

Puedes cambiar entre **español** e **inglés** con el selector en el pie del menú lateral.

---

## 3. Entrar y salir de la plataforma

### Iniciar sesión

**Ruta:** `/auth/login`

1. Ingresa **email** y **contraseña**.
2. Pulsa **Ingresar**.
3. Si todo es correcto, llegas a **Inicio** (o al módulo que Up Crop configuró para ti).

**Mensajes que puedes ver:**

| Mensaje | Qué hacer |
|---------|-----------|
| Credenciales inválidas | Revisa email y contraseña |
| Demasiados intentos | Espera el tiempo indicado |
| Cuenta suspendida / bloqueada | Contacta a Up Crop |
| Mantenimiento | La plataforma está en actualización; intenta más tarde |

### Activar cuenta (primera vez)

Solo con **enlace de invitación** por correo (`/auth/registro`):

- Nombre completo
- Contraseña (mínimo 8 caracteres)
- Confirmar contraseña

### Recuperar contraseña

`/auth/recuperar-contrasena` → email → enlace en correo → nueva contraseña.

### Cerrar sesión

Botón **Cerrar sesión** en el pie del menú lateral.

---

## 4. Cómo moverte por Up Crop

### Menú lateral

**Arriba:** logo Up Crop y botón para colapsar el menú (en celular: menú hamburguesa).

**Centro:** tus módulos agrupados por área (Producción, Logística, Finanzas, Documentos, etc.). El ítem activo queda resaltado.

**Abajo:**

| Elemento | Función |
|----------|---------|
| Avatar / nombre | Ir a **Mi perfil** |
| Icono del plan | Esencial (bronce), Enterprise (plata), Business (dorado) |
| **Cerrar sesión** | Salir |
| **Selector de idioma** | ES / EN |

> **Nota:** No verás **Panel Admin** — es solo para el equipo Up Crop.

### Asistente IA

Icono de chat flotante en todas las pantallas del dashboard. Ayuda orientativa; no reemplaza contratos, facturación ni permisos (para eso, contacta a Up Crop).

### Modo sin conexión

En **Estados fenológicos** y **Estimación de cosecha**:

- Banner cuando no hay internet
- Registros guardados en cola local
- Sincronización automática al reconectar
- Indicador en filas pendientes de subir

---

## 5. Inicio — tu tablero principal

**Ruta:** `/dashboard`

### Encabezado

Saludo personalizado: *“Bienvenido a Up Crop, [tu nombre]”*.

### Widgets

Up Crop configura qué tarjetas ves y en qué orden. Ejemplos habituales:

| Widget | Qué muestra |
|--------|-------------|
| **Alertas inteligentes** | Avisos de Up Crop + alertas automáticas (helada, tipo de cambio, stock bajo, etc.) |
| **Combustibles / insumos** | Petróleo, diésel, gas natural |
| **Divisas** | Dólar, UF, Euro, Yuan + conversor |
| **Alertas SAG** | Resoluciones fitosanitarias oficiales |
| **Clima** | Temperatura, humedad, pronóstico por región |
| **Mapa de puertos** | Puertos de embarque exportación |
| **Mercado (resumen)** | Precios de fruta con tendencia |
| **Rastreo satelital** | Buscar contenedor o booking |
| **Bóveda (acceso rápido)** | Documentos recientes |

Si falta un widget, Up Crop puede activarlo en tu contrato.

---

## 6. Mi perfil

**Ruta:** `/dashboard/perfil` (clic en tu nombre en el menú).

### Plan contratado (tarjeta superior)

- Plan activo (Esencial, Enterprise o Business)
- Badge de estado: Activo / Por vencer / Vencido
- **Activado el** [fecha] **a las** [hora]
- **Válido hasta** [fecha] **a las** [hora]
- Valor mensual en UF (o “A medida” en Business)
- Botones para ver catálogo de planes y **Contactar a Up Crop**

### Datos personales

- Nombre (con color e icono según tu plan)
- Correo
- Rol: Cliente o Sub usuario
- Módulos activos (conteo)
- Miembro desde
- **Sub usuarios vinculados** (solo cliente principal)
- **Cuenta principal** (solo sub usuario: nombre y correo del padre)

### Almacenamiento

- Barra de uso vs. cuota
- Desglose por módulo (Mis documentos, Fenología, etc.)
- Aviso si la cuota está casi llena → contactar soporte para ampliar

### Módulos activos

Lista con icono y nombre de cada módulo habilitado para ti.

### Ubicación de trabajo

(Si tienes **Asistencia técnica**) mapa con dirección y radio de geocerca donde los inspectores deben marcar entrada/salida.

### Catálogo de planes

Tarjetas comparativas Esencial, Enterprise y Business con beneficios y datos de contacto.

---

## 7. Módulos disponibles

Solo aparecen en el menú los módulos activos en tu cuenta. Abajo, qué puedes hacer en cada uno **como cliente**.

---

### 7.1 Inventario

**Para qué sirve:** Ver stock de bodegas y materiales.

**Qué ves:**

- KPIs: total registros, OK, bajo mínimo, sin stock
- Tabla: bodega, material, cantidad, unidad, estado, último movimiento
- Filtros por búsqueda, bodega y estado

**Qué no haces aquí:** crear bodegas ni registrar movimientos — Up Crop o tu administrador interno gestiona eso por backend.

---

### 7.2 Estados fenológicos

**Para qué sirve:** Seguimiento semanal del cultivo por cuartel, con fotos de campo.

**Pestaña Seguimiento**

- Filtros: cultivo, temporada, variedad, cuartel
- Resumen de cuarteles, lecturas y fotos
- Línea de tiempo por semana
- **Nueva lectura**, editar, eliminar
- Subir fotos (hasta 8 por lectura)
- Importar / exportar Excel
- Modo offline con sincronización

**Pestaña Catálogo**

- Etapas fenológicas de referencia por cultivo
- Plantillas predeterminadas

---

### 7.3 Estimación de cosecha

**Ruta:** `/dashboard/estimacion-cosecha`  
*(El acceso “Plan de cosecha” en el menú redirige aquí.)*

**Para qué sirve:** Del conteo en campo a kilos estimados y planificación de cosecha.

**Gestión de campos y cuarteles**

- Alta de campos y cuarteles (cultivo, variedad, hectáreas, plantas/ha)
- Filtros por temporada, cultivo, campo, cuartel, variedad
- Exportar Excel (desde tu cuenta)

**Pestaña Conteo**

- Muestras por árbol: dardos, ramillas, primordios, pre/post poda
- Tablas de detalle y resumen por cuartel
- Gráficos: promedio de dardos por cuartel, promedio de ramillas por cuartel, comparativa Pre vs Post poda
- **Disminución de carga** (variación entre pre y post poda)

- Los conteos que registra tu equipo Up Crop en campo aparecen aquí automáticamente (misma cuenta, misma temporada y cuarteles).
- **Solo lectura:** no puedes crear, editar, importar ni borrar conteos desde tu cuenta; puedes filtrar, ver gráficos y exportar Excel.

**Pestaña Estimación**

- kg/planta, kg/ha, kg totales
- Calcular desde conteo o estimación manual
- Tablas y gráficos; exportar Excel

**Pestaña Plan de cosecha**

- Ventanas de cosecha (fecha inicio/fin) por cuartel
- Diagrama Gantt + tabla

---

### 7.4 Planificación de producción / Proyección de embalaje

**Para qué sirve:** Cuántas cajas o pallets puedes armar con el stock de materiales de embalaje.

- Semáforo por código: Crítico / Bajo / OK
- Cajas armables y pallets completos
- **Insumos a reponer** + exportar lista de compra
- **Simulador:** “Si compro X, ¿cuántas cajas más?”

---

### 7.5 Costos y gastos

**Para qué sirve:** Clasificar gastos del Libro de Compras y analizar centros de costo.

**Flujo típico para ti:**

1. Up Crop importa tu Libro SII (Excel).
2. Tú **clasificas** facturas en la pestaña Clasificación.
3. Revisas **Centro de costos** y márgenes.

**Pestaña Clasificación**

- Proveedores con facturas pendientes (badge amarillo)
- Asignar categoría y centro de costo
- Dividir una factura entre varios centros

**Pestaña Centro de costos**

- Árbol de costos por módulo y entidad
- Margen por kilo vs. producción

---

### 7.6 Mercado

Precios **FOB** de referencia de fruta exportada.

- Filtros: fruta, variedad, país, puerto, moneda
- Precio actual y variación
- Mapa de puertos, historial 7 días, noticias, gráfico anual
- Exportar Excel

---

### 7.7 Comercio exterior

Operaciones de exportación/importación y **rastreo satelital** de contenedores (buscar booking, mapa en tiempo real).

---

### 7.8 Mis documentos (Bóveda)

Repositorio seguro de archivos de tu empresa.

| Acción | Detalle |
|--------|---------|
| Carpetas | Crear, navegar, eliminar |
| Subir | PDF, Excel, Word, imágenes; arrastrar o clic |
| Vencimiento | Opcional al subir |
| Vista previa | Tipos soportados |
| Descargar / eliminar / mover | Incluye selección múltiple |
| **Compartir enlace** | 1, 7, 14 o 30 días (ver sección 8) |
| Buscar | Por nombre y tipo |
| Cuota | Barra de almacenamiento compartida |

---

### 7.9 Generación de documentos

Crear contratos, informes o facturas en PDF/DOCX desde tablas de la plataforma:

Tipo → tabla → fila → columnas → generar y descargar.

---

### 7.10 Asistencia técnica

**Si eres cliente principal:**

- **Registros / Planilla:** historial de entradas y salidas de inspectores; exportar Excel
- **Proformas:** aprobar o rechazar documentos de cobro

**Ubicación:** en Mi perfil ves el mapa y radio donde deben marcar los inspectores.

---

### 7.11 Proveedores

**Ruta:** `/dashboard/proveedores`

Ciclo **empresa proveedora → cotización → factura de compra**.

| Pestaña | Qué haces |
|---------|-----------|
| **Empresas** | Registrar y editar proveedores (RUT, contacto, activo/inactivo) |
| **Cotizaciones** | Subir PDF/Excel/Word; asignar empresa; editar; generar orden de compra PDF |
| **Facturas de compra** | Ver facturas emitidas, estados de pago, descargar PDF |

**Flujo recomendado:**

1. Registrar empresas proveedoras.
2. Subir cotización (el sistema extrae datos del PDF cuando puede).
3. Asignar empresa (individual o en lote).
4. Generar orden de compra con cantidades por producto.
5. Gestionar facturas en la pestaña correspondiente.

---

### 7.12 Inventario fitosanitario

**Ruta:** `/dashboard/inventario-fitosanitario`

Control de bodegas por campo, stock, facturas, programa de aplicaciones y análisis de proveedores.

| Pestaña | Función |
|---------|---------|
| **Stock** | Entradas, salidas, stock actual |
| **Movimientos** | Historial completo |
| **Facturas** | Compras fitosanitarias |
| **Programa** | Calendario de aplicaciones (**Desde / Hasta** por producto) |
| **Análisis** | Participación por proveedor y tipo de producto |
| **Comparador** | Precio entre dos proveedores |
| **Bodegas / Productos** | Catálogo y configuración de bodegas |

**Importar Excel:** botón en el encabezado para cargar planilla tipo *Bodega Fitosanitaria*.

---

### 7.13 Módulos personalizados

Algunas empresas tienen tablas, gráficos o informes embebidos (Looker Studio, trazabilidad, check lists, etc.) configurados por Up Crop. Funcionan como pantallas adicionales en el menú con filtros, edición (si está permitida) e importación Excel.

---

## 8. Compartir documentos con terceros

Desde **Mis documentos**, puedes generar un enlace temporal para **un archivo**:

| Duración | Uso típico |
|----------|------------|
| 1 / 7 / 14 / 30 días | Enviar a banco, auditor, partner |

**Ruta pública:** `/compartir/[código]` — quien recibe el enlace descarga el archivo **sin** entrar a Up Crop.

Up Crop o tú pueden revocar el enlace antes de que expire.

---

## 9. Seguridad y buenas prácticas

| Medida | Qué significa para ti |
|--------|------------------------|
| Invitación cerrada | Nadie externo crea cuentas por su cuenta |
| Bloqueo por intentos | Protección si alguien prueba contraseñas |
| Cuenta suspendida | Sin acceso hasta regularizar con Up Crop |
| Datos aislados | Tu empresa no ve datos de otras empresas |
| Bóveda privada | Solo tu empresa (y sub usuarios autorizados) |
| Enlaces con expiración | Compartir sin abrir la bóveda permanentemente |
| Cierra sesión | En equipos compartidos, sal siempre al terminar |

---

## 10. Preguntas frecuentes

**No veo un módulo en el menú**  
No está activo en tu contrato. Escribe a Up Crop para solicitarlo.

**Soy sub usuario y no puedo aprobar proformas**  
Es normal; solo el cliente principal aprueba.

**Mi plan dice “Por vencer” o “Vencido”**  
Contacta a Up Crop para renovar el ciclo mensual del servicio.

**La cuota de almacenamiento está llena**  
Elimina archivos antiguos o pide ampliación a Up Crop.

**No puedo marcar asistencia (soy inspector)**  
Este manual es para clientes. Los inspectores usan otro flujo; consulta a tu coordinador Up Crop.

**¿Puedo cambiar el orden de los widgets de Inicio?**  
Lo configura Up Crop. Si necesitas otro diseño, solicítalo.

**¿Funciona sin internet?**  
Parcialmente en Fenología y Estimación de cosecha (modo offline). El resto requiere conexión.

---

## 11. Glosario

| Término | Significado |
|---------|-------------|
| **Módulo** | Sección de la app (Mercado, Bóveda, etc.) |
| **Widget** | Tarjeta del Inicio (clima, divisas…) |
| **Cuartel** | Subdivisión de un campo |
| **Fenología** | Etapas del ciclo del cultivo |
| **FOB** | Precio franco a bordo (exportación) |
| **Geocerca** | Zona en mapa para validar asistencia técnica |
| **Proforma** | Documento previo a factura de asistencia |
| **UF** | Unidad de Fomento (planes en Chile) |
| **Sub usuario** | Colaborador de tu empresa con acceso limitado |
| **Bóveda** | Mis documentos — almacenamiento seguro |

---

## 12. Mapa de lo que ves como cliente

```
ENTRADA
├── Login
├── Activar cuenta (invitación)
└── Recuperar contraseña

DESPUÉS DE ENTRAR
├── Menú lateral (módulos + perfil + idioma + salir)
├── Asistente IA (chat)
├── INICIO (/dashboard)
│   └── Widgets (alertas, clima, mercado, bóveda rápida…)
├── MI PERFIL (/dashboard/perfil)
│   ├── Plan contratado (fechas activación / vencimiento)
│   ├── Datos personales
│   ├── Almacenamiento
│   └── Módulos activos
└── MÓDULOS (según contrato)
    ├── Producción: Fenología, Estimación de cosecha
    ├── Logística: Inventario, Embalaje…
    ├── Finanzas: Costos, Proveedores…
    ├── Comercio: Mercado, Comercio exterior
    ├── Documentos: Bóveda, Generación docs
    └── General: Asistencia técnica, personalizados…

COMPARTIR (sin login)
└── /compartir/[código] — descarga de un archivo
```

---

## Contacto

Para plan, módulos, permisos, renovaciones o capacitación: datos en **Mi perfil → Contactar a Up Crop** (WhatsApp y correo).

---

*Manual del cliente Up Crop — MVP. Se actualiza junto con la plataforma. Última revisión: Mayo 2026.*
