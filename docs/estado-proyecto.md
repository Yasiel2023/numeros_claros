# Estado del proyecto — hallazgos de la revisión

Notas producidas al revisar el repo completo. No son tareas hechas, son observaciones para decidir qué limpiar o corregir.

## Reglas de Realtime Database abiertas ⚠️

[`database.rules.json`](../database.rules.json):

```json
{ "rules": { ".read": "now < 1776049200000", ".write": "now < 1776049200000" } }
```

Esto es el modo "prueba" que ofrece Firebase por defecto: **cualquiera con la URL de la base de datos puede leer y escribir todo el contenido**, sin necesidad de estar autenticado, hasta el **13 de abril de 2026**. Después de esa fecha, `.read`/`.write` se vuelven `false` para todos — incluida la propia app — y **la aplicación dejará de funcionar por completo** hasta que se reemplacen las reglas.

El modelo de datos ya tiene todo lo necesario para reglas correctas (`accesos/{uid}/{presupuestoId}` con `ownerUid` y `rol`), pero las reglas no lo usan todavía. Esto vale la pena resolverlo antes del 13/04/2026, y antes también por el riesgo de exposición de datos financieros mientras las reglas están abiertas.

## Firestore: reglas presentes pero no usadas

Hay **tres copias** de reglas de Firestore en el repo:
- `firestore.rules` (raíz)
- `src/firestore.rules`
- `Nueva carpeta (2)/firestore.rules`

Ninguna se despliega: `firebase.json` solo declara `hosting` y `database` (Realtime Database). El código fuente (`src/`) no importa `firebase/firestore` en ningún archivo — todo pasa por `firebase/database`. Son vestigios de una versión anterior del proyecto (ver carpeta "Nueva carpeta" más abajo). Se pueden borrar sin impacto funcional.

## Componentes huérfanos

`Basicos.js`, `Impuestos.js`, `Asceo.js`, `Ocio.js` y `Semanas.js` (en `src/components/`) **no están importados en `App.js`** y no se renderizan en ningún lado. Fueron reemplazados por el componente genérico `GrupoGastos.js`, que cubre el mismo caso de uso (y más: soporta cualquier grupo con cualquier frecuencia, no solo las 4 categorías originales). Son candidatos a eliminación si no se planea volver a un modelo de categorías fijas; mientras tanto no afectan el bundle de producción salvo por tamaño de repo (CRA solo empaqueta lo que se importa desde `index.js`/`App.js`).

## Carpetas sueltas en la raíz del repo

- `Nueva carpeta/` — copia de una versión **v1** del proyecto (`package.json` con `name: "budget-app"`, `App.js`, `AuthContext.js`, `firebase.js`, `firestore.rules` propios, README describiendo setup con Firestore).
- `Nueva carpeta (2)/` — solo `.firebaserc` + `firebase.json` (con `hosting.public: "public"`, distinto del `build` actual) + `firestore.rules`.

Ninguna de las dos participa del build (`react-scripts` solo mira `src/` y `public/` en la raíz del repo) ni está referenciada desde `firebase.json`. Son candidatas claras a limpieza — probablemente restos de copiar/pegar el proyecto durante su evolución de v1 (Firestore) a v2 (Realtime Database).

## `build/` y `public/` con subcarpetas duplicadas

Tanto `build/` como `public/` (la carpeta raíz, además de la carpeta de assets de CRA) contienen una subcarpeta `Nueva carpeta/` con un `index.html`/`asset-manifest.json`/`web.config` propios — artifacts de un build viejo que quedaron mezclados con los actuales. `build/` en particular no debería versionarse en git en primer lugar (es output generado por `npm run build`); vale la pena revisar si está en `.gitignore`.

## READMEs desactualizados

`README.md` (raíz) y `src/README.md` son casi idénticos entre sí y ambos describen un setup con **Firestore** ("Build → Firestore → Crear base de datos", "pegar `firestore.rules`"), que ya no refleja el código actual (Realtime Database). La sección "Lógica de semanas de compra" y "Lógica de pagos pendientes" sí siguen siendo precisas. La sección "Estructura en Firestore" del final describe un esquema plano (`basicos`, `impuestos`, `asceo` como arrays sueltos) que corresponde a un modelo anterior al de "grupos de gastos" dinámicos documentado en [modelo-datos.md](./modelo-datos.md) — quedó desactualizada cuando se introdujo `GrupoGastos.js`.

## Credenciales de Firebase en el repo

`src/firebase.js` tiene la `apiKey` y demás campos de `firebaseConfig` hardcodeados y commiteados. Esto es normal para apps cliente de Firebase (la clave de API no es secreta por diseño; la protección real la dan las reglas de seguridad de la base de datos) — pero **solo es seguro si las reglas de Realtime Database no están abiertas como están ahora**. Ver el punto de arriba.

## Resumen de acciones sugeridas (no ejecutadas)

1. Reemplazar `database.rules.json` por reglas basadas en `auth.uid` + `accesos/` antes del 13/04/2026.
2. Decidir si borrar `Basicos.js`, `Impuestos.js`, `Asceo.js`, `Ocio.js`, `Semanas.js`.
3. Borrar `Nueva carpeta/`, `Nueva carpeta (2)/` y las copias de `firestore.rules` si no se necesitan como referencia histórica.
4. Confirmar que `build/` esté en `.gitignore` y, si no, dejar de versionarlo.
5. Actualizar `README.md` / `src/README.md` para reflejar Realtime Database en vez de Firestore (o simplemente enlazar a esta carpeta `docs/`).
