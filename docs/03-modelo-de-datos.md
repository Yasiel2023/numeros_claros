# 03 — Modelo de datos

**Motor:** Firebase Realtime Database (RTDB), proyecto `numeros-claros`, URL `https://numeros-claros-default-rtdb.firebaseio.com`. No se usa Firestore (hay archivos `firestore.rules` legados que no se despliegan).

## 1. Árbol completo

```
presupuestos/
  {ownerUid}/
    {presupuestoId}/
      _meta              { nombre, creadoEn }
      _defaults          { grupos_gastos: Grupo[], ingresos: IngresoBase[] }
      _caja_ahorro       { movimientos: MovimientoCaja[] }
      _financiaciones    Financiacion[]
      _ia_contexto       { notas: string, actualizado: ISO }
      {año}_{mes}/       Mes                          ← ej. "2026_9" = octubre 2026

accesos/
  {uid}/{presupuestoId}  { ownerUid, nombre, rol: 'owner'|'miembro', creadoEn?, invitadoPor? }

invitaciones/
  {uidInvitado}/{presupuestoId}
                         { presupuestoId, ownerUid, ownerEmail, presupuestoNombre,
                           estado: 'pendiente'|'aceptada'|'rechazada', enviadaEn }

email_uid/
  {emailCodificado}      uid                          ← '.' reemplazado por ','

config/
  {uid}/                 { groq_api_key?, groq_url?, groq_model?, gemini_api_key? }

user_templates/
  {uid}/{templateId}     PlantillaMes

defaults/
  {templateId}           PlantillaPresupuesto         ← "general" es la semilla del onboarding

admins/
  {uid}                  true                         ← solo cambia un aviso en Configuración
```

## 2. Esquemas (TypeScript de referencia)

```ts
type Moneda = 'UYU' | 'USD';
type Frecuencia = 'mensual' | 'quincenal' | 'cada10dias' | 'semanal';

interface Grupo {                // _defaults.grupos_gastos[], plantillas
  id: string;                    // slug + sufijo, ej "compras" o "supermercado_k3f9"
  nombre: string;
  icono?: string;                // emoji
  frecuencia?: Frecuencia;       // si falta: tipo === 'semanas' ? 'semanal' : 'mensual'
  tipo?: 'semanas' | 'impuesto' | string;   // LEGADO
  items: { nombre: string; previsto: number }[];
}

interface IngresoBase { nombre: string; previsto: number; esFijo?: boolean }
interface Ingreso extends IngresoBase { real: number }

interface Item {
  nombre: string;
  previsto: number;
  real?: number;                 // si falta, se usa previsto
  pagado: boolean;
  enCarrito?: true;              // solo pendientes; se borra la clave al sacar/pagar
  tarjetaId?: string;
  tarjetaMonto?: number;
  tarjetaMovId?: string;         // solo débito
}

interface Periodo { numero: number; label: string; items: Item[] }

interface Mes {
  ingresos: Ingreso[];
  gastos: Record<string /* grupoId */, Periodo[] | Item[] /* LEGADO plano */>;
  tarjetas: (TarjetaCredito | TarjetaDebito)[];
  comprobantes?: Comprobante[];
  objetivoAhorro: number;
  cuotasAplicadas?: string[];    // "{finId}_{n}"
  semanas?: [];                  // LEGADO, siempre vacío
  // LEGADO muy antiguo (sin "gastos"): basicos, impuestos, asceo, ocio como Item[]
}
```

Las interfaces `TarjetaCredito`, `TarjetaDebito`, `Financiacion`, `Comprobante` y `MovimientoCaja` están en [02](./02-dominio-y-reglas.md) (§6, §7, §8.5, §9).

```ts
interface PlantillaPresupuesto {   // defaults/{id}
  _meta: { nombre: string; creadoEn: string };
  grupos_gastos: Grupo[];
  ingresos: IngresoBase[];
}

interface PlantillaMes extends PlantillaPresupuesto {   // user_templates/{uid}/{id}
  objetivoAhorro?: number;
}
```

## 3. Ejemplo de un mes (abreviado)

