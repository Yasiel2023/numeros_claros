# Modelo de datos — Firebase Realtime Database

Proyecto Firebase: `numeros-claros` (ver `.firebaserc` / `src/firebase.js`). Base de datos: `https://numeros-claros-default-rtdb.firebaseio.com`. Todo el árbol vive bajo un puñado de nodos raíz independientes (no hay Firestore en uso — ver [estado-proyecto.md](./estado-proyecto.md)).

## Árbol raíz

```
presupuestos/
  {ownerUid}/
    {presupuestoId}/
      _meta            { nombre, creadoEn }
      _defaults        { grupos_gastos: [...], ingresos: [...] }
      _caja_ahorro      { movimientos: [...] }
      _financiaciones   [ Financiacion, ... ]   ← compras en cuotas, cruzan meses
      {año}_{mesIdx}/   ← ej. "2026_2" = marzo 2026 (mes 0-indexado)
        ingresos: [...]
        gastos: { [grupoId]: Periodo[] }
        tarjetas: [...]
        objetivoAhorro: number
        cuotasAplicadas: ["finId_3", ...]  ← cuotas ya cargadas a tarjetas este mes
        semanas: []      ← legado, se mantiene por compatibilidad pero no se usa

accesos/
  {uid}/
    {presupuestoId}   { ownerUid, nombre, rol: 'owner'|'miembro', creadoEn, invitadoPor? }

invitaciones/
  {uid}/
    {presupuestoId}   { presupuestoId, ownerUid, ownerEmail, presupuestoNombre, estado: 'pendiente'|'aceptada'|'rechazada', enviadaEn }

email_uid/
  {emailCodificado}   → uid          (codificado: '.' reemplazado por ',', ver encodeEmail())

defaults/
  {templateId}        { _meta: {nombre, creadoEn}, grupos_gastos: [...], ingresos: [...] }
  general              ← plantilla especial: semilla que precarga OnboardingWizard para usuarios nuevos

user_templates/
  {uid}/
    {templateId}      { _meta: {nombre, creadoEn}, objetivoAhorro, grupos_gastos: [...], ingresos: [...] }
```

## Formas de cada entidad

### Grupo de gastos (dentro de `_defaults.grupos_gastos` o de una plantilla)

```js
{
  id: string,          // slug + timestamp, ej "basicos_a1b2"
  nombre: string,
  icono: string,        // emoji
  frecuencia: 'mensual' | 'quincenal' | 'cada10dias' | 'semanal',
  items: [{ nombre: string, previsto: number }],
}
```

### Ingreso (en `_defaults.ingresos`, plantillas, o `mesData.ingresos`)

```js
{ nombre: string, previsto: number, real?: number, esFijo: boolean }
```

### Período de gasto (dentro de `mesData.gastos[grupoId]`, uno por cada período que le toque al grupo ese mes según su frecuencia)

```js
{
  numero: number,
  label: string,        // ej "1ra quincena (1-15 Marzo)" o "Semana 1 (05/03)"
  items: [{
    nombre: string,
    previsto: number,
    real: number,        // hereda `previsto` si no se edita a mano
    pagado: boolean,
    // Solo si se pagó con tarjeta (ver "Pagos cargados a tarjeta" abajo):
    tarjetaId?: string,   // tarjeta con la que se pagó
    tarjetaMonto?: number, // monto efectivamente cargado (para poder revertirlo)
    tarjetaMovId?: string, // solo débito: id del movimiento generado en `saldos`
  }],
}
```

Compatibilidad hacia atrás: si `mesData.gastos[grupoId]` es un array de ítems planos (sin `items` anidado) en vez de un array de períodos, `GrupoGastos.toPeriodos()` y `App.normalizeMesData()` lo envuelven en un único período `{numero:1, label:'Mes', items:[...]}`.

### Tarjeta (`mesData.tarjetas`)

Crédito:
```js
{
  id: string, nombre, moneda: 'UYU'|'USD', tipo: 'credito',
  monto: number,          // deuda total del mes = cuotas + gastos cargados + cargos manuales
  montoPagado?: number,    // cuánto se pagó de esa deuda (permite pago parcial)
  pagado: boolean,         // true cuando montoPagado cubre el total
  cuotas?: [{ finId, concepto, numero, total, monto }],  // cuotas de financiaciones cargadas este mes
  cargos?: [{ id, concepto, monto, fecha }],              // compras sueltas cargadas a la tarjeta
  pagos?: [{ id, monto, fecha, debitoId?, movId? }],      // cada pago hecho contra la deuda
}
```

`monto` es el total y se mantiene sincronizado con sus tres componentes (`cuotas` + gastos vinculados + `cargos`). Si una tarjeta tiene un `monto` mayor que la suma de sus partes — porque venía de antes, cuando el monto se cargaba a mano — la diferencia se muestra como "Sin detallar" y sigue siendo editable.

El saldo a pagar de una tarjeta es `monto - montoPagado`. Las tarjetas creadas antes del pago parcial no tienen `montoPagado`: en ese caso `pagado: true` equivale a haber pagado el total (los tres componentes que lo calculan — `Tarjetas.js`, `Dashboard.js` y `Resumen.js` — contemplan ese caso).

Un pago puede hacerse **desde una tarjeta de débito** (solo de la misma moneda): entonces el pago guarda `debitoId` y `movId`, y se agrega al historial de esa cuenta un movimiento `auto` que descuenta el monto. "Deshacer pago" revierte todos los pagos de la tarjeta y elimina esos movimientos del débito. Sin `debitoId`, el pago se considera hecho en efectivo/transferencia y no toca ninguna cuenta.
Débito:
```js
{
  id: string, nombre, moneda: 'UYU'|'USD', tipo: 'debito',
  saldoInicial: number,
  saldos: [{ id?: string, ts: number, fecha: string, monto: number, nota: string, auto?: boolean }],
  // historial de saldos absolutos; el último es el saldo actual
}
```

