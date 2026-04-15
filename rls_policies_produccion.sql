-- ==============================================================================
-- MotoClick — Políticas RLS de Producción (Versión Corregida v2)
-- ==============================================================================
-- Esta versión usa casts EXPLÍCITOS en TODAS las comparaciones para evitar
-- errores de tipo. Todo se compara como TEXT.
-- ==============================================================================

-- ==============================================================================
-- FASE 1: Limpiar TODO (seguro — no falla)
-- ==============================================================================

-- 1a. Agregar columna user_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN user_id UUID;
  END IF;
END $$;

-- 1b. Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios_prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_verification_codes ENABLE ROW LEVEL SECURITY;

-- 1c. Eliminar TODAS las políticas existentes (viejas Y nuevas)
-- --- Tabla: users ---
DROP POLICY IF EXISTS "Global Dev Access Users" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_read_others" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_admin" ON public.users;

-- --- Tabla: orders ---
DROP POLICY IF EXISTS "Global Dev Access Orders" ON public.orders;
DROP POLICY IF EXISTS "orders_client_read" ON public.orders;
DROP POLICY IF EXISTS "orders_driver_read" ON public.orders;
DROP POLICY IF EXISTS "orders_client_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_client_update" ON public.orders;
DROP POLICY IF EXISTS "orders_driver_update" ON public.orders;
DROP POLICY IF EXISTS "orders_driver_accept" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;

-- --- Tabla: ticket_detalle ---
DROP POLICY IF EXISTS "Global Dev Access Ticket" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_client_read" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_driver_read" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_driver_insert" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_driver_update" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_driver_delete" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_admin_select" ON public.ticket_detalle;
DROP POLICY IF EXISTS "ticket_admin_all" ON public.ticket_detalle;

-- --- Tabla: catalogo_maestro ---
DROP POLICY IF EXISTS "Global Dev Access Master" ON public.catalogo_maestro;
DROP POLICY IF EXISTS "catalogo_read" ON public.catalogo_maestro;
DROP POLICY IF EXISTS "catalogo_admin" ON public.catalogo_maestro;

-- --- Tabla: comercios_prospectos ---
DROP POLICY IF EXISTS "Global Dev Access BI" ON public.comercios_prospectos;
DROP POLICY IF EXISTS "comercios_driver_insert" ON public.comercios_prospectos;
DROP POLICY IF EXISTS "comercios_driver_read" ON public.comercios_prospectos;
DROP POLICY IF EXISTS "comercios_admin_select" ON public.comercios_prospectos;
DROP POLICY IF EXISTS "comercios_admin_update" ON public.comercios_prospectos;
DROP POLICY IF EXISTS "comercios_admin_delete" ON public.comercios_prospectos;

-- --- Tabla: cash_verification_codes ---
DROP POLICY IF EXISTS "Global Dev Access Cash" ON public.cash_verification_codes;
DROP POLICY IF EXISTS "cash_admin_insert" ON public.cash_verification_codes;
DROP POLICY IF EXISTS "cash_admin_select" ON public.cash_verification_codes;
DROP POLICY IF EXISTS "cash_admin_update" ON public.cash_verification_codes;
DROP POLICY IF EXISTS "cash_admin_delete" ON public.cash_verification_codes;
DROP POLICY IF EXISTS "cash_client_read" ON public.cash_verification_codes;

-- ==============================================================================
-- FASE 2: Funciones auxiliares (todas las comparaciones con ::TEXT)
-- ==============================================================================

-- Función: Obtener ID interno del usuario autenticado (como TEXT)
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
-- FASE 3: Políticas para public.users
-- ==============================================================================

-- Leer propio perfil
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (user_id::TEXT = auth.uid()::TEXT);

-- Leer otros perfiles (necesario para ver info de repartidores)
CREATE POLICY "users_read_others" ON public.users
  FOR SELECT USING (true);

-- Actualizar propio perfil
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (user_id::TEXT = auth.uid()::TEXT)
  WITH CHECK (user_id::TEXT = auth.uid()::TEXT);

-- Crear propio registro
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (user_id::TEXT = auth.uid()::TEXT);

-- Admin: acceso total
CREATE POLICY "users_admin" ON public.users
  FOR ALL USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());

-- ==============================================================================
-- FASE 4: Políticas para public.orders
-- ==============================================================================

-- Cliente: ver sus pedidos
CREATE POLICY "orders_client_read" ON public.orders
  FOR SELECT USING (
    client_id::TEXT = public._mc_user_id()
    OR client_phone::TEXT = public._mc_phone()
  );

-- Repartidor: ver pendientes + asignados
CREATE POLICY "orders_driver_read" ON public.orders
  FOR SELECT USING (
    driver_id::TEXT = public._mc_user_id()
    OR status = 'pending'
  );

-- Cliente: crear pedidos
CREATE POLICY "orders_client_insert" ON public.orders
  FOR INSERT WITH CHECK (public._mc_is_client());

