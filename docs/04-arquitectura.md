# 04 — Arquitectura

## 1. Arquitectura actual (web)

```
┌──────────────────────── Navegador ─────────────────────────┐
│ React 18 (Create React App, sin router, sin store global)   │
│  App.js (AppInterna) ── estado central: presupuestos, mes,  │
│     mesData, defaults, tarjetas, caja, financiaciones, vista │
│  components/* ── pantallas (props hacia abajo)              │
│  Dominio: tarjetas.js · financiaciones.js · constants.js    │
│  IA: ia.js (tickets) · iaChat.js (chat con herramientas)    │
│  PWA: manifest.json + service-worker.js                     │
└───────┬───────────────────────────┬─────────────────────────┘
        │ Firebase JS SDK 10        │ fetch (Bearer clave del usuario)
        ▼                           ▼
 Firebase Auth + Realtime DB    Groq API (OpenAI-compatible)
 Firebase Hosting (SPA)         · visión: qwen/qwen3.8-27b
                                · chat: openai/gpt-oss-120b (configurable)
```

| Pieza | Detalle |
|-------|---------|
| UI | React 18, `react-scripts` 5, `lucide-react` (íconos), `recharts` (Resumen), Chart.js 3.9.1 por CDN (gráficos del chat). Un único `App.css`. |
| Navegación | Estado `vista` en `App.js` (`dashboard`, `ingresos`, `grupo_{id}`, `tarjetas`, `comprobantes`, `resumen`, `caja`, `chat`, `plantillas`, `config`). Sidebar con menú dinámico (un ítem por categoría). |
| Estado | Todo en `AppInterna`; autoguardado con debounce de 1200 ms (`updateMesData` → `set`). |
| Dominio | `src/tarjetas.js` (crédito/débito, gasto real), `src/financiaciones.js` (cuotas, arrastre), `src/constants.js` (meses, frecuencias, semanas), `GrupoGastos.js` (exporta `toPeriodos`, `aplicarPagoTarjeta`, `tarjetasDisponibles`, `saldoActualDebito`). |
| IA | `src/ia.js`: lectura de tickets y sugerencias (Groq, reintentos, achicado de imagen). `src/iaChat.js`: contexto, herramientas y ciclo de *tool calling*. |
| Hosting | Firebase Hosting, carpeta `build/`, rewrite `** → /index.html`, sin caché para `index.html`, `manifest.json` y `service-worker.js`. |

## 2. Arquitectura objetivo (app móvil)

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
 Firebase Auth + RTDB          Cloud Function "ia" (recomendado, ADR-004)
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
- Mejora recomendada: usar `onValue` (suscripción) en el mes activo para ver en vivo los cambios de otros miembros; ante conflicto, la última escritura gana (igual que hoy). Evaluar escrituras parciales con `update()` por ruta (`gastos/{g}/{p}/items/{i}`) en una versión posterior (ADR-005).

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

### ADR-004 — IA detrás de una Cloud Function
- **Contexto:** hoy cada usuario guarda su clave de Groq en `config/{uid}` y el cliente llama a Groq directo. En una app de tienda eso obliga a cada usuario a tener clave y expone el patrón.
- **Decisión recomendada:** Cloud Function HTTPS/callable `ia` con la clave en Secret Manager; valida `auth`, aplica límites por usuario y reenvía a Groq. Las herramientas del chat se pueden ejecutar en el cliente (con la sesión del usuario, protegidas por reglas) o en la función con Admin SDK **verificando acceso** al presupuesto.
- **Costo:** requiere plan Blaze. Alternativa v1: mantener la clave por usuario (comportamiento actual) detrás de un flag.

### ADR-005 — Escritura del mes completo
- **Decisión v1:** igual que la web (simplicidad y compatibilidad). Riesgo: dos personas editando el mismo mes a la vez pueden pisarse. Mitigación v1: suscripción en vivo. Mejora futura: `update()` por ruta.

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
