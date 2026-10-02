# 02 — Modelo de dominio y reglas de negocio

Este documento es la **especificación de cálculo**. Todo lo que está aquí debe implementarse en un módulo de dominio puro (sin UI ni Firebase) con tests. Las referencias `src/...` apuntan a la implementación web actual, que es la referencia de comportamiento.

## 1. Conceptos y relaciones

```
Usuario ──< Acceso >── Presupuesto ──< Mes ──< Categoría(gastos) ──< Período ──< Item
                            │            ├──< Ingreso
                            │            ├──< Tarjeta (crédito | débito)
                            │            └──< Comprobante ──< ItemComprobante
                            ├── Defaults (grupos + ingresos base)
                            ├──< Financiación (cuotas, cruza meses)
                            ├── Caja de ahorro ──< Movimiento
                            └── Contexto IA (notas)
```

- Un **presupuesto** pertenece a un dueño (`ownerUid`) y puede tener miembros.
- Las **categorías** se definen en `_defaults.grupos_gastos` del presupuesto; cada mes guarda sus propios items por categoría.
- Las **tarjetas** son **por mes** (cada mes tiene su copia); su vínculo entre meses es el **nombre**.
- Las **financiaciones** y la **caja de ahorro** viven a nivel presupuesto, fuera de los meses.

## 2. Meses y claves

- Clave de mes: `` `${año}_${mes}` `` con `mes` **0-indexado** (enero = 0). Ej: `2026_9` = octubre 2026.
- En interfaces hacia la IA se usa `AAAA-MM` con mes 1-indexado (`2026-10`).
- Nombres: `MESES_ES = ['Enero', …, 'Diciembre']`.

## 3. Creación de un mes

Entrada: `año`, `mes`, `defaults` (del presupuesto, o de la plantilla personal elegida sin `_meta` ni `objetivoAhorro`), `objetivo`.

1. Para cada grupo de `defaults.grupos_gastos`:
   - `frecuencia = grupo.frecuencia ?? (grupo.tipo === 'semanas' ? 'semanal' : 'mensual')` (compatibilidad con un campo `tipo` legado).
   - `periodos = getPeriodosLabel(frecuencia, año, mes)` (§3.1).
   - Cada período recibe una **copia** de los items del grupo: `{ nombre, previsto, real: previsto, pagado: false }`.
2. `ingresos = defaults.ingresos.map(i => ({ ...i, real: 0 }))`.
3. `tarjetas`: arrastre (§6.5); si no hay meses previos con tarjetas, `[]`.
4. `objetivoAhorro = objetivo`, `semanas = []` (legado).
5. Aplicar cuotas del mes (§7).

### 3.1 Períodos según frecuencia (`getPeriodosLabel`)

| Frecuencia | Períodos |
|------------|----------|
| `mensual` (default) | `[{1, "{Mes} {año}"}]` |
| `quincenal` | `[{1, "1ra quincena (1-15 {Mes})"}, {2, "2da quincena (16-fin {Mes})"}]` |
| `cada10dias` | `[{1, "Del 1 al 10 ({Mes})"}, {2, "Del 11 al 20 ({Mes})"}, {3, "Del 21 al fin ({Mes})"}]` |
| `semanal` | `calcularSemanasMes(año, mes)` (§3.2) |

### 3.2 Semanas de compra (`calcularSemanasMes`)

Las semanas se anclan en el **día de compra**: viernes, o sábado si el viernes no está en el mes.

```
diasCompra = []
para d en 1..díasDelMes:
  dow = díaDeLaSemana(año, mes, d)        // 0=domingo … 5=viernes, 6=sábado
  si dow ∈ {5, 6}:
    si diasCompra no vacío y d − último(diasCompra) ≤ 1: continuar   // sábado pegado a viernes
    agregar d
filtrar: quitar el ÚLTIMO día si (díasDelMes − día ≤ 3) y hay más de un día
resultado: { numero: i+1, dia, label: "Semana {i+1} (DD/MM)" }   // DD y MM con 2 dígitos
```

Ejemplo: si el último viernes es el 28 y el mes tiene 31 días, quedan 3 días → esa semana no se crea y sus gastos van a la semana anterior.

### 3.3 Período "actual" para plegar/desplegar (UI)

Solo para frecuencia semanal y si el mes visto es el mes en curso: un período está "abierto" si hoy cae en `[dia−3, dia+3]` (acotado al mes). Las demás frecuencias arrancan abiertas.

## 4. Período por defecto de hoy

Usado al asignar items de tickets (`periodoPorDefecto`):

