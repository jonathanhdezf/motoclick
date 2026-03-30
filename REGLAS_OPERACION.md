# Reglas de Operación — MotoClick 🛵

Este documento define las políticas de negocio y las reglas de operación para la plataforma MotoClick. Estas reglas están diseñadas para proteger a nuestros repartidores y garantizar la seguridad financiera de la operación.

## 1. Límite de Efectivo para "Mandados Abiertos"

Para proteger el capital de trabajo de nuestros repartidores, se establece un **tope máximo por orden**.

*   **Regla**: El repartidor solo puede realizar un desembolso de su propio bolsillo de hasta **$500 MXN** (o $300 según configuración regional) por mandado.
*   **Excepción**: Si el costo del mandado (productos a comprar) supera esta cantidad, el sistema exigirá **obligatoriamente** el pago por adelantado del total del mandado mediante:
    *   Tarjeta de crédito / débito.
    *   Transferencia bancaria verificada.
*   **Propósito**: Evitar riesgos financieros mayores para el repartidor en caso de cancelaciones o fraudes en pedidos de alto valor.

---

## 2. Sistema de Confianza del Cliente (Loyalty & Trust)

MotoClick implementa un sistema de validación progresiva para habilitar métodos de pago específicos a los usuarios.

### Usuarios Nuevos
*   **Estado Inicial**: Todos los usuarios nuevos entran en el nivel de "Validación".
*   **Regla**: Los primeros pedidos (**3 a 5 mandados exitosos**) deben ser realizados bajo la modalidad de **Prepago** (Tarjeta o Transferencia).
*   **Restricción**: La opción de "Pago contra entrega" estará bloqueada durante este periodo.

### Usuarios Verificados (Nivel de Confianza)
*   **Criterio de Desbloqueo**: Haber completado exitosamente el mínimo de pedidos prepagados sin incidencias (cancelaciones injustificadas, reclamos falsos, etc.).
*   **Beneficio**: El sistema desbloqueará automáticamente la opción de **"Pago contra entrega"** en efectivo para pedidos que no superen el límite establecido en el punto 1.

---

## 3. Próximas Implementaciones
*   [ ] Integración de validación de pedidos completados en el perfil de usuario.
*   [ ] Alertas automáticas en el flujo de pedido cuando se supere el límite de efectivo ($500 MXN).
*   [ ] Dashboard de administración para ajustar estos límites globalmente.

---
**Última actualización**: 30 de marzo de 2026
