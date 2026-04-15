# 🛵 MotoClick — Guía de Migración a Supabase Auth

## 📋 Resumen de Cambios

### Archivos Creados
| Archivo | Propósito |
|---|---|
| `js/auth.js` | Módulo de autenticación con Supabase Auth |
| `auth_setup.sql` | Configuración de Supabase Auth |
| `rls_policies_produccion.sql` | Políticas de seguridad RLS |

### Archivos Modificados
| Archivo | Cambio |
|---|---|
| `js/store.js` | `loginUser()` y `registerUser()` ahora usan Supabase Auth |
| `js/utils.js` | `requireAuth()` valida sesión JWT, `handleLogout()` usa `store.logout()` |
| `cliente/index.html` | Agregado `auth.js`, login/register ahora autentican con JWT |
| `repartidor/index.html` | Agregado `auth.js`, login/register ahora autentican con JWT |
| `admin/index.html` | Eliminado password hardcodeado, ahora usa Supabase Auth |

---

## 🔧 Paso 1: Configurar Supabase Auth

### 1a. Habilitar Email Auth en el Dashboard

1. Ir a **Supabase Dashboard** → **Authentication** → **Providers**
2. Habilitar **Email** provider
3. Desactivar **Confirm email** (auto-confirm para desarrollo)
4. En **Site URL** poner: `https://motoclick.vercel.app`
5. En **Redirect URLs** agregar:
   - `https://motoclick.vercel.app/cliente/nuevo-pedido.html`
   - `https://motoclick.vercel.app/repartidor/panel.html`
   - `https://motoclick.vercel.app/admin/panel.html`

### 1b. Ejecutar SQL de configuración

Ejecutar `auth_setup.sql` en el SQL Editor de Supabase.

### 1c. Ejecutar políticas RLS

Ejecutar `rls_policies_produccion.sql` en el SQL Editor de Supabase.

---

## 🔧 Paso 2: Crear Cuenta de Administrador

La cuenta de admin se crea manualmente en Supabase Auth:

### Opción A: Desde el Dashboard de Supabase

1. Ir a **Authentication** → **Users** → **Add user** → **Create new user**
2. Email: `admin@motoclick.app`
3. Password: `Admin2026!` (o la contraseña que elijas)
4. **User Metadata** (JSON):
   ```json
   {
     "name": "Administrador",
     "phone": "0000000000",
     "role": "admin"
   }
   ```
5. Confirmar creación

### Opción B: Desde SQL (si el dashboard no permite)

```sql
-- Crear el perfil en public.users (el auth.users se crea desde el dashboard)
INSERT INTO public.users (name, phone, role, user_id, created_at)
VALUES (
  'Administrador',
  '0000000000',
  'admin',
  (SELECT id FROM auth.users WHERE email = 'admin@motoclick.app'),
  NOW()
);
```

---

## 🔧 Paso 3: Migrar Usuarios Existentes

Los usuarios que ya tienen cuentas en `public.users` con PIN necesitan migrarse a `auth.users`.

### Opción Automática (Recomendada)

Los usuarios existentes pueden seguir usando su teléfono + PIN como antes. La diferencia es que ahora:
1. El PIN se usa como contraseña en Supabase Auth
2. Se crea un "email virtual" invisible: `{telefono}@motoclick.app`
3. Al primer login, el sistema crea automáticamente la cuenta en `auth.users`

**No se necesita migración masiva** — los usuarios migran automáticamente al hacer login por primera vez.

### Opción Manual (Para forzar migración inmediata)

Si quieres migrar todos los usuarios de golpe:

```sql
-- Ver cuántos usuarios necesitan migración
SELECT count(*) FROM public.users 
WHERE user_id IS NULL AND pin IS NOT NULL;

-- Ejecutar migración
SELECT * FROM public.migrate_existing_users();
```

⚠️ **Nota**: La función `migrate_existing_users()` tiene limitaciones porque insertar directamente en `auth.users` no es recomendado. La mejor práctica es que cada usuario haga login una vez y Supabase Auth cree la cuenta automáticamente.

---