-- Cliente: actualizar sus pedidos
CREATE POLICY "orders_client_update" ON public.orders
  FOR UPDATE
  USING (client_id::TEXT = public._mc_user_id() OR client_phone::TEXT = public._mc_phone())
  WITH CHECK (client_id::TEXT = public._mc_user_id() OR client_phone::TEXT = public._mc_phone());

-- Repartidor: actualizar asignados
CREATE POLICY "orders_driver_update" ON public.orders
  FOR UPDATE
  USING (driver_id::TEXT = public._mc_user_id())
  WITH CHECK (driver_id::TEXT = public._mc_user_id());

-- Repartidor: aceptar pendientes
CREATE POLICY "orders_driver_accept" ON public.orders
  FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (
    driver_id::TEXT = public._mc_user_id()
    OR status IN ('accepted', 'armando_pedido', 'en_camino', 'recolectado')
  );

-- Admin: todo acceso
CREATE POLICY "orders_admin_select" ON public.orders FOR SELECT USING (public._mc_is_admin());
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());
CREATE POLICY "orders_admin_insert" ON public.orders FOR INSERT WITH CHECK (public._mc_is_admin());
CREATE POLICY "orders_admin_delete" ON public.orders FOR DELETE USING (public._mc_is_admin());

-- ==============================================================================
-- FASE 5: Políticas para public.ticket_detalle
-- ==============================================================================

-- Cliente: ver tickets de sus pedidos
CREATE POLICY "ticket_client_read" ON public.ticket_detalle
  FOR SELECT USING (
    id_orden IN (
      SELECT o.id FROM public.orders o
      WHERE o.client_id::TEXT = public._mc_user_id()
         OR o.client_phone::TEXT = public._mc_phone()
    )
  );

-- Repartidor: ver tickets de asignados
CREATE POLICY "ticket_driver_read" ON public.ticket_detalle
  FOR SELECT USING (
    id_orden IN (
      SELECT o.id FROM public.orders o
      WHERE o.driver_id::TEXT = public._mc_user_id()
    )
  );

-- Repartidor: CRUD en tickets de asignados
CREATE POLICY "ticket_driver_insert" ON public.ticket_detalle
  FOR INSERT WITH CHECK (
    id_orden IN (SELECT o.id FROM public.orders o WHERE o.driver_id::TEXT = public._mc_user_id())
  );

CREATE POLICY "ticket_driver_update" ON public.ticket_detalle
  FOR UPDATE
  USING (id_orden IN (SELECT o.id FROM public.orders o WHERE o.driver_id::TEXT = public._mc_user_id()))
  WITH CHECK (id_orden IN (SELECT o.id FROM public.orders o WHERE o.driver_id::TEXT = public._mc_user_id()));

CREATE POLICY "ticket_driver_delete" ON public.ticket_detalle
  FOR DELETE USING (
    id_orden IN (SELECT o.id FROM public.orders o WHERE o.driver_id::TEXT = public._mc_user_id())
  );

-- Admin: todo acceso
CREATE POLICY "ticket_admin_select" ON public.ticket_detalle FOR SELECT USING (public._mc_is_admin());
CREATE POLICY "ticket_admin_all" ON public.ticket_detalle FOR ALL USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());

-- ==============================================================================
-- FASE 6: Políticas para public.catalogo_maestro
-- ==============================================================================

-- Todos los autenticados pueden leer
CREATE POLICY "catalogo_read" ON public.catalogo_maestro
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo admin escribe
CREATE POLICY "catalogo_admin" ON public.catalogo_maestro
  FOR ALL USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());

-- ==============================================================================
-- FASE 7: Políticas para public.comercios_prospectos
-- ==============================================================================

-- Repartidor: insertar y ver propios
CREATE POLICY "comercios_driver_insert" ON public.comercios_prospectos
  FOR INSERT WITH CHECK (public._mc_is_driver());

CREATE POLICY "comercios_driver_read" ON public.comercios_prospectos
  FOR SELECT USING (id_repartidor::TEXT = public._mc_user_id());

-- Admin: todo acceso
CREATE POLICY "comercios_admin_select" ON public.comercios_prospectos FOR SELECT USING (public._mc_is_admin());
CREATE POLICY "comercios_admin_update" ON public.comercios_prospectos FOR UPDATE USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());
CREATE POLICY "comercios_admin_delete" ON public.comercios_prospectos FOR DELETE USING (public._mc_is_admin());

-- ==============================================================================
-- FASE 8: Políticas para public.cash_verification_codes
-- ==============================================================================

-- Admin: todo acceso
CREATE POLICY "cash_admin_insert" ON public.cash_verification_codes FOR INSERT WITH CHECK (public._mc_is_admin());
CREATE POLICY "cash_admin_select" ON public.cash_verification_codes FOR SELECT USING (public._mc_is_admin());
CREATE POLICY "cash_admin_update" ON public.cash_verification_codes FOR UPDATE USING (public._mc_is_admin()) WITH CHECK (public._mc_is_admin());
CREATE POLICY "cash_admin_delete" ON public.cash_verification_codes FOR DELETE USING (public._mc_is_admin());

