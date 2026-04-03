-- ==============================================================================
-- Módulo de Compra Activa - Esquema Relacional de Base de Datos (Supabase/PostgreSQL)
-- ==============================================================================

-- 1. Tabla: catalogo_maestro
CREATE TABLE IF NOT EXISTS public.catalogo_maestro (
    codigo_barras VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    categoria VARCHAR(100),
    foto_url TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla: orders (Campos Críticos de Mandados y ASIGNACIÓN DE REPARTIDOR)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal_compra NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS nombre_comercio_local VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS lat_compra NUMERIC(10, 6),
ADD COLUMN IF NOT EXISTS lng_compra NUMERIC(10, 6),
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS pickup_coords JSONB,
ADD COLUMN IF NOT EXISTS delivery_coords JSONB,
ADD COLUMN IF NOT EXISTS stops JSONB,
ADD COLUMN IF NOT EXISTS stop_description TEXT,
ADD COLUMN IF NOT EXISTS estimated_price_min NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS estimated_price_max NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS route_distance_text TEXT,
ADD COLUMN IF NOT EXISTS special_services JSONB,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS estado_ticket VARCHAR(50) DEFAULT 'pendiente', 
ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS driver_photo TEXT,
ADD COLUMN IF NOT EXISTS driver_location JSONB,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- 3. Tabla: ticket_detalle
CREATE TABLE IF NOT EXISTS public.ticket_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_orden TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    codigo_producto VARCHAR(50), 
    descripcion VARCHAR(255) NOT NULL,
    cantidad INTEGER DEFAULT 1,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_detalle_orden ON public.ticket_detalle(id_orden);

-- 4. Tabla: comercios_prospectos
CREATE TABLE IF NOT EXISTS public.comercios_prospectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_orden TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    nombre_comercio VARCHAR(255) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    ticket_promedio NUMERIC(10, 2) NOT NULL,
    id_repartidor TEXT, 
    timestamp_recoleccion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado_afiliacion VARCHAR(50) DEFAULT 'no_contactado'
);

-- 5. Tabla: users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_photo_url TEXT; 
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'not_requested'; 
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 6. Seguridad Dinámica
CREATE TABLE IF NOT EXISTS public.cash_verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_used BOOLEAN DEFAULT FALSE,
    generated_by TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- Triggers y Políticas
-- ==============================================================================
ALTER TABLE public.catalogo_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios_prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; 

DROP POLICY IF EXISTS "Global Dev Access Master" ON public.catalogo_maestro; CREATE POLICY "Global Dev Access Master" ON public.catalogo_maestro FOR ALL USING (true);
DROP POLICY IF EXISTS "Global Dev Access Ticket" ON public.ticket_detalle; CREATE POLICY "Global Dev Access Ticket" ON public.ticket_detalle FOR ALL USING (true);
DROP POLICY IF EXISTS "Global Dev Access BI" ON public.comercios_prospectos; CREATE POLICY "Global Dev Access BI" ON public.comercios_prospectos FOR ALL USING (true);
DROP POLICY IF EXISTS "Global Dev Access Cash" ON public.cash_verification_codes; CREATE POLICY "Global Dev Access Cash" ON public.cash_verification_codes FOR ALL USING (true);
DROP POLICY IF EXISTS "Global Dev Access Users" ON public.users; CREATE POLICY "Global Dev Access Users" ON public.users FOR ALL USING (true); 
DROP POLICY IF EXISTS "Global Dev Access Orders" ON public.orders; CREATE POLICY "Global Dev Access Orders" ON public.orders FOR ALL USING (true); 
