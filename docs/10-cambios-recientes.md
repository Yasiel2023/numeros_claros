# 10 — Cambios recientes

Qué cambió en el código desde la primera versión de esta documentación (commit `a7996fc`, 2 de octubre de 2026) hasta el estado actual (commit `ec3fe65` más los cambios de esta actualización). Sirve de mapa: cada fila dice dónde quedó documentado.

## 1. Resumen

| Cambio | Dónde está documentado |
|--------|------------------------|
| App Android con Capacitor y diseño propio para celular (barra de pestañas, hojas inferiores, íconos del prototipo) | [00 §5.1](./00-vision-y-alcance.md), [04 ADR-007](./04-arquitectura.md), [06 §1.1](./06-pantallas-y-flujos.md), [09 §2.2](./09-operacion.md) |
| Interfaz web de escritorio con el diseño del prototipo (`web.css`, `GastosWeb`, `GrupoGastosWeb`) | [04 §1](./04-arquitectura.md), [06 §1.1](./06-pantallas-y-flujos.md) |
| IA vía **Worker de Cloudflare**: la clave de Groq sale del cliente; interruptor y modelo en `sistema/ia`; límite por usuario | [04 §1.1 y ADR-004](./04-arquitectura.md), [05](./05-ia.md), [07 §3](./07-seguridad.md), [09 §2.1](./09-operacion.md) |
| Reglas: `sistema` y `defaults` solo escribibles por admins; `admins` de solo lectura | [07 §2](./07-seguridad.md), [03](./03-modelo-de-datos.md) |
| Moneda principal y secundaria por presupuesto (`_meta.moneda`, `_meta.moneda2`), 11 monedas | [01 RF-PRES-8](./01-requisitos.md), [02 §11](./02-dominio-y-reglas.md), [03](./03-modelo-de-datos.md) |
| Armar un presupuesto con IA en el onboarding | [01 RF-ONB-5](./01-requisitos.md), [05 §6](./05-ia.md) |
| Categorías nuevas a mitad de mes y eliminables (solo dueño) | [01 RF-PRES-9 y 10](./01-requisitos.md) |
| Íconos de categoría con claves de `iconos.js` (ya no emojis) | [03](./03-modelo-de-datos.md), [06 §3](./06-pantallas-y-flujos.md) |
| **Cómo va el mes** en Inicio | [01 RF-DASH-5](./01-requisitos.md), [02 §10.1](./02-dominio-y-reglas.md) |
| Tarjetas: cargos editables, ajustes a favor (saldo negativo), tasa por tarjeta en moneda secundaria | [01 RF-TARJ-8 y 9](./01-requisitos.md), [02 §6.1](./02-dominio-y-reglas.md) |
| Eliminar tarjeta siempre pide confirmación (dentro de la hoja) | [01 RF-TARJ-10](./01-requisitos.md) |
| Caja de ahorro: descontar el depósito/conversión de una tarjeta de débito | [01 RF-CAJA-4](./01-requisitos.md), [02 §9](./02-dominio-y-reglas.md) |
| Carrito general (productos de varias categorías en una misma compra) | [01 RF-CARR-7..9](./01-requisitos.md), [06 §2.12b](./06-pantallas-y-flujos.md) |
| Botones de las hojas inferiores que se aplastaban (`.hoja > * { flex-shrink: 0 }`) | [06 §3](./06-pantallas-y-flujos.md) |

## 2. Cambios de comportamiento que afectan a quien implemente

1. **`saldoTarjeta` y `previstoPropioTarjeta` ya no se recortan en 0.** Pueden ser negativos (saldo a favor). Cualquier total que los sume debe tolerarlo.
2. **No hay clave de IA en el cliente.** `config/{uid}` quedó legado; la app lee `sistema/ia/activa` para mostrar u ocultar las funciones de IA.
3. **El código de moneda de una tarjeta o cuota ya no es `UYU|USD`**, sino el de la moneda principal o secundaria del presupuesto. Comparar siempre con `esSecundaria(codigo)`.
4. **`Grupo.icono` ahora es una clave** (`carrito`, `casa`, …). Los datos viejos pueden traer un emoji; en ese caso la app deduce el ícono por el nombre.
5. **Un movimiento de la Caja de ahorro puede traer `tarjetaId`, `tarjetaMovId` y `mesKey`** (descuento desde débito). Al borrarlo se revierte el saldo solo si es del mes abierto.
6. **`enCarrito` ya se puede mirar de forma global**: la marca sigue siendo por item, dentro de su categoría; no hay un nodo de carrito aparte.

## 3. Pendiente / ideas surgidas

- Premium/suscripciones en el Worker (TODO en `ia-worker/src/index.js`).
- Deuda técnica nueva y resuelta en [09 §5](./09-operacion.md#5-deuda-técnica-y-bugs-conocidos) (D2, D3, D8 y D9 resueltas; D11 a D13 nuevas).
- Revisar visualmente en celular y escritorio las pantallas nuevas del carrito general y el selector "Descontar de" de la Caja de ahorro (no se probaron en el navegador al escribir esta actualización; solo se verificó que compile).
