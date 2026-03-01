# 🏠 CasaFinanzas v2

Planilla familiar digital con React + Firebase.

---

## Estructura de la app

```
Dashboard         → Pagos pendientes, semanas resumen, meta ahorro
Ingresos          → Aplica Yasiel + Practia Aylin (fijos) + variables
Básicos           → Internet, Renta, GYM, etc. Previsto vs Resta pagar
Impuestos         → Con toggle ON/OFF por mes (bimestral, trimestral, etc.)
Compras           → Semanas auto-calculadas por viernes/sábados del mes
Asceo             → Productos de higiene y limpieza mensual
Resumen           → Totales, crédito UYU/USD, meta ahorro, guardado
```

---

## Setup Firebase

### 1. Crear proyecto
[console.firebase.google.com](https://console.firebase.google.com) → Agregar proyecto

### 2. Activar Authentication
Build → Authentication → Sign-in method → **Email/Contraseña** → Activar

### 3. Activar Firestore
Build → Firestore → Crear base de datos → Modo producción → `southamerica-east1`

Pegar reglas de `firestore.rules` en la pestaña "Reglas"

### 4. Copiar config
Configuración del proyecto ⚙ → Tus apps → Web → Registrar → copiar `firebaseConfig`

### 5. Pegar en `src/firebase.js`
```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  ...
};
```

### 6. Instalar y correr
```bash
npm install
npm start
```

### 7. Deploy
```bash
npm run build
firebase login
firebase init hosting   # carpeta: build, SPA: sí
firebase deploy
```

---

## Lógica de semanas de compra

- Se calculan automáticamente los **viernes** de cada mes (con salto del sábado si está pegado)
- Si después del último viernes/sábado quedan **≤ 3 días** hasta fin de mes → NO se cuenta como semana nueva, esos gastos van a la semana anterior
- Ejemplo: si el último viernes es el 28 y el mes termina el 31 (3 días) → se fusiona con la semana anterior

## Lógica de pagos pendientes (Básicos e Impuestos)

- **Real = monto que resta pagar**. Cuando pagás → ponés 0 (o presionás ✓ Pagar)
- Los impuestos tienen toggle ON/OFF para indicar si aplican ese mes
  - Tributos domiciliarios / Saneamiento → mes sí, mes no → apagalo los meses que no viene
  - Gas → cada 3-4 meses → apagalo los meses que no recargás

## Estructura en Firestore

```
presupuestos/{uid}_{año}_{mes}
  ingresos: [ { nombre, previsto, real, esFijo } ]
  basicos:  [ { nombre, previsto, real } ]
  impuestos:[ { nombre, previsto, real, frecuencia, activo } ]
  asceo:    [ { nombre, previsto, real } ]
  semanas:  [ { label, dia, items: [ { nombre, previsto, real } ] } ]
  creditoUYU: number
  creditoUSD: number
  metaAhorro: number
  guardado: number
  guardadoMesAnterior: number
```
