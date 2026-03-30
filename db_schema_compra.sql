-- ==============================================================================
-- Módulo de Compra Activa - Esquema Relacional de Base de Datos (Supabase/PostgreSQL)
-- ==============================================================================

-- 1. Tabla: catalogo_maestro
-- Propósito: Base de datos global de productos por código de barras (EAN-13, UPC).
CREATE TABLE public.catalogo_maestro (
    codigo_barras VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    categoria VARCHAR(100),
    foto_url TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla: orders (Actualización para BI y Ticket)
-- Propósito: Almacena la orden (mandado) global provista por la plataforma.
-- Asumiendo que la tabla `orders` ya existe, se añaden estas columnas si no están.
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal_compra NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS nombre_comercio_local VARCHAR(255),
ADD COLUMN IF NOT EXISTS lat_lng_compra POINT,
ADD COLUMN IF NOT EXISTS estado_ticket VARCHAR(50) DEFAULT 'pendiente'; -- pendiente, armando, consolidado

-- 3. Tabla: ticket_detalle
-- Propósito: Líneas del ticket de la compra que está realizando el repartidor.
CREATE TABLE public.ticket_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_orden TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    codigo_producto VARCHAR(50), -- Puede ser código de barras EAN o el prefijo '20' para manuales
    descripcion VARCHAR(255) NOT NULL,
    cantidad INTEGER DEFAULT 1,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexar por orden para búsquedas rápidas al calcular el subtotal
CREATE INDEX IF NOT EXISTS idx_ticket_detalle_orden ON public.ticket_detalle(id_orden);

-- 4. Tabla: comercios_prospectos (Business Intelligence)
-- Propósito: Recolectar inteligencia de los comercios donde compran los repartidores (no afiliados aún).
CREATE TABLE public.comercios_prospectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_orden TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    nombre_comercio VARCHAR(255) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    ticket_promedio NUMERIC(10, 2) NOT NULL,
    id_repartidor TEXT, -- Referencia al repartidor que recolectó el dato
    timestamp_recoleccion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado_afiliacion VARCHAR(50) DEFAULT 'no_contactado' -- no_contactado, en_proceso, afiliado
);

-- ==============================================================================
-- Funciones Supabase RPC o Reglas de Políticas RLS (Row Level Security)
-- ==============================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.catalogo_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios_prospectos ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (ajustar en producción según autenticación)
CREATE POLICY "Lectura pública catalogo_maestro" ON public.catalogo_maestro FOR SELECT USING (true);
CREATE POLICY "Repartidores pueden leer/escribir ticket_detalle" ON public.ticket_detalle FOR ALL USING (true);
CREATE POLICY "Repartidores pueden insertar prospectos" ON public.comercios_prospectos FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- Función Triggers para Actualizar Subtotal en Tiempo Real
-- ==============================================================================
CREATE OR REPLACE FUNCTION actualizar_subtotal_orden()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.orders
    SET subtotal_compra = (
        SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
        FROM public.ticket_detalle
        WHERE id_orden = NEW.id_orden
    ),
    status = 'armando_pedido'
    WHERE id = NEW.id_orden;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_actualizar_subtotal
AFTER INSERT OR UPDATE OR DELETE ON public.ticket_detalle
FOR EACH ROW EXECUTE FUNCTION actualizar_subtotal_orden();
