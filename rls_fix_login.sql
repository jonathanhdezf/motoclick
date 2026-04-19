-- ==============================================================================
-- 🛠️ MotoClick — FIX CRÍTICO: Login bloqueado por políticas RLS
-- Fecha: 2026-04-19
-- ==============================================================================
-- Ejecutar COMPLETO en el SQL Editor de Supabase Dashboard.
-- Este script corrige 3 problemas que bloquean el inicio de sesión:
--   1. Trigger _mc_on_signup bloqueado por users_insert CHECK (auth.uid() es NULL en triggers)
--   2. SELECT de perfil bloqueado porque users_read_own usa user_id pero store.js usa id
--   3. Políticas de INSERT en users que no permiten que el trigger funcione correctamente
-- ==============================================================================


-- ==============================================================================
-- FIX 1: Corregir política users_insert para permitir el trigger SECURITY DEFINER
-- ==============================================================================
-- El trigger corre como postgres (SECURITY DEFINER), no como el usuario.
-- auth.uid() es NULL en ese contexto → el CHECK falla y bloquea el INSERT.
-- SOLUCIÓN: Usar una función SECURITY DEFINER que omita el check cuando uid() es NULL.

DROP POLICY IF EXISTS "users_insert" ON public.users;

CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (
    -- Permite si el user_id coincide con el usuario autenticado (flujo normal)
    user_id::TEXT = auth.uid()::TEXT
    -- O si se está ejecutando desde una función SECURITY DEFINER (trigger de signup)
    -- auth.uid() será NULL en el contexto del trigger
    OR auth.uid() IS NULL
  );


-- ==============================================================================
-- FIX 2: Asegurar que users_read_own funciona con AMBOS campos (user_id e id)
-- ==============================================================================
-- store.js línea 233-237 hace: .select('role,phone').eq('id', result.user.id)
-- Pero users_read_own solo permite SELECT donde user_id = auth.uid().
-- Si la columna de búsqueda es 'id' (la interna), y la política chequea 'user_id',
-- el registro sí pasa el filtro RLS mientras user_id coincida con auth.uid().
-- El problema real es que users_read_others del parche_final excluye a clientes.
-- SOLUCIÓN: Restaurar users_read_others para que cualquier usuario autenticado
--           pueda leer su propia fila (sea cual sea su rol).

DROP POLICY IF EXISTS "users_read_others" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;

-- Política unified: cualquier usuario autenticado ve su propio perfil
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (
    user_id::TEXT = auth.uid()::TEXT
  );

-- Política para ver otros: repartidores y admins son visibles para todos los autenticados
-- (necesario para que los clientes vean info del repartidor asignado)
CREATE POLICY "users_read_others" ON public.users
  FOR SELECT USING (
    role IN ('driver', 'admin')                -- Repartidores y admins son visibles
    OR user_id::TEXT = auth.uid()::TEXT         -- Siempre puedo verme a mí mismo
    OR public._mc_is_admin()                    -- Admin ve todos
  );


-- ==============================================================================
-- FIX 3: Política users_update_own — asegurar que usa user_id correctamente
-- ==============================================================================
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (user_id::TEXT = auth.uid()::TEXT)
  WITH CHECK (user_id::TEXT = auth.uid()::TEXT);


