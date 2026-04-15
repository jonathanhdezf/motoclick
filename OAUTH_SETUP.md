# 🔐 MotoClick — Configuración de Login Social (Google + Facebook)

## 📋 Resumen

Se agregó soporte para iniciar sesión y registrarse con **Google** y **Facebook**. El flujo es:

1. Usuario hace clic en "Google" o "Facebook"
2. Es redirigido al proveedor OAuth
3. Al regresar, Supabase Auth crea la sesión JWT
4. El trigger `_mc_on_signup` crea automáticamente el perfil en `public.users`
5. El usuario es redirigido al portal correspondiente

---

## 🔧 Paso 1: Configurar Google OAuth

### 1a. Crear proyecto en Google Cloud Console

1. Ir a https://console.cloud.google.com/
2. Crear nuevo proyecto: `motoclick-auth`
3. Ir a **APIs & Services** → **OAuth consent screen**
4. Seleccionar **External** (o Internal si tienes Workspace)
5. Llenar:
   - App name: `MotoClick`
   - User support email: tu email
   - Developer contact: tu email
6. En **Scopes**, agregar: `email`, `profile`, `openid`
7. En **Test users**, agregar tu email de prueba

### 1b. Crear credenciales OAuth

1. Ir a **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `MotoClick Web`
5. **Authorized JavaScript origins**:
   - `https://motoclick.vercel.app`
   - `http://localhost:3000` (desarrollo)
6. **Authorized redirect URIs**:
   - `https://mwbpilczuziptavozbgw.supabase.co/auth/v1/callback`
   - `https://motoclick.vercel.app/cliente/nuevo-pedido.html`
   - `https://motoclick.vercel.app/repartidor/panel.html`
7. Copiar **Client ID** y **Client Secret**

### 1c. Configurar en Supabase

1. Ir a **Supabase Dashboard** → **Authentication** → **Providers**
2. Buscar **Google** y hacer clic
3. Toggle **Enable** → ON
4. Pegar **Client ID** y **Client Secret**
5. Guardar

---

## 🔧 Paso 2: Configurar Facebook OAuth

### 2a. Crear app en Meta for Developers

1. Ir a https://developers.facebook.com/
2. **Create App** → **Consumer** → **Continue**
3. App name: `MotoClick Auth`
4. Contact email: tu email
5. Ir a **Settings** → **Basic**
6. Copiar **App ID** y **App Secret**
7. En **Valid OAuth Redirect URIs**, agregar:
   - `https://mwbpilczuziptavozbgw.supabase.co/auth/v1/callback`
   - `https://motoclick.vercel.app/cliente/nuevo-pedido.html`
   - `https://motoclick.vercel.app/repartidor/panel.html`
8. En **App Domains**, agregar:
   - `motoclick.vercel.app`
   - `supabase.co`
9. Hacer la app **Public** (Settings → Advanced → Mode → Live)

### 2b. Configurar en Supabase

1. Ir a **Supabase Dashboard** → **Authentication** → **Providers**
2. Buscar **Facebook** y hacer clic
3. Toggle **Enable** → ON
4. Pegar **App ID** y **App Secret**
5. Guardar

---

## 🔧 Paso 3: Ejecutar SQL de configuración

Ejecutar `auth_setup.sql` en el SQL Editor de Supabase.

Esto actualiza el trigger `_mc_on_signup` para:
- Extraer nombre, foto y email de Google/Facebook metadata
- Marcar usuarios OAuth como **verificados automáticamente**
- Guardar la foto de perfil del proveedor social
- Manejar conflictos si el usuario ya existe

---

## 🔧 Paso 4: Deploy

Los archivos modificados ya incluyen los botones sociales:

| Archivo | Cambio |
|---|---|
| `js/auth.js` | Métodos `signInWithGoogle()`, `signInWithFacebook()`, `completeOAuthProfile()` |
| `js/store.js` | Métodos `loginWithGoogle()`, `loginWithFacebook()`, `handleOAuthCallback()` |
| `cliente/index.html` | Botones de Google y Facebook en login + register |
| `repartidor/index.html` | Botones de Google y Facebook en login |

Push a Vercel:
```bash
git add -A
git commit -m "feat: agregar login social con Google y Facebook"
git push
```

---

## 📱 Flujo de Teléfono para OAuth

Google y Facebook **NO proporcionan el número de teléfono** durante el flujo OAuth estándar. Por eso, MotoClick implementa este flujo:

```
┌──────────────────────────────────────────────────────┐
│              FLUJO DE TELÉFONO OAuth                 │
│                                                      │
│ 1. Usuario inicia sesión con Google/Facebook        │
│ 2. Vuelve del redirect de OAuth                     │
│ 3. Sistema verifica si tiene teléfono en el perfil  │
│ 4a. Si NO tiene teléfono → Modal "¡Casi listo!"    │
│     - Input para celular (10 dígitos)               │
│     - Checkbox de términos                          │
│     - Validación de duplicados                      │
│     - Al guardar → continúa al portal               │
│                                                      │
│ 4b. Si YA tiene teléfono → Continúa normalmente     │
│     (usuario que ya se registró antes)              │
└──────────────────────────────────────────────────────┘
```

### Validaciones del teléfono