- Si el mes visto no es el mes en curso, o la categoría tiene ≤ 1 período → el primer período.
- `quincenal`: día ≤ 15 → 1; si no → 2.
- `cada10dias`: ≤ 10 → 1; ≤ 20 → 2; si no → 3.
- `semanal`: el **último** período cuyo `dia − 3 ≤ hoy` (el día se lee del label `(DD/MM)`); si ninguno, el primero.
- Si el número calculado no existe en los períodos, el primero.

## 5. Items de gasto

```ts
Item { nombre; previsto; real?; pagado: boolean; enCarrito?: true;
       tarjetaId?; tarjetaMonto?; tarjetaMovId? }
```

- **Monto pendiente** de un item no pagado: `real` si está definido, si no `previsto`.
- **Pagar** a mano: `real = monto pendiente`, `pagado = true`, se quita `enCarrito`, y si hay tarjeta se aplica §6.3.
- **Deshacer**: se revierte la tarjeta (§6.4) y se quitan `tarjetaId`, `tarjetaMonto`, `tarjetaMovId`; `pagado = false`.
- **Eliminar**: si estaba pagado con tarjeta, primero se revierte (§6.4).
- **Carrito**: `enCarrito: true` solo tiene sentido en items pendientes. Montar = poner `true`; sacar = **quitar la clave**. Pagar (a mano o por ticket) quita la clave. "Vaciar carrito" la quita de todos los items de la categoría.

## 6. Tarjetas

### 6.1 Crédito

```ts
TarjetaCredito { id; nombre; moneda: 'UYU'|'USD'; tipo: 'credito';
  monto;            // deuda total del mes = cuotas + gastos cargados + cargos + sin detallar
  montoPagado?;     // permite pago parcial
  pagado: boolean;  // true cuando montoPagado ≥ monto y monto > 0
  cuotas?: [{ finId, concepto, numero, total, monto }];
  cargos?: [{ id, concepto, monto, fecha }];
  pagos?:  [{ id, monto, fecha, debitoId?, movId? }] }
```

- `pagadoTarjeta(t) = t.montoPagado !== undefined ? t.montoPagado : (t.pagado ? t.monto : 0)` (compatibilidad con tarjetas viejas sin `montoPagado`).
- `saldoTarjeta(t) = max(0, monto − pagadoTarjeta(t))`.
- **Sin detallar** = `monto − Σcuotas − Σ(montoCargado de gastos de la tarjeta) − Σcargos`. Si ≠ 0 se muestra y es editable: editar fija `monto = Σpartes + valor`.
- **Agregar cargo**: agrega a `cargos` y suma a `monto`. **Eliminar cargo**: lo quita y resta (mínimo 0).
- **Pagar** `m` (tope = saldo): agrega `pago { id, monto, fecha }`; `montoPagado += m`; `pagado = montoPagado ≥ monto && monto > 0`. Si se paga desde un débito de la **misma moneda**, ese débito recibe un movimiento automático `{ id: movId, ts, fecha, monto: saldoActual − m, nota: "Pago {nombreTarjeta}", auto: true }` y el pago guarda `debitoId` y `movId`.
- **Deshacer pagos**: elimina de cada débito los movimientos `movId` de los pagos, y quita `montoPagado` y `pagos` de la tarjeta; `pagado = false`.

### 6.2 Débito

```ts
TarjetaDebito { id; nombre; moneda; tipo: 'debito'; saldoInicial;
  saldos: [{ id?, ts, fecha, monto, nota, auto? }] }   // saldos ABSOLUTOS
```

- `saldoActual = último(saldos).monto ?? saldoInicial`.
- Variación de un registro = su monto − el anterior (o `saldoInicial` para el primero).
- "Registrar saldo" agrega una entrada manual (sin `auto`).

### 6.3 Pagar un gasto con tarjeta

Solo tarjetas **UYU** (los gastos no tienen moneda). Sea `monto` el monto pagado y `concepto` el nombre del item:

- **Crédito**: `tarjeta.monto += monto`. El item guarda `tarjetaId`, `tarjetaMonto = monto`.
- **Débito**: se agrega a `saldos` `{ id: movId, ts, fecha: "DD/MM HH:mm", monto: saldoActual − monto, nota: "Pago: {concepto}", auto: true }`. El item guarda `tarjetaId`, `tarjetaMonto`, `tarjetaMovId = movId`.
- `movId = "mov_" + base36(timestamp)`; si se generan varios en la misma operación, agregar sufijo `_n` para que sean únicos.

### 6.4 Revertir

- **Crédito**: `monto = max(0, monto − tarjetaMonto)` (si no hay `tarjetaMonto`, usar `real`).
- **Débito**: quitar de `saldos` la entrada con `id === tarjetaMovId`.

### 6.5 Arrastre de tarjetas entre meses

Al crear un mes (o al pulsar "Traer tarjetas" en un mes sin tarjetas):