```json
{
  "ingresos": [{ "nombre": "Sueldo Yasiel", "previsto": 80000, "real": 80000, "esFijo": true }],
  "gastos": {
    "compras": [
      { "numero": 1, "label": "Semana 1 (03/10)", "items": [
        { "nombre": "Leche", "previsto": 300, "real": 280, "pagado": true,
          "tarjetaId": "tj_lq2x", "tarjetaMonto": 280, "tarjetaMovId": "mov_lq9a_0" },
        { "nombre": "Pan", "previsto": 200, "real": 200, "pagado": false, "enCarrito": true }
      ]}
    ]
  },
  "tarjetas": [
    { "id": "tj_lq2x", "nombre": "BROU Débito", "moneda": "UYU", "tipo": "debito",
      "saldoInicial": 50000,
      "saldos": [{ "id": "mov_lq9a_0", "ts": 1759330000000, "fecha": "03/10 18:20",
                   "monto": 49720, "nota": "Pago: LECHE CONAPROLE", "auto": true }] }
  ],
  "comprobantes": [{ "id": "cp_lq9a", "fecha": "2026-10-03T21:20:00.000Z", "tienda": "FRESH MARKET",
    "totalItems": 285.6, "totalPagado": 280, "descuentoRepartido": true,
    "tarjetaId": "tj_lq2x", "tarjetaNombre": "BROU Débito", "tarjetaTipo": "debito",
    "observaciones": "", "items": [ { "nombre": "LECHE CONAPROLE", "cantidad": 1,
      "precioUnitario": 285.6, "total": 285.6, "monto": 280, "destino": "existente",
      "grupoId": "compras", "periodoNumero": 1, "gasto": "Leche", "sugeridoIA": true } ] }],
  "objetivoAhorro": 15000,
  "cuotasAplicadas": ["fin_lp0k_3"]
}
```

## 4. Convenciones de escritura

1. **El mes se escribe completo** (`set` sobre `presupuestos/{owner}/{pid}/{mesKey}`) con debounce ~1,2 s. Las operaciones compuestas (pagar con tarjeta, aplicar ticket) modifican gastos y tarjetas **en el mismo objeto** para que queden consistentes.
2. **Nunca `undefined`**: RTDB lo rechaza. Para quitar un campo, destructurar y omitirlo; en registros armados con campos opcionales, limpiar con `JSON.parse(JSON.stringify(obj))` o usar `null`.
3. **IDs en cliente**: `prefijo_` + `Date.now().toString(36)` (+ sufijo `_n` si se generan varios en un mismo instante).
4. **Claves de email**: `email.toLowerCase()` con `.` → `,`.
5. **Fechas**: ISO 8601 para registros (`creadoEn`, `fecha` de comprobante); `DD/MM HH:mm` para movimientos de tarjetas (formato legado de la web, solo display).
6. Los datos a nivel presupuesto (`_caja_ahorro`, `_financiaciones`, `_ia_contexto`) se guardan en su propio nodo, **no** dentro del mes.
7. Los nombres que se escriben en la base son los **originales** (no los renombres de pantalla).

## 5. Normalización al leer

RTDB devuelve un array como **objeto** `{"0": …, "2": …}` cuando tiene huecos. Toda lectura debe pasar por:

```ts
function toArray<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v != null);
  return Object.keys(val).sort((a, b) => +a - +b).map(k => (val as any)[k]).filter(v => v != null);
}
```

`normalizeMesData(raw)`:
- `ingresos`, `tarjetas`, `comprobantes` (y sus `items`), `semanas` → `toArray`.
- `gastos[g]` → `toArray`; si el primer elemento tiene `items`, es array de períodos (normalizar cada `items`); si no, es **formato plano legado** y se envuelve como `[{ numero: 1, label: 'Mes', items }]` (`toPeriodos`).
- Sin `gastos` (formato muy antiguo): construir `gastos` desde `basicos`, `impuestos`, `asceo`, `ocio`.
- Tarjetas sin `id`: asignar `tj_{índice}_{slug(nombre) de hasta 10 chars}` (queda persistido en el próximo guardado). Débito: `saldos` → `toArray`.
- Tarjetas de crédito: `pagos`, `cuotas`, `cargos` → `toArray` (al leer desde código nuevo).

## 6. Índices y consultas

RTDB no tiene consultas por campo en este modelo; todas las lecturas son por **ruta directa**:

| Necesidad | Lectura |
|-----------|---------|
| Presupuestos propios | `presupuestos/{uid}` (trae todo: usar solo para la lista; ver nota) |
| Compartidos | `accesos/{uid}` |
| Defaults | `presupuestos/{owner}/{pid}/_defaults` |
| Mes | `presupuestos/{owner}/{pid}/{AAAA_M}` |
| Meses anteriores (arrastre, IA) | lecturas individuales por clave, una por mes |

> **Nota de rendimiento:** leer `presupuestos/{uid}` para listar descarga todos los meses de todos los presupuestos propios. En la app móvil conviene listar desde `accesos/{uid}` (que ya incluye los propios tras la migración RF-PRES-2) y leer `_meta` puntualmente.

## 7. Compatibilidad con la web

La web y la app móvil escriben en los mismos nodos. Reglas:
- No renombrar ni eliminar campos existentes.
- Campos nuevos: opcionales y con valor por defecto al leer.
- Mantener la escritura de formatos que la web lee (por ejemplo, `real` en items y `cuotasAplicadas`).
- Probar cada cambio de esquema abriendo el mismo mes en ambas apps.