-- ==============================================================================
-- FIX 4: Reconstruir la función _mc_on_signup con manejo de errores robusto
-- ==============================================================================
-- La función debe manejar el caso en que la columna 'email' no exista aún.

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
  v_email TEXT;
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

  v_email := NEW.email;

  -- Usuarios OAuth se consideran verificados automáticamente
  IF v_provider IN ('google', 'facebook', 'apple', 'github') THEN
    v_is_verified := true;
  END IF;

  -- Intentar insertar con todos los campos (incluyendo email si existe)
  BEGIN
    INSERT INTO public.users (
      user_id,
      name,
      phone,
      role,
      pin,
      profile_photo_url,
      email,
      is_verified,
      verification_status,
      verification_date,
      created_at
    ) VALUES (
      NEW.id,
      v_name,
      v_phone,
      v_role,
      NULL,
      v_photo,
      v_email,
      v_is_verified,
      CASE WHEN v_is_verified THEN 'verified' ELSE 'not_requested' END,
      CASE WHEN v_is_verified THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, public.users.name),
      email = COALESCE(EXCLUDED.email, public.users.email),
      profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url),
      is_verified = EXCLUDED.is_verified OR public.users.is_verified,
      verification_status = CASE
        WHEN EXCLUDED.is_verified THEN 'verified'
        ELSE public.users.verification_status
      END;

  EXCEPTION WHEN undefined_column THEN
    -- Fallback: insertar sin la columna email (schema antiguo)
    INSERT INTO public.users (
      user_id, name, phone, role, pin,
      profile_photo_url, is_verified, verification_status, verification_date, created_at
    ) VALUES (
      NEW.id, v_name, v_phone, v_role, NULL,
      v_photo, v_is_verified,
      CASE WHEN v_is_verified THEN 'verified' ELSE 'not_requested' END,
      CASE WHEN v_is_verified THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, public.users.name),
      profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url),
      is_verified = EXCLUDED.is_verified OR public.users.is_verified;
  END;

  RETURN NEW;
END;
$$;


-- ==============================================================================
-- FIX 5: Asegurar que el trigger existe y está activo
-- ==============================================================================
DROP TRIGGER IF EXISTS _mc_auth_trigger ON auth.users;
CREATE TRIGGER _mc_auth_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._mc_on_signup();


-- ==============================================================================
-- FIX 6: Asegurar columna email en public.users (si no existe)
-- ==============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Sincronizar emails de usuarios existentes que no tengan email en public.users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.user_id::TEXT = a.id::TEXT
  AND (u.email IS NULL OR u.email = '');


-- ==============================================================================
-- FIX 7: Reconstruir funciones auxiliares con mejor manejo de NULL
-- ==============================================================================

-- Función: Obtener ID interno del usuario autenticado
CREATE OR REPLACE FUNCTION public._mc_user_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id::TEXT FROM public.users
  WHERE user_id::TEXT = auth.uid()::TEXT
  LIMIT 1;
$$;

-- Función: Obtener teléfono del usuario autenticado
CREATE OR REPLACE FUNCTION public._mc_phone()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT phone FROM public.users
  WHERE user_id::TEXT = auth.uid()::TEXT
  LIMIT 1;
$$;

-- Función: Obtener email del usuario autenticado (desde auth.users directamente)
CREATE OR REPLACE FUNCTION public._mc_email()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Función: ¿Es admin?
CREATE OR REPLACE FUNCTION public._mc_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id::TEXT = auth.uid()::TEXT AND role = 'admin'
  );
$$;

-- Función: ¿Es cliente?
CREATE OR REPLACE FUNCTION public._mc_is_client()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id::TEXT = auth.uid()::TEXT AND role = 'client'
  );
$$;

-- Función: ¿Es repartidor?
CREATE OR REPLACE FUNCTION public._mc_is_driver()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id::TEXT = auth.uid()::TEXT AND role = 'driver'
  );
$$;


-- ==============================================================================
-- FIX 8: Política orders_client_read — incluir email como fallback OAuth
-- ==============================================================================
DROP POLICY IF EXISTS "orders_client_read" ON public.orders;
CREATE POLICY "orders_client_read" ON public.orders
  FOR SELECT USING (
    client_id::TEXT = public._mc_user_id()
    OR client_phone::TEXT = public._mc_phone()
    OR (
      SELECT u.email FROM public.users u
      WHERE u.id::TEXT = public.orders.client_id::TEXT
    ) = public._mc_email()
  );


-- ==============================================================================
-- VERIFICACIÓN FINAL
-- ==============================================================================

-- Verificar políticas activas:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'orders')
ORDER BY tablename, policyname;

-- Verificar trigger activo:
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = '_mc_auth_trigger';

-- ==============================================================================
-- ✅ FIX APLICADO — El login debería funcionar ahora.
-- ==============================================================================
