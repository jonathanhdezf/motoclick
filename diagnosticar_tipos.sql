-- ==============================================================================
-- SCRIPT DE DIAGNÓSTICO — Ejecutar PRIMERO para conocer los tipos reales
-- ==============================================================================
-- Este script NO modifica nada. Solo muestra los tipos de columnas de tus tablas.
-- Copia el resultado y úsalo para corregir el script de RLS.
-- ==============================================================================

-- 1. Tipos de columnas en public.users
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Tipos de columnas en public.orders
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- 3. Tipos de columnas en public.ticket_detalle
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ticket_detalle'
ORDER BY ordinal_position;

-- 4. Tipos de columnas en public.cash_verification_codes
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cash_verification_codes'
ORDER BY ordinal_position;

-- 5. Tipos de columnas en public.comercios_prospectos
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comercios_prospectos'
ORDER BY ordinal_position;

-- 6. ¿La columna user_id ya existe en users? ¿Es UUID?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
AND column_name = 'user_id';

-- 7. ¿Existen foreign keys entre orders y users?
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';

-- 8. Políticas RLS actuales
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