## 🔧 Paso 4: Deploy

### 4a. Subir archivos nuevos

```bash
git add js/auth.js
git add auth_setup.sql
git add rls_policies_produccion.sql
git add MIGRACION_AUTH.md
git commit -m "feat: migrar a Supabase Auth con RLS policies"
git push
```

### 4b. Verificar en producción

1. Ir a `https://motoclick.vercel.app/cliente/`
2. Intentar registrarse con un teléfono nuevo
3. Verificar que el redirect a `nuevo-pedido.html` funciona
4. Ir a `https://motoclick.vercel.app/repartidor/`
5. Intentar login con un repartidor registrado
6. Ir a `https://motoclick.vercel.app/admin/`
7. Login con credenciales de admin

---

## 🔧 Paso 5: Verificar RLS

Después de que los usuarios hagan login con Supabase Auth, verificar que las políticas RLS funcionan:

```sql
-- Ver políticas activas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

Deberías ver 27+ políticas (no las 6 de "Global Dev Access").

---

## 🐛 Troubleshooting

### "Ya existe una cuenta con ese teléfono"
El usuario ya se registró antes. Usar "Iniciar Sesión" en lugar de "Registrarme".

### "Esta cuenta no tiene permisos de cliente/repartidor"
El usuario fue registrado con un rol diferente al del portal. Verificar en Supabase:
```sql
SELECT id, phone, role, user_id FROM public.users WHERE phone = 'NUMERO';
```

### Admin no puede iniciar sesión
Verificar que:
1. La cuenta existe en `auth.users` con email `admin@motoclick.app`
2. El perfil en `public.users` tiene `role = 'admin'`
3. La contraseña es correcta (mínimo 6 caracteres)

### Sesión no persiste al recargar
Verificar que `auth.js` está cargado ANTES de `store.js` en cada HTML:
```html
<script src="../js/auth.js"></script>
<script src="../js/store.js"></script>
```

### Error "user_id::TEXT = auth.uid()::TEXT"
Las políticas RLS requieren que el usuario tenga `user_id` vinculado a `auth.users.id`. Si un usuario no tiene este vínculo:
```sql
UPDATE public.users 
SET user_id = (SELECT id FROM auth.users WHERE phone = '+' || users.phone)
WHERE user_id IS NULL;
```

---

## 📊 Flujo de Autenticación Actual

```
┌─────────────────────────────────────────────────────────┐
│                    NUEVO USUARIO                        │
│                                                         │
│ 1. Ingresa nombre + teléfono + PIN                     │
│ 2. store.registerUser() → auth.signUp()                │
│ 3. Supabase Auth crea cuenta en auth.users             │
│ 4. Trigger _mc_on_signup crea perfil en public.users   │
│ 5. Redirect al portal correspondiente                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    LOGIN EXISTENTE                      │
│                                                         │
│ 1. Ingresa teléfono + PIN                              │
│ 2. store.loginUser() → auth.signInWithPassword()       │
│ 3. Supabase Auth valida y devuelve sesión JWT          │
│ 4. Listener carga perfil desde public.users            │
│ 5. Redirect al portal correspondiente                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    PROTECCIÓN RLS                       │
│                                                         │
│ 1. Cada consulta a la DB incluye auth.uid() del JWT    │
│ 2. Las políticas RLS filtran por rol y pertenencia     │
│ 3. Un usuario SOLO puede ver/modificar SUS datos       │
│ 4. Admin tiene acceso total mediante _mc_is_admin()    │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist Final

- [ ] Supabase Auth habilitado (Email provider)
- [ ] `auth_setup.sql` ejecutado
- [ ] `rls_policies_produccion.sql` ejecutado
- [ ] Cuenta de admin creada en Supabase Auth
- [ ] Archivos nuevos subidos a Vercel (`auth.js`, etc.)
- [ ] Login de cliente funciona
- [ ] Login de repartidor funciona
- [ ] Login de admin funciona
- [ ] Logout funciona en todos los portales
- [ ] RLS verificado con usuario de prueba
- [ ] Usuarios existentes pueden hacer login sin problema