1. Buscar hacia atrás, hasta **12 meses**, el primer mes existente con al menos una tarjeta (leyendo y normalizando cada mes).
2. Transformar (`tarjetasParaMesNuevo`):
   - **Débito**: `saldoInicial = saldoActual` del mes origen; `saldos = []`.
   - **Crédito**: se conservan id, nombre, moneda y tipo; se **quitan** `cuotas`, `pagos` y `montoPagado`; `monto = 0`, `pagado = false`.
     - ⚠️ La web actual **también conserva `cargos`** del mes anterior (con `monto = 0` eso genera un "Sin detallar" negativo). Es un bug conocido ([09](./09-operacion.md#5-deuda-técnica-y-bugs-conocidos)): la implementación móvil debe **quitar también `cargos`**.
3. Aplicar las cuotas del mes (§7).

### 6.6 Modelo contable (flujo de caja)

- Un item pagado con tarjeta de **crédito** NO es gasto real del mes; es deuda de la tarjeta. Se vuelve gasto real cuando se **paga la tarjeta**.
- Un item pagado en **efectivo o débito** es gasto real al pagarse.
- `idsCredito = ids de tarjetas con tipo ≠ 'debito'`.
- `cuentaComoGastoReal(item) = item.pagado === true && !(item.tarjetaId ∈ idsCredito)`.
- `montoCargado(item) = item.tarjetaMonto ?? item.real`.
- `previstoPropioTarjeta(t) = max(0, t.monto − Σ montoCargado(items pagados con t))` — lo que la tarjeta aporta al presupuesto **sin duplicar** gastos ya previstos en su categoría (cuotas + cargos propios).

## 7. Compras en cuotas (financiaciones)

```ts
Financiacion { id; concepto; tarjetaNombre; moneda; montoCuota; cuotasTotales;
               anioInicio; mesInicio /* 0-indexado */; creadoEn }
```

- `numeroCuota(f, año, mes) = (año − anioInicio)·12 + (mes − mesInicio) + 1`.
- Activa si `1 ≤ n ≤ cuotasTotales`. Restantes después del mes: `max(0, cuotasTotales − max(0, n))`.
- Marca de cuota aplicada: `"{finId}_{n}"` en `mesData.cuotasAplicadas`.
- **Aplicar cuotas del mes** (idempotente): para cada cuota activa sin marca, buscar tarjeta de crédito con mismo **nombre** (comparación sin mayúsculas ni espacios extremos) y misma moneda; si no existe, crearla (`{ id, nombre, moneda, tipo: 'credito', monto: 0, pagado: false }`). Sumar `montoCuota` a `monto`, agregar a `cuotas` `{ finId, concepto, numero, total, monto }`, agregar la marca.
- Al dar de alta en modo "total", `montoCuota = total / cuotas`.

## 8. Comprobantes (tickets)

### 8.1 Resultado de la lectura

`{ tienda, items: [{ nombre, cantidad, precio_unitario, total }], total_pagado, observaciones }`. Se descartan items sin nombre; `total` se fuerza a número.

### 8.2 Asignación por item

Estado por item: `{ grupoId, periodoNumero, destino, sugerido, cargando }` donde `destino ∈ {nombre de gasto existente, '__nuevo__', '__ignorar__'}`. Tras la sugerencia de la IA: `destino = sugerido ?? '__nuevo__'`. Las respuestas que llegan tarde (si el usuario cambió categoría/período mientras se esperaba) se descartan.

### 8.3 Reparto proporcional del descuento

```
suma = Σ item.total
hayDescuento = total_pagado > 0 && total_pagado < suma − 0.01 && total_pagado ≥ suma · 0.5
si hayDescuento y el usuario no desmarcó el reparto:
  f = total_pagado / suma
  montos[i] = round2(total[i] · f)
  diff = round2(total_pagado − Σ montos)
  montos[índice del total original más alto] = round2(ese monto + diff)
si no: montos[i] = total[i]
```

`round2(x) = Math.round(x · 100) / 100`. Ejemplo real: suma 1633,90, pagado 1607,72 (descuento Ley 19210 de 26,18).

### 8.4 Aplicar un ticket

Entrada: asignaciones (items no ignorados) `{ tipo: 'matchear'|'crear', grupoId, periodoNumero, itemName, nombre, monto }`, `tarjetaId` (o vacío) y el registro del comprobante. Todo se aplica sobre una copia del mes y se guarda **en una sola escritura**.

Para cada asignación `n`:
1. Si hay tarjeta: aplicar §6.3 con `monto` y `concepto = nombre` (movId con sufijo `_n`); `datosTarjeta = { tarjetaId, tarjetaMonto: monto, tarjetaMovId? }`.
2. Ubicar el período `periodoNumero` de la categoría (normalizando formatos legados).
3. Si `tipo === 'matchear'`, buscar el item existente por **nombre exacto**:
   - **Existe y está pendiente** → `real = monto`, `pagado = true`, quitar `enCarrito`, agregar `datosTarjeta`.
   - **Existe, ya pagado, sin tarjeta, y el ticket se paga sin tarjeta** → `real += monto`.
   - **Existe pero ya pagado en otro caso** (con tarjeta, o el ticket va con tarjeta) → agregar un item **aparte** con el mismo nombre: `{ nombre, previsto: 0, real: monto, pagado: true, ...datosTarjeta }` (un item no puede quedar vinculado a dos pagos).
4. Si no existe o `tipo === 'crear'` → agregar `{ nombre, previsto: monto, real: monto, pagado: true, ...datosTarjeta }`.
5. Agregar el registro a `comprobantes` (§8.5) con `id = "cp_" + base36`, `fecha` ISO, `tarjetaId`, `tarjetaNombre`, `tarjetaTipo` (o `null`), limpiando `undefined`.

### 8.5 Registro del comprobante

```ts
Comprobante { id; fecha /* ISO */; tienda; observaciones;
  totalItems;          // suma leída
  totalPagado;         // total_pagado si hubo descuento, si no = totalItems
  descuentoRepartido;  // boolean
  tarjetaId|null; tarjetaNombre|null; tarjetaTipo: 'debito'|'credito'|null;
  items: [{ nombre; cantidad; precioUnitario|null; total; monto;
            destino: 'existente'|'nuevo'|'ignorado';
            grupoId|null; periodoNumero|null; gasto|null; sugeridoIA: boolean }] }
```

Eliminar un registro no revierte nada.

## 9. Caja de ahorro

Movimientos (en orden de inserción) con `id`, `fecha`, `descripcion` y por tipo:

| tipo | campos | efecto |
|------|--------|--------|
| `transferencia` | `montoUYU`, `tasa`, `montoUSD = montoUYU / tasa` | saldo USD += montoUSD |
| `deposito_uyu` | `montoUYU` | saldo UYU += montoUYU |
| `ajuste_usd` / `ajuste` (legado) | `saldoUSD` | saldo USD **=** saldoUSD |
| `ajuste_uyu` | `saldoUYU` | saldo UYU **=** saldoUYU |

Los saldos se recalculan recorriendo todos los movimientos; no hay saldo persistido.

## 10. Fórmulas de totales del mes (Dashboard, Resumen y herramientas de IA)

Sea `G` el conjunto de categorías del presupuesto, `items(g)` todos los items de todos los períodos de `g`, `C_UYU` las tarjetas de crédito en UYU.

| Magnitud | Fórmula |
|----------|---------|
| Ingresos previstos | `Σ ingresos.previsto` |
| Ingresos reales | `Σ ingresos.real` |
| Previsto categoría | `Σ items(g).previsto` |
| Real categoría | `Σ items(g).real` donde `cuentaComoGastoReal` |
| % avance categoría | `min(105, round(real / previsto · 100))` (0 si previsto = 0) |
| Previsto tarjetas | `Σ_{t∈C_UYU} previstoPropioTarjeta(t)` |
| Real tarjetas | `Σ_{t∈C_UYU} pagadoTarjeta(t)` |
| Pendiente tarjetas UYU / USD | `Σ saldoTarjeta(t)` por moneda |
| **Total gastos previsto** | `Σ previsto categorías + previsto tarjetas + objetivoAhorro` |
| **Total gastos real** | `Σ real categorías + real tarjetas + objetivoAhorro` |
| **Saldo libre** (prev/real) | `ingresos − total gastos` (prev/real) |
| **Ahorro neto** (Dashboard) | `ingresos reales − Σ real categorías − real tarjetas` |
| % objetivo | `round(ahorroNeto / objetivoAhorro · 100)` |
| % sobre ingresos (Resumen) | `round(previsto / ingresos previstos · 100)` |
| Pendientes (lista) | items con `pagado ≠ true` y `previsto > 0` (monto mostrado: previsto) + tarjetas de crédito con saldo > 0 |

> El objetivo de ahorro se trata como un **gasto fijo del mes** en los totales.

## 11. Formatos de presentación

- UYU: `Intl.NumberFormat('es-UY', { maximumFractionDigits: 0, useGrouping: false })` → `$1607`.
- USD: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })`.
- Fechas de movimientos: `DD/MM HH:mm`. Fechas de registros: ISO 8601.
- IDs generados en cliente: `slug(nombre) + '_' + Date.now().toString(36)` o prefijos (`tj_`, `cg_`, `pg_`, `mov_`, `fin_`, `cp_`).
