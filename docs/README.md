# Documentación — Números Claros (CasaFinanzas v2)

Índice de la documentación técnica del proyecto. Generada revisando el código fuente completo (no hay commits en el repo ni documentación previa).

- [arquitectura.md](./arquitectura.md) — Stack, estructura de la app, árbol de componentes y responsabilidades.
- [modelo-datos.md](./modelo-datos.md) — Esquema completo de Firebase Realtime Database, forma de cada entidad.
- [setup-despliegue.md](./setup-despliegue.md) — Cómo correr el proyecto en local y desplegarlo a Firebase Hosting.
- [estado-proyecto.md](./estado-proyecto.md) — Código muerto, inconsistencias, riesgos de seguridad y limpieza pendiente detectados en la revisión.

## Resumen rápido

**Números Claros** (nombre interno de paquete: `casa-finanzas`, título histórico "CasaFinanzas") es una planilla de presupuesto familiar hecha en **React 18 + Firebase Realtime Database + Auth**, desplegada como SPA estática en Firebase Hosting. Permite llevar ingresos, gastos agrupados por frecuencia (mensual/quincenal/cada10días/semanal), tarjetas de crédito/débito, una caja de ahorro con conversión UYU↔USD, y compartir un mismo presupuesto entre varios usuarios.

No hay backend propio: toda la lógica vive en el cliente y persiste directo contra Firebase RTDB.