`id` se usa para vincular pagos de gastos a la tarjeta. Las tarjetas creadas antes de esta funcionalidad no lo tienen: `normalizeMesData()` en `App.js` se lo asigna al cargar el mes, y queda persistido en el siguiente guardado.

### Pagos cargados a tarjeta

Al marcar un ítem de gasto como pagado se puede elegir con qué tarjeta se pagó (solo tarjetas en UYU, porque los ítems de gasto no tienen moneda propia). El efecto sobre la tarjeta es inmediato y se guarda en la misma escritura que el ítem:

- **Crédito** → suma el monto a `monto` (la deuda pendiente de esa tarjeta crece).
- **Débito** → agrega al historial `saldos` una entrada con `auto: true` cuyo `monto` es el saldo anterior menos lo pagado, con nota `"Pago: {concepto}"`.

Deshacer el pago (o borrar el ítem) revierte el efecto: resta la deuda de crédito, o elimina del historial la entrada `auto` identificada por `tarjetaMovId`. Toda esta lógica vive en `src/components/GrupoGastos.js` (`aplicarPagoTarjeta` / `revertirPagoTarjeta`).

### Financiación (compra en cuotas)

```js
{
  id: string, concepto: string,
  tarjetaNombre: string,   // vínculo con la tarjeta POR NOMBRE, no por id
  moneda: 'UYU'|'USD',
  montoCuota: number, cuotasTotales: number,
  anioInicio: number, mesInicio: number,   // mes 0-indexado de la primera cuota
  creadoEn: string,
}
```

Vive a nivel presupuesto (`_financiaciones`) porque cruza meses. El vínculo con la tarjeta es **por nombre** y no por `id` porque los ids de tarjeta son por mes.

Para un mes dado, el número de cuota es `(anio - anioInicio) * 12 + (mes - mesInicio) + 1`, y la financiación está activa si ese número cae entre 1 y `cuotasTotales`. La lógica está en [`src/financiaciones.js`](../src/financiaciones.js).

**Cómo aterriza en el mes**: al iniciar un mes nuevo, las cuotas activas se suman automáticamente al `monto` de su tarjeta de crédito (creándola si no existe en ese mes). En meses que ya existían, la vista Tarjetas muestra un banner para aplicarlas a mano. Cada cuota aplicada queda registrada en `mesData.cuotasAplicadas` como `"{finId}_{numeroCuota}"`, lo que hace la operación idempotente: volver a entrar al mes nunca duplica el cargo.

**Arrastre de tarjetas**: al iniciar un mes nuevo se copian las tarjetas del mes anterior — las de crédito vuelven a `monto: 0` y las de débito arrastran su último saldo como `saldoInicial`. Antes de esto cada mes arrancaba sin ninguna tarjeta.

### Movimiento de caja de ahorro (`_caja_ahorro.movimientos`)

Discriminado por `tipo`:

| tipo             | campos relevantes                          | efecto |
|------------------|---------------------------------------------|--------|
| `transferencia`  | `montoUYU`, `tasa`, `montoUSD` (=UYU/tasa)  | suma a saldo USD |
| `deposito_uyu`   | `montoUYU`                                  | suma a saldo UYU |
| `ajuste_uyu`     | `saldoUYU`                                  | **fija** (no suma) el saldo UYU |
| `ajuste_usd` / `ajuste` (legado) | `saldoUSD`                | **fija** (no suma) el saldo USD |

Todos tienen además `id` (`Date.now().toString(36)`), `fecha`, `descripcion`. Los saldos finales se recalculan en el cliente recorriendo el array completo (`CajaAhorro.js`) — no hay campo de saldo persistido aparte.

### `mesData` completo

```js
{
  ingresos: Ingreso[],
  gastos: { [grupoId: string]: Periodo[] },
  tarjetas: Tarjeta[],
  objetivoAhorro: number,
  semanas: [],   // legado, no usado por la UI actual
}
```

## Notas de codificación

- **Claves de mes**: `${año}_${mes}` con `mes` 0-indexado (enero=0 … diciembre=11).
- **Claves de email**: RTDB no permite `.` en claves, así que los emails se guardan con `.` → `,` (`encodeEmail()` duplicada en `AuthContext.js`, `App.js` y `CompartirModal.js`).
- **Arrays vs objetos**: cualquier array guardado y releído desde RTDB puede volver como objeto `{ "0": x, "1": y }`. Todo el código de lectura pasa los datos por un helper `toArray()` (reimplementado localmente en varios archivos) antes de usarlos como array.
- **IDs generados en cliente**: presupuestos, grupos y plantillas usan `slug(nombre) + '_' + Date.now().toString(36)` — no hay autoincrementales de servidor.

## Reglas de acceso actuales

`database.rules.json` en la raíz del repo:

```json
{ "rules": { ".read": "now < 1776049200000", ".write": "now < 1776049200000" } }
```

Es decir: **lectura y escritura abiertas a cualquiera** (autenticado o no) hasta el 13 de abril de 2026, y **denegadas para todos** después de esa fecha. No hay reglas por `uid`/rol pese a que el modelo de datos ya distingue `ownerUid` y `rol` en `accesos/`. Ver el riesgo detallado en [estado-proyecto.md](./estado-proyecto.md#reglas-de-realtime-database-abiertas).
