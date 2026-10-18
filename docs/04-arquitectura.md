# 04 — Arquitectura

## 1. Arquitectura actual (web)

```
┌──────────────────────── Navegador ─────────────────────────┐
│ React 18 (Create React App, sin router, sin store global)   │
│  App.js (AppInterna) ── estado central: presupuestos, mes,  │
│     mesData, defaults, tarjetas, caja, financiaciones, vista │
│  components/* ── pantallas (props hacia abajo)              │
│  Dominio: tarjetas.js · financiaciones.js · constants.js    │
│  IA: ia.js (tickets) · iaChat.js (chat) · iaCliente.js      │
│  Diseño: useEsMovil (≤ 900 px) elige la UI de celular o web │
│  PWA: manifest.json + service-worker.js                     │
│  Android: Capacitor 8 envuelve build/ (android/)            │
└───────┬───────────────────────────┬─────────────────────────┘
        │ Firebase JS SDK 10        │ fetch (Bearer = ID token de Firebase)
        ▼                           ▼
 Firebase Auth + Realtime DB    Worker de Cloudflare (ia-worker/)
 Firebase Hosting (SPA)           · verifica token, límite por usuario, clave de Groq
                                  ▼
                                Groq API (OpenAI-compatible)
                                · visión: qwen/qwen3.8-27b
                                · chat: sistema/ia/groq_model (por defecto openai/gpt-oss-120b)
```

| Pieza | Detalle |
|-------|---------|
| UI | React 18, `react-scripts` 5, `lucide-react` (íconos), `recharts` (Resumen), Chart.js 3.9.1 por CDN (gráficos del chat). Estilos en `App.css` (base), `movil.css` (diseño de celular) y `web.css` (escritorio). Íconos propios del prototipo en `iconos.js`. |
| Diseño responsive | `useEsMovil()` (`matchMedia('(max-width: 900px)')`) decide entre componentes de celular y de escritorio: `GrupoGastosMovil`/`GrupoGastosWeb` (el contenedor `GrupoGastos` conserva la lógica), `TarjetasMovil` (`Tarjetas` delega), `GastosLista`/`GastosWeb`, `MasMovil`. En celular hay barra de pestañas (Inicio · Gastos · cámara · Tarjetas · Más). |
| Navegación | Estado `vista` en `App.js` (`dashboard`, `gastos`, `grupo_{id}`, `carrito`, `tarjetas`, `ingresos`, `comprobantes`, `resumen`, `caja`, `chat`, `plantillas`, `config`, `mas`). En escritorio: sidebar fijo y la pantalla Gastos lista las categorías con el detalle de la elegida. En celular: pestañas y pestaña "Más" (`VISTAS_DE_MAS`). |
| Estado | Todo en `AppInterna`; autoguardado con debounce de 1200 ms (`updateMesData` → `set`). |
| Dominio | `src/tarjetas.js` (crédito/débito, gasto real), `src/financiaciones.js` (cuotas, arrastre), `src/constants.js` (meses, frecuencias, semanas), `GrupoGastos.js` (exporta `toPeriodos`, `aplicarPagoTarjeta`, `tarjetasDisponibles`, `saldoActualDebito`). |
| IA | `src/iaCliente.js`: único punto de salida (`llamarIA({ tipo, ...pedido })` → Worker). `src/ia.js`: tickets, sugerencias y armado de presupuesto (achicado de imagen). `src/iaChat.js`: contexto, herramientas y ciclo de *tool calling*. URL del Worker: `REACT_APP_IA_URL` o el valor por defecto. |
| Monedas | `src/moneda.js`: monedas del presupuesto activo (`configurarMonedas` al cambiar de presupuesto) y formato de montos. |
| Hosting | Firebase Hosting, carpeta `build/`, rewrite `** → /index.html`, sin caché para `index.html`, `manifest.json` y `service-worker.js`. |

### 1.1 Worker de IA (`ia-worker/`)

Cloudflare Worker (`numeros-claros-ia`, `wrangler.toml`) que reemplaza la llamada directa a Groq. Por cada `POST`:

1. Verifica el ID token de Firebase (`jose`, JWKS de Google; issuer/audience `numeros-claros`) → `401` si falta o venció.
2. Exige el encabezado `X-IA-Tipo` = `vision` | `chat` y un cuerpo ≤ 6 MB.
3. Lee `sistema/ia` y `admins/{uid}` de RTDB con el token del usuario; si `activa !== true` → `503`.
4. Límite por usuario: binding `LIMITADOR` (Rate Limiting de Cloudflare, 20 pedidos por minuto); los admins no tienen límite → `429`.
5. Antepone el modelo al JSON sin parsearlo (`vision` → `qwen/qwen3.8-27b`; `chat` → `sistema/ia/groq_model` o `openai/gpt-oss-120b`) y reenvía a `{groq_url}/chat/completions` con el secreto `GROQ_API_KEY`.
6. Reintenta ante 429/500/503 con esperas de 1,5 s, 4 s y 8 s; si sigue saturado devuelve `503` con mensaje legible. La respuesta de Groq se devuelve tal cual.

