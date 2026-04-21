-- ============================================================================
-- MOTOCLICK - NORMALIZAR STATUS DE ORDERS
-- Convierte estados legacy en español a los valores que usa el frontend.
-- ============================================================================

-- 1. Ver qué valores existen hoy
select status, count(*)
from public.orders
group by status
order by status;

-- 2. Normalizar "pendiente" -> "pending"
update public.orders
set status = 'pending'
where status = 'pendiente';

-- 3. Verificación final
select status, count(*)
from public.orders
group by status
order by status;

