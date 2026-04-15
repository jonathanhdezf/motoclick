-- ==============================================================================
-- 🛡️ MOTO-CLICK: PARCHE DE SEGURIDAD RLS v2 (Corrección email)
-- ==============================================================================
-- Este script corrige el error de columna faltante "email" y mejora el soporte OAuth.
-- ==============================================================================

-- 1. Asegurar que la columna email existe en public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. Sincronizar emails existentes desde auth.users a public.users
DO $$
BEGIN
  UPDATE public.users u
  SET email = a.email
  FROM auth.users a
  WHERE u.user_id::TEXT = a.id::TEXT
  AND u.email IS NULL;
END $$;

-- 3. Función auxiliar para obtener el email del usuario actual
CREATE OR REPLACE FUNCTION public._mc_email()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. Reforzar visibilidad de perfiles
DROP POLICY IF EXISTS "users_read_others" ON public.users;
CREATE POLICY "users_read_others" ON public.users
  FOR SELECT USING (
    user_id::TEXT = auth.uid()::TEXT               -- Ver mi propio perfil
    OR role IN ('driver', 'admin')                  -- Ver repartidores y admins
    OR public._mc_is_admin()                       -- Admin ve todo
  );

-- 5. Soporte para Google OAuth en Órdenes
-- Ahora permitimos que un cliente vea su orden si coincide su Email
DROP POLICY IF EXISTS "orders_client_read" ON public.orders;
CREATE POLICY "orders_client_read" ON public.orders
  FOR SELECT USING (
    client_id::TEXT = public._mc_user_id()
    OR client_phone::TEXT = public._mc_phone()
    OR (SELECT u.email FROM public.users u WHERE u.id::TEXT = public.orders.client_id::TEXT) = public._mc_email()
  );

-- 6. Blindaje del Administrador (Impedir borrado accidental o malicioso de admins)
DROP POLICY IF EXISTS "users_admin_delete" ON public.users;
CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE USING (
    public._mc_is_admin()                           -- Solo otro admin puede borrar
    AND role != 'admin'                            -- ¡Nadie puede borrar a un admin!
  );

-- 7. Actualizar la función de sincronización para soportar fotos de Google y Email
CREATE OR REPLACE FUNCTION public._mc_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (user_id, name, phone, role, profile_photo_url, email, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'phone', 'GoogleUser_' || NEW.id),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    NEW.email,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url);
  RETURN NEW;
END;
$$;

-- 8. Asegurar que el trigger usa la nueva función
DROP TRIGGER IF EXISTS _mc_auth_trigger ON auth.users;
CREATE TRIGGER _mc_auth_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._mc_on_signup();

-- ==============================================================================
-- ✅ PARCHE APLICADO EXITOSAMENTE (CORRECCIÓN EMAIL)
-- ==============================================================================
