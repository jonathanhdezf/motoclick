-- ==============================================================================
-- 🛡️ MOTO-CLICK: PARCHE DE SEGURIDAD RLS (Fase Final - Respaldo)
-- Corrigiendo: Fuga de datos, Soporte Google Auth e Integridad Admin
-- ==============================================================================
-- Este script adapta la base de datos para el soporte de Google Login
-- y previene la suplantación o borrado de cuentas administrativas.
-- ==============================================================================

-- 1. Función auxiliar para obtener el email del usuario actual desde auth.users
CREATE OR REPLACE FUNCTION public._mc_email()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Reforzar visibilidad de perfiles (Evitar que clientes vean datos privados de otros clientes)
-- Cambiamos "true" por una lógica que solo permite ver repartidores o admins a otros usuarios.
DROP POLICY IF EXISTS "users_read_others" ON public.users;
CREATE POLICY "users_read_others" ON public.users
  FOR SELECT USING (
    user_id::TEXT = auth.uid()::TEXT               -- Ver mi propio perfil
    OR role IN ('driver', 'admin')                  -- Ver repartidores y admins (necesario para el flujo)
    OR public._mc_is_admin()                       -- Admin ve todo
  );

-- 3. Soporte para Google OAuth en Órdenes
-- Ahora permitimos que un cliente vea su orden si coincide su Email (común en Google)
DROP POLICY IF EXISTS "orders_client_read" ON public.orders;
CREATE POLICY "orders_client_read" ON public.orders
  FOR SELECT USING (
    client_id::TEXT = public._mc_user_id()
    OR client_phone::TEXT = public._mc_phone()
    OR (SELECT u.email FROM public.users u WHERE u.id::TEXT = public.orders.client_id::TEXT) = public._mc_email()
  );

-- 4. Blindaje del Administrador (Impedir borrado accidental o malicioso de admins)
DROP POLICY IF EXISTS "users_admin_delete" ON public.users;
CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE USING (
    public._mc_is_admin()                           -- Solo otro admin puede borrar
    AND role != 'admin'                            -- ¡Nadie puede borrar a un admin!
  );

-- 5. Actualizar la función de sincronización para soportar fotos de Google
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
    COALESCE(NEW.raw_user_meta_data->>'phone', 'GoogleUser_' || NEW.id), -- Placeholder si es Google
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    NEW.email,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url);
  RETURN NEW;
END;
$$;

-- 6. Índices de seguridad adicionales
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ==============================================================================
-- ✅ PARCHE GENERADO EXITOSAMENTE
-- ==============================================================================
