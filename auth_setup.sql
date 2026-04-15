-- ==============================================================================
-- MotoClick — Configuración de Supabase Auth para Migración + OAuth Social
-- ==============================================================================
-- Ejecutar en SQL Editor del dashboard de Supabase.
-- Configura autenticación por teléfono/email + Google + Facebook.
-- ==============================================================================

-- ==============================================================================
-- 1. Habilitar autenticación por teléfono en Supabase Auth
-- ==============================================================================
-- Esto se configura desde el Dashboard de Supabase:
-- Settings → Auth → Providers → Phone → Enable
-- Settings → Auth → Providers → Google → Enable
-- Settings → Auth → Providers → Facebook → Enable

-- ==============================================================================
-- 2. Actualizar trigger para manejar OAuth social correctamente
-- ==============================================================================

CREATE OR REPLACE FUNCTION public._mc_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_photo TEXT;
  v_provider TEXT;
  v_is_verified BOOLEAN := false;
BEGIN
  -- Extraer metadata del usuario OAuth o email signup
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.email,
    'Usuario'
  );

  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone,
    NEW.email,
    ''
  );

  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );

  v_photo := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photo_url',
    NULL
  );

  v_provider := COALESCE(
    NEW.app_metadata->>'provider',
    'email'
  );

  -- Usuarios OAuth se consideran verificados automáticamente
  IF v_provider IN ('google', 'facebook', 'apple', 'github') THEN
    v_is_verified := true;
  END IF;

  INSERT INTO public.users (
    user_id,
    name,
    phone,
    role,
    pin,
    profile_photo_url,
    is_verified,
    verification_status,
    verification_date,
    created_at
  ) VALUES (
    NEW.id,
    v_name,
    v_phone,
    v_role,
    NULL,  -- OAuth users no tienen PIN
    v_photo,
    v_is_verified,
    CASE WHEN v_is_verified THEN 'verified' ELSE 'not_requested' END,
    CASE WHEN v_is_verified THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url),
    is_verified = EXCLUDED.is_verified OR public.users.is_verified,
    verification_status = CASE
      WHEN EXCLUDED.is_verified THEN 'verified'
      ELSE public.users.verification_status
    END;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. El trigger YA EXISTE (creado por rls_policies_produccion.sql).
--    Como usamos CREATE OR REPLACE FUNCTION arriba, el trigger usa
--    automáticamente la nueva versión con soporte OAuth.
--    NO es necesario recrear el trigger.
--
--    Si por alguna razón el trigger NO existe, ejecutar manualmente:
--
--    CREATE TRIGGER _mc_auth_trigger
--      AFTER INSERT ON auth.users
--      FOR EACH ROW EXECUTE FUNCTION public._mc_on_signup();
-- ═══════════════════════════════════════════════════════════════════════

-- Verificar que el trigger existe:
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = '_mc_auth_trigger';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Configuración recomendada en el Dashboard de Supabase
-- ═══════════════════════════════════════════════════════════════════════
--
-- Settings → Auth:
-- ✅ Site URL: https://motoclick.vercel.app
-- ✅ Redirect URLs: 
--    - https://motoclick.vercel.app/cliente/nuevo-pedido.html
--    - https://motoclick.vercel.app/repartidor/panel.html
--    - https://motoclick.vercel.app/admin/panel.html
--
-- Settings → Auth → Providers → Email:
-- ✅ Enable Email
-- ❌ Confirm email (desactivar para desarrollo, activar en producción)
--
-- Settings → Auth → Providers → Google:
-- ✅ Enable Google
-- 📋 Client ID: (obtener de Google Cloud Console)
-- 🔐 Client Secret: (obtener de Google Cloud Console)
--
-- Settings → Auth → Providers → Facebook:
-- ✅ Enable Facebook
-- 📋 App ID: (obtener de Meta for Developers)
-- 🔐 App Secret: (obtener de Meta for Developers)
--
-- ==============================================================================