CORS: solo `https://numeros-claros.web.app`, `https://numeros-claros.firebaseapp.com`, `https://localhost` (app Android) y `http://localhost:3000`. Pendiente (TODO en el código): verificar suscripción premium antes del límite.

## 2. Arquitectura objetivo (app móvil nativa)

> Estado: hoy la app móvil es la web con Capacitor (ADR-007). Esta sección describe el objetivo a futuro (Expo).

### 2.1 Decisión de plataforma

**Recomendado: React Native con Expo (TypeScript).** Ver ADR-001.

```
┌──────────────────────────── App móvil (Expo) ───────────────────────────────┐
│ app/ (expo-router)          pantallas y navegación                          │
│ src/features/*              un módulo por funcionalidad (UI + hooks)        │
│ src/core/                   DOMINIO PURO: fórmulas, períodos, tarjetas,     │
│                             cuotas, tickets, normalización  ← tests unitarios│
│ src/data/                   repositorios Firebase (lecturas/escrituras RTDB)│
│ src/ai/                     cliente de IA (tickets, sugerencias, chat+tools)│
│ src/state/                  estado de sesión y mes activo (Zustand)         │
│ src/ui/                     design system (tokens, componentes base)        │
└──────┬─────────────────────────────┬────────────────────────────────────────┘
       │ Firebase JS SDK             │ HTTPS
       ▼                             ▼
 Firebase Auth + RTDB          Worker de Cloudflare "ia" (ADR-004)
 (mismos datos que la web)        └── Groq API (clave como secreto del servidor)
```

### 2.2 Stack propuesto

| Necesidad | Elección | Motivo |
|-----------|----------|--------|
| Framework | Expo SDK (última estable) + React Native + **TypeScript** | Reutiliza el conocimiento de React del proyecto; builds en la nube (EAS) sin Mac para Android. |
| Navegación | `expo-router` (tabs + stacks) | Rutas por archivos, deep links. |
| Estado | `zustand` (sesión, presupuesto y mes activos) + hooks por feature | Simple; evita prop drilling del `App.js` actual. |
| Firebase | SDK JS modular (`firebase/app`, `firebase/auth`, `firebase/database`); persistencia de Auth con `getReactNativePersistence(AsyncStorage)` | Mismo SDK y modelo que la web. |
| Cámara/galería | `expo-image-picker` (cámara y galería) + `expo-image-manipulator` (achicar a 2000 px, JPEG 0,85, base64) | Cámara nativa con enfoque y flash. |
| Gráficos | `react-native-gifted-charts` o `victory-native` | Barras/torta/línea para Resumen y chat. |
| Formularios | Componentes controlados + validación simple | La app tiene formularios pequeños. |
| Preferencias locales | `@react-native-async-storage/async-storage` | Modo carrito por categoría, último presupuesto. |
| Tests | `jest` + `@testing-library/react-native` | Dominio al 100%; pantallas críticas. |
| Errores | `sentry-expo` o Crashlytics | RNF-10. |
| Distribución | EAS Build + EAS Submit | Google Play (y App Store desde la nube, requiere cuenta Apple). |

### 2.3 Capas y reglas de dependencia

```
features (UI) ──► state ──► data ──► core
          │                  │
          └──────► ai ───────┘
```

- `core` no importa nada de React, Firebase ni red. Recibe y devuelve objetos planos.
- `data` traduce entre RTDB y `core` (normaliza al leer, limpia `undefined` al escribir).
- `ai` usa `data` para ejecutar herramientas y `core` para calcular.
- `features` nunca escribe en Firebase directamente: llama a acciones de `state`/`data`.

### 2.4 Guardado del mes

- Mantener el patrón de la web: estado local del mes + **escritura completa con debounce** (≈1,2 s) y estado "Guardando/Guardado".
- **Implementado (rama `feature/sincronizacion-tiempo-real`):** `onValue` en el mes activo, la caja, las cuotas y las categorías, ignorando el eco propio y las ediciones locales sin guardar (ADR-005). Ante conflicto gana la última escritura. Evaluar escrituras parciales con `update()` por ruta (`gastos/{g}/{p}/items/{i}`) en una versión posterior.

## 3. Decisiones de arquitectura (ADR)

### ADR-001 — Expo/React Native en lugar de Capacitor o Flutter
- **Contexto:** se quiere una app móvil "desde cero" con experiencia nativa y publicable en tiendas.
- **Opciones:** (a) Capacitor envolviendo la web: reutiliza 100% pero la UI sigue siendo web y hereda la deuda de `App.js`; (b) Flutter: excelente UI pero reescritura total en otro lenguaje; (c) Expo/RN: reescritura de UI en React, reuso directo de la lógica JS.
- **Decisión:** (c). La lógica de dominio y de IA (JS) se porta casi literal a `core/` y `ai/`.
- **Consecuencia:** dos UIs (web y móvil) sobre los mismos datos. Mitigación: `core` compartible (ver ADR-006).