-- Cliente: leer propios
CREATE POLICY "cash_client_read" ON public.cash_verification_codes
  FOR SELECT USING (client_id::TEXT = public._mc_user_id());

-- ==============================================================================
-- FASE 9: Función para auto-crear perfil en public.users al registrarse
-- ==============================================================================
-- NOTA: El trigger se crea en auth_setup.sql (no aquí) porque Supabase
-- no permite modificar triggers en auth.users desde scripts repetidos.
-- Esta función es la versión base (auth_setup.sql tiene la versión OAuth completa).

CREATE OR REPLACE FUNCTION public._mc_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (user_id, name, phone, role, pin, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'pin', NULL),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    profile_photo_url = COALESCE(EXCLUDED.profile_photo_url, public.users.profile_photo_url);
  RETURN NEW;
END;
$$;

-- El trigger se crea SOLO en auth_setup.sql:
-- DROP TRIGGER IF EXISTS _mc_auth_trigger ON auth.users;
-- CREATE TRIGGER _mc_auth_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public._mc_on_signup();

-- ==============================================================================
-- FASE 10: Funciones RPC para la app
-- ==============================================================================

-- RPC: Actualizar perfil
CREATE OR REPLACE FUNCTION public.rpc_update_profile(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_pin TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_vehicle TEXT DEFAULT NULL,
  p_photo TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{"success":false,"error":"No autenticado"}';
  END IF;

  UPDATE public.users SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    pin = COALESCE(p_pin, pin),
    address = COALESCE(p_address, address),
    vehicle = COALESCE(p_vehicle, vehicle),
    profile_photo_url = COALESCE(p_photo, profile_photo_url),
    role = COALESCE(p_role, role)
  WHERE user_id::TEXT = auth.uid()::TEXT
  RETURNING jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', id::TEXT, 'name', name, 'phone', phone,
      'role', role, 'vehicle', vehicle, 'is_verified', is_verified
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{"success":false,"error":"No encontrado"}');
END;
$$;

-- RPC: Aceptar pedido (repartidor)
CREATE OR REPLACE FUNCTION public.rpc_accept_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid TEXT; v_name TEXT; v_photo TEXT; v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{"success":false,"error":"No autenticado"}';
  END IF;

  SELECT id::TEXT, name, profile_photo_url INTO v_uid, v_name, v_photo
  FROM public.users WHERE user_id::TEXT = auth.uid()::TEXT;

  IF v_uid IS NULL THEN
    RETURN '{"success":false,"error":"Usuario no encontrado"}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id::TEXT = p_order_id::TEXT AND status = 'pending') THEN
    RETURN '{"success":false,"error":"Pedido no disponible"}';
  END IF;

  UPDATE public.orders SET
    status = 'accepted', driver_id = v_uid,
    driver_name = v_name, driver_photo = v_photo, accepted_at = NOW()
  WHERE id::TEXT = p_order_id::TEXT
  RETURNING jsonb_build_object('success', true, 'order_id', id) INTO v_result;

  RETURN COALESCE(v_result, '{"success":false,"error":"Error al actualizar"}');
END;
$$;

-- RPC: Generar código de efectivo (admin)
CREATE OR REPLACE FUNCTION public.rpc_generate_cash_code(p_client_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_code TEXT; v_name TEXT; v_result JSONB;
BEGIN
  IF NOT public._mc_is_admin() THEN
    RETURN '{"success":false,"error":"Solo admins"}';
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id::TEXT = p_client_id;
  IF v_name IS NULL THEN
    RETURN '{"success":false,"error":"Cliente no encontrado"}';
  END IF;

  v_code := 'MOTO-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  INSERT INTO public.cash_verification_codes (code, client_id, client_name, generated_by)
  VALUES (v_code, p_client_id::UUID, v_name, 'admin')
  RETURNING jsonb_build_object('success', true, 'code', code) INTO v_result;

  RETURN v_result;
END;
$$;

-- ==============================================================================
-- FASE 11: Índices de rendimiento
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_phone_role ON public.users(phone, role);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_phone ON public.orders(client_phone);
CREATE INDEX IF NOT EXISTS idx_ticket_detalle_orden ON public.ticket_detalle(id_orden);
CREATE INDEX IF NOT EXISTS idx_comercios_repartidor ON public.comercios_prospectos(id_repartidor);
CREATE INDEX IF NOT EXISTS idx_cash_codes_client ON public.cash_verification_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_cash_codes_active ON public.cash_verification_codes(is_active, is_used)
  WHERE is_active = true AND is_used = false;

-- ==============================================================================
-- VERIFICACIÓN: Listar políticas activas
-- ==============================================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- ==============================================================================
