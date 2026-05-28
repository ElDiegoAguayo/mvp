# Implementación: Sistema de Bloqueo de Login (Rate Limiting)

## Descripción
Se ha implementado un sistema de seguridad que bloquea el acceso de login por 1 hora después de 5 intentos fallidos desde la misma IP/email. Todos los intentos se registran en la tabla `login_attempts` y se auditan en `audit_logs` con detalles de IP y dispositivo.

## Componentes Agregados

### 1. **`/app/auth/login-actions.ts`** - Server Actions
Funciones de seguridad que manejan:
- `checkLoginLockout()`: Verifica si un email/IP está bloqueado
- `recordLoginAttempt()`: Registra intentos de login (exitosos o fallidos)
- `auditSecurityEvent()`: Registra eventos de seguridad en audit_logs

### 2. **`/app/auth/login/page.tsx`** - Página de Login Actualizada
Cambios principales:
- Obtiene IP del cliente y User-Agent
- Verifica bloqueos antes de permitir login
- Registra todos los intentos
- Audita eventos de seguridad
- Interfaz visual mejorada que muestra estado de bloqueo

### 3. **`/supabase/migrations/001_create_login_attempts_table.sql`** - Migration SQL
Crea la tabla `login_attempts` con:
- Columnas: id, email, ip_address, user_agent, success, attempted_at
- Índices optimizados para consultas rápidas
- RLS (Row Level Security) configurado
- Comentarios para documentación

## Flujo de Seguridad

```
Usuario intenta login
    ↓
¿Está bloqueado por 5 intentos fallidos?
    ├─ SÍ → Mostrar error "Bloqueado por X minutos" + Auditar
    └─ NO → Continuar
    ↓
¿Credenciales válidas?
    ├─ NO → Registrar intento fallido + Auditar + Contar intentos
    │       Si llegó a 5: Auditar LOCKOUT_TRIGGERED
    └─ SÍ → ¿Cuenta activa?
            ├─ NO → Auditar LOGIN_BLOCKED (suspensión)
            └─ SÍ → Registrar intento exitoso + Auditar + Redirigir
```

## Configuración Requerida

### Paso 1: Ejecutar Migration SQL
1. Abre [Supabase Dashboard](https://app.supabase.com)
2. Ve a tu proyecto
3. Abre "SQL Editor"
4. Copia todo el contenido de `/supabase/migrations/001_create_login_attempts_table.sql`
5. Ejecuta el SQL
6. Verifica que la tabla `login_attempts` aparece en "Tables"

### Paso 2: Verificar IP Detection
El login actualmente usa `ipify.org` para detectar la IP del cliente. Si necesitas cambiar el proveedor:
- Busca en `/app/auth/login/page.tsx` la línea con `ipify.org`
- Reemplaza con tu servicio preferido

### Paso 3: Personalizar Constantes (Opcional)
En `/app/auth/login-actions.ts`, puedes ajustar:
```typescript
const MAX_LOGIN_ATTEMPTS = 5              // Cambiar número de intentos
const LOCKOUT_DURATION_MINUTES = 60       // Cambiar duración del bloqueo
```

## Registros de Auditoría

Los siguientes eventos se auditan automáticamente en la tabla `audit_logs`:

| Evento | Descripción |
|--------|-------------|
| `LOGIN_FAILED` | Intento de login con credenciales inválidas |
| `LOGIN_LOCKOUT_TRIGGERED` | Account bloqueado después de 5 intentos |
| `LOGIN_SUCCESS` | Login exitoso |
| `LOGIN_BLOCKED` | Acceso denegado por cuenta suspendida |

Cada evento incluye:
- **IP Address**: Dirección IP del cliente
- **User-Agent**: Dispositivo/navegador utilizado
- **Email**: Usuario que intentó login
- **Timestamp**: Cuándo ocurrió

## Visualización en Admin Panel

En `/admin/auditoria/`, podrás ver:
- Filtro **"Nivel de Riesgo"** para eventos críticos (LOGIN_LOCKOUT_TRIGGERED, LOGIN_FAILED)
- Columnas **"IP / Origen"** y **"Dispositivo"** que muestran detalles del intento
- **ShieldAlert** rojo para eventos de seguridad críticos

## Consideraciones de Seguridad

✅ **Implementado:**
- Bloqueo temporal por IP + email (evita brute force distribuido y simple)
- Registro detallado de intentos con IP/dispositivo
- Auditoría automática en `audit_logs`
- Mensajes de error genéricos (no revela si email existe)
- Limpieza automática de intentos antiguos (se guardan solo últimos 60 min)

⚠️ **Nota sobre VPN/Proxies:**
- Si usuarios legítimos usan VPN, podrían bloquearse mutuamente
- Los intentos se limpian automáticamente después de 60 minutos
- Considera agregar mecanismo de "recovery code" si es crítico

## Troubleshooting

**P: Los intentos no se están registrando**
R: Verifica que la tabla `login_attempts` existe en Supabase y que las RLS policies están configuradas.

**P: No veo los eventos en audit_logs**
R: Asegúrate de que `audit_logs` tiene inserción permitida sin restricciones de RLS para Server Actions.

**P: ¿Cómo desbloquer un usuario manualmente?**
R: En Supabase SQL Editor:
```sql
DELETE FROM login_attempts 
WHERE email = 'usuario@email.com' 
AND attempted_at > NOW() - INTERVAL '1 hour';
```

## Testing Local

Para probar sin IP real, modifica temporalmente en `/app/auth/login-actions.ts`:
```typescript
// Durante testing, usa IP mock:
const clientIp = '192.168.1.100'; // O descomenta para usar real
```