### ADR-002 — Mantener Firebase RTDB y el esquema actual
- **Decisión:** no migrar a Firestore ni cambiar el esquema; la app móvil y la web conviven.
- **Consecuencia:** se heredan los formatos legados y la escritura del mes completo.

### ADR-003 — Las cuentas las hace el código
- **Decisión:** la IA clasifica e interpreta; los montos los calcula `core`. Las herramientas del chat devuelven totales ya calculados.

### ADR-004 — IA detrás de un proxy (implementado con Cloudflare Workers)
- **Contexto:** antes cada usuario guardaba su clave de Groq en `config/{uid}` y el cliente llamaba a Groq directo. En una app de tienda eso obliga a cada usuario a tener clave y expone el patrón.
- **Decisión (implementada):** Worker de Cloudflare `ia-worker/` (§1.1) con la clave como secreto; valida la sesión, aplica límite por usuario y reenvía a Groq. Las herramientas del chat se ejecutan en el cliente (con la sesión del usuario, protegidas por las reglas de RTDB), así que el Worker no necesita Admin SDK.
- **Por qué Cloudflare y no Cloud Functions:** evita el plan Blaze de Firebase; el plan gratuito de Workers alcanza (de ahí que el Worker no parsee el cuerpo, por el límite de CPU).
- **Pendiente:** premium/suscripciones (TODO en el Worker).

### ADR-007 — Capacitor como app móvil actual
- **Contexto:** se necesitaba una app instalable ya, sin reescribir la UI.
- **Decisión:** empaquetar `build/` con Capacitor 8 (`capacitor.config.json`, id `uy.numerosclaros.app`, `webDir: build`; permisos `INTERNET` y `CAMERA`) y dar a la web un diseño de celular (≤ 900 px) con barra de pestañas, hojas inferiores e íconos del prototipo.
- **Flujo:** `npm run android:sync` (build + `cap sync android`) y `npm run android:open` (Android Studio).
- **Consecuencia:** una sola base de código para web y Android. Prima sobre ADR-001 en el corto plazo; la app Expo sigue siendo opción a futuro.

### ADR-005 — Escritura del mes completo + sincronización en vivo
- **Decisión v1:** igual que la web (simplicidad y compatibilidad). Riesgo: dos personas editando el mismo mes a la vez pueden pisarse. Mejora futura: `update()` por ruta.
- **Sincronización en vivo (implementada en la web, rama `feature/sincronizacion-tiempo-real`):** el mes, la caja de ahorro, las cuotas (`_financiaciones`) y las categorías (`_defaults`) se leen con `onValue`, así que todos los dispositivos con el presupuesto abierto ven los cambios de los demás en segundos.
  - **Eco propio:** `escribiendo.current.{mes|caja|fin}` cuenta las escrituras en curso de este dispositivo; mientras sea > 0 los avisos se ignoran (son lo que acabamos de guardar).
  - **Ediciones sin guardar:** mientras corre el debounce de 1,2 s (`saveTimer`) los avisos remotos del mes se ignoran; al guardar, esas ediciones quedan (gana la última escritura). Por eso el riesgo de pisarse se reduce a cambios hechos en el mismo par de segundos.
  - El mes no se vuelve a suscribir cuando cambian las categorías (depende de que *haya* defaults, no de su contenido) para no perder ediciones locales.
  - No es en vivo: `_meta` (nombre y monedas del presupuesto), la lista de presupuestos e invitaciones (se leen al entrar).

### ADR-006 — Dominio compartible
- **Decisión:** escribir `core/` en TypeScript sin dependencias, con tests. A futuro puede publicarse como paquete interno y reemplazar `tarjetas.js`/`financiaciones.js` de la web para tener una única implementación.

## 4. Mapa de portado (web → móvil)

| Web (`src/`) | Móvil |
|--------------|-------|
| `constants.js` | `core/periodos.ts`, `core/meses.ts` |
| `tarjetas.js`, funciones de `GrupoGastos.js` (`aplicarPagoTarjeta`, `revertirPagoTarjeta`, `toPeriodos`) | `core/tarjetas.ts`, `core/gastos.ts` |
| `financiaciones.js` | `core/cuotas.ts`, `core/arrastre.ts` |
| `normalizeMesData`, `initMesData`, `toArray` (App.js) | `data/normalizar.ts`, `core/mes.ts` |
| Totales de `Dashboard.js` / `Resumen.js` | `core/totales.ts` (una sola función que devuelve todo §10 de [02](./02-dominio-y-reglas.md)) |
| `aplicarComprobante` (App.js), prorrateo (AplicarDesglose.js) | `core/comprobantes.ts` |
| `ia.js` | `ai/tickets.ts` |
| `iaChat.js` | `ai/chat/contexto.ts`, `ai/chat/herramientas.ts`, `ai/chat/ciclo.ts` |
| `AuthContext.js` | `state/sesion.ts` + `data/auth.ts` |
| Componentes | `features/*` (ver [06](./06-pantallas-y-flujos.md)) |