- Debe ser exactamente 10 dígitos numéricos
- No puede estar registrado por otro usuario
- Se marca como `is_verified: true` automáticamente
- Se guarda tanto en `public.users` como en `auth.users` metadata

---

### Login Social

```
┌────────────────────────────────────────────────────────┐
│                   FLUJO GOOGLE                         │
│                                                        │
│ 1. Usuario clic en "Google"                           │
│ 2. Redirige a accounts.google.com                     │
│ 3. Usuario elige cuenta Google                        │
│ 4. Google redirige de vuelta a Supabase               │
│ 5. Supabase crea sesión JWT + trigger crea perfil     │
│ 6. Redirige a /cliente/nuevo-pedido.html              │
│                                                        │
│                    FLUJO FACEBOOK                      │
│                                                        │
│ 1. Usuario clic en "Facebook"                         │
│ 2. Redirige a facebook.com/vX.X/dialog/oauth          │
│ 3. Usuario autoriza la app                            │
│ 4. Facebook redirige de vuelta a Supabase             │
│ 5. Supabase crea sesión JWT + trigger crea perfil     │
│ 6. Redirige a /cliente/nuevo-pedido.html              │
└────────────────────────────────────────────────────────┘
```

### Registro Automático

Si el usuario **no existe** en Supabase Auth:
- Se crea la cuenta automáticamente con los datos de Google/Facebook
- El trigger crea el perfil en `public.users` con:
  - `name` = nombre de Google/Facebook
  - `profile_photo_url` = foto de perfil del proveedor
  - `is_verified` = `true` (usuarios sociales se consideran verificados)
  - `role` = `client` (o `driver` si viene del portal de repartidor)

Si el usuario **ya existe**:
- Solo inicia sesión, no se duplica

---

## 🐛 Troubleshooting

### "Redirect URI mismatch"
Verificar que los redirect URIs en Google/Facebook coincidan exactamente con:
```
https://mwbpilczuziptavozbgw.supabase.co/auth/v1/callback
```

### Usuario no se redirige después de OAuth
Verificar que `redirectTo` en `signInWithOAuth()` apunta a la URL correcta del portal.

### Perfil no se crea después de OAuth
El trigger `_mc_on_signup` puede fallar si:
1. No se ejecutó `auth_setup.sql`
2. La columna `user_id` no existe en `public.users`
3. Hay un constraint de unique violado

Solución: Re-ejecutar `auth_setup.sql`.

### "Google 400: redirect_uri_mismatch"
Ir a Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Verificar que el redirect URI de Supabase esté en la lista.

### "Facebook: URL Blocked"
Ir a Meta for Developers → Settings → Basic → Valid OAuth Redirect URIs → Agregar el redirect URI de Supabase.

### El usuario OAuth no puede ver sus pedidos
Verificar que el trigger creó el perfil correctamente:
```sql
SELECT id, name, user_id, role, is_verified 
FROM public.users 
WHERE user_id = 'AUTH_USER_ID';
```

Si no existe, crearlo manualmente:
```sql
INSERT INTO public.users (user_id, name, phone, role, is_verified, verification_status, verification_date)
VALUES ('AUTH_USER_ID', 'Nombre', 'email@google.com', 'client', true, 'verified', NOW());
```

---

## ✅ Checklist Final

- [ ] Google Cloud Console: proyecto creado con OAuth consent screen
- [ ] Google: Client ID y Client Secret obtenidos
- [ ] Google: Redirect URI de Supabase autorizado
- [ ] Supabase: Google provider habilitado con credenciales
- [ ] Facebook: App creada en Meta for Developers
- [ ] Facebook: App ID y App Secret obtenidos
- [ ] Facebook: Redirect URI de Supabase autorizado
- [ ] Facebook: App mode → Live (pública)
- [ ] Supabase: Facebook provider habilitado con credenciales
- [ ] SQL `auth_setup.sql` ejecutado (trigger actualizado)
- [ ] `rls_policies_produccion.sql` ejecutado (políticas RLS)
- [ ] Botones sociales visibles en cliente/index.html
- [ ] Botones sociales visibles en repartidor/index.html
- [ ] Login con Google probado y funcionando
- [ ] Login con Facebook probado y funcionando
- [ ] Usuarios OAuth pueden crear pedidos
- [ ] Usuarios OAuth pueden ver sus pedidos (RLS funciona)
- [ ] Deploy a Vercel completado

---

## 🎨 Personalización

### Cambiar el rol por defecto de OAuth

En `auth.js`, modificar los métodos `signInWithGoogle()` y `signInWithFacebook()`:

```js
// Cambiar de 'client' a 'driver'
const redirectTo = role === 'driver'
  ? window.location.origin + '/repartidor/panel.html'
  : window.location.origin + '/cliente/nuevo-pedido.html';
```

### Agregar verificación para repartidores OAuth

Si quieres que los repartidores que se registran con OAuth necesiten verificación adicional, modificar el trigger:

```sql
-- En el trigger _mc_on_signup, agregar:
IF v_role = 'driver' THEN
  v_is_verified := false;  -- Repartidores OAuth necesitan verificación manual
END IF;
```

### Agregar botón de Apple Sign-In

El proceso es similar. Agregar en Supabase:
1. Authentication → Providers → Apple → Enable
2. Agregar Client ID y Private Key desde developer.apple.com
3. En `auth.js` agregar `signInWithApple()` siguiendo el mismo patrón
