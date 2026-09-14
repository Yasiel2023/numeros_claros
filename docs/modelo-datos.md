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
      {año}_{mesIdx}/   ← ej. "2026_2" = marzo 2026 (mes 0-indexado)
        ingresos: [...]
        gastos: { [grupoId]: Periodo[] }
        tarjetas: [...]
        objetivoAhorro: number
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
  }],
}
```

Compatibilidad hacia atrás: si `mesData.gastos[grupoId]` es un array de ítems planos (sin `items` anidado) en vez de un array de períodos, `GrupoGastos.toPeriodos()` y `App.normalizeMesData()` lo envuelven en un único período `{numero:1, label:'Mes', items:[...]}`.

### Tarjeta (`mesData.tarjetas`)

Crédito:
```js
{ nombre, moneda: 'UYU'|'USD', tipo: 'credito', monto: number, pagado: boolean }
```
Débito:
```js
{
  nombre, moneda: 'UYU'|'USD', tipo: 'debito',
  saldoInicial: number,
  saldos: [{ ts: number, fecha: string, monto: number, nota: string }],  // historial, último = saldo actual
}
```

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
