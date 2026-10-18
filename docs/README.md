# Números Claros — Documentación de diseño (SDD)

> **Propósito de esta carpeta:** que una persona o un agente de IA, en una sesión nueva y sin contexto previo, pueda **construir desde cero la app móvil de Números Claros** con el mismo comportamiento que la app web actual, compartiendo la misma base de datos.
>
> Estado de referencia: app web en producción en `https://numeros-claros.web.app` (repo `Yasiel2023/numeros_claros`, rama `master`), actualizado al 4 de octubre de 2026 (commit `ec3fe65`).
>
> **Novedades desde la primera versión de estos documentos** (detalle en [10](./10-cambios-recientes.md)): la app ya tiene una versión Android con Capacitor y un diseño propio para celular dentro de la misma base de código; la IA pasa por un Worker de Cloudflare (la clave de Groq ya no sale al cliente); cada presupuesto tiene moneda principal y secundaria; hay categorías nuevas a mitad de mes, "Cómo va el mes" en Inicio, tasas para tarjetas en moneda secundaria y ajustes a favor en tarjetas de crédito.

## Cómo usar esta documentación

Leé en este orden. Cada documento es autosuficiente pero asume los anteriores.

| # | Documento | Qué responde |
|---|-----------|--------------|
| 00 | [Visión y alcance](./00-vision-y-alcance.md) | Qué es el producto, para quién, qué entra en la app móvil v1 y qué no |
| 01 | [Requisitos](./01-requisitos.md) | Requisitos funcionales (RF) con criterios de aceptación y no funcionales (RNF) |
| 02 | [Modelo de dominio y reglas de negocio](./02-dominio-y-reglas.md) | Conceptos, fórmulas exactas y algoritmos (períodos, tarjetas, cuotas, carrito, tickets) |
| 03 | [Modelo de datos](./03-modelo-de-datos.md) | Árbol de Firebase Realtime Database, esquemas tipados, convenciones de escritura |
| 04 | [Arquitectura](./04-arquitectura.md) | Arquitectura actual (web) y arquitectura objetivo (móvil), decisiones (ADR) |
| 05 | [Inteligencia artificial](./05-ia.md) | Lectura de tickets, asignación a gastos y chat con herramientas (prompts y contratos) |
| 06 | [Pantallas y flujos](./06-pantallas-y-flujos.md) | Cada pantalla: contenido, acciones, estados; navegación móvil propuesta |
| 07 | [Seguridad y privacidad](./07-seguridad.md) | Reglas de la base, claves de API, datos enviados a terceros |
| 08 | [Plan de implementación](./08-plan-de-implementacion.md) | Fases, tareas con checklist y criterios de salida para construir la app móvil |
| 09 | [Operación y entorno](./09-operacion.md) | Proyecto Firebase, despliegues (web, Worker de IA, Android), comandos, estado del repo y deuda técnica |
| 10 | [Cambios recientes](./10-cambios-recientes.md) | Qué cambió en el código respecto a la primera versión de esta documentación y qué documentos se tocaron |
| 11 | [Suscripción premium](./11-suscripcion.md) | (Solo en la rama `feature/suscripcion-premium`) prueba gratis, versión gratis sin IA y con un presupuesto, y cobro con Google Play |

## Reglas de oro para quien implemente

1. **La base de datos es compartida con la app web.** La app móvil lee y escribe los mismos nodos con los mismos formatos ([03](./03-modelo-de-datos.md)). Cualquier cambio de esquema debe ser compatible hacia atrás o coordinado con la web.
2. **Las cuentas las hace el código, nunca la IA.** Totales, saldos y prorrateos se calculan con las fórmulas de [02](./02-dominio-y-reglas.md). La IA solo clasifica, interpreta y redacta.
3. **Una sola fuente de verdad para las fórmulas.** Implementar el dominio como un módulo puro (sin UI ni Firebase) con tests unitarios antes de construir pantallas ([08](./08-plan-de-implementacion.md), fase 1).
4. **Nunca escribir `undefined` en Realtime Database.** Quitar la clave (destructuring) o usar `null`.
5. **La seguridad vive en las reglas de Firebase**, no en el cliente ([07](./07-seguridad.md)).

## Glosario rápido

| Término | Significado |
|---------|-------------|
| **Presupuesto** | Espacio de datos de una familia/persona. Un usuario puede tener varios y compartirlos. |
| **Mes** | Datos de un mes de un presupuesto (clave `AAAA_M`, mes 0-indexado). |
| **Categoría / grupo de gastos** | Agrupa gastos con una frecuencia (mensual, quincenal, cada 10 días, semanal). En código: `grupo`. |
| **Período** | Subdivisión de una categoría dentro del mes según su frecuencia (ej. "Semana 2 (10/10)"). |
| **Item / gasto** | Línea con `previsto`, `real` y `pagado`. |
| **Carrito** | Marca temporal `enCarrito` de un gasto pendiente mientras se hace la compra. |
| **Comprobante / ticket** | Foto de un ticket leída con IA y aplicada a gastos; queda registrada en el mes. |
| **Financiación** | Compra en cuotas que se carga cada mes a una tarjeta de crédito. |
| **Caja de ahorro** | Registro de ahorro (UYU y USD) a nivel presupuesto, fuera de los meses. |
| **Plantilla** | Valores base para crear presupuestos (globales) o meses (personales). |
| **Moneda principal / secundaria** | Cada presupuesto define una moneda principal (gastos, ingresos) y opcionalmente una secundaria (tarjetas, cuotas, caja de ahorro). Se guardan en `_meta.moneda` y `_meta.moneda2`. |
| **Tasa** | Valor por tarjeta de crédito en moneda secundaria: cuántas unidades de la moneda principal vale 1 de la secundaria. Sirve para estimar su costo en "Cómo va el mes". |
| **Cómo va el mes** | Panel de Inicio con la plata real: saldo en débito − pendientes − tarjetas de crédito − ahorro = libre para gastar. |
| **Worker de IA** | Proxy en Cloudflare (`ia-worker/`) que guarda la clave de Groq, verifica la sesión de Firebase y limita el uso. |
