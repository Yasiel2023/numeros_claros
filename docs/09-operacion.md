# 09 — Operación y entorno

## 1. Proyecto Firebase

| Dato | Valor |
|------|-------|
| Proyecto | `numeros-claros` (`.firebaserc`) |
| Realtime Database | `https://numeros-claros-default-rtdb.firebaseio.com` |
| Hosting | `https://numeros-claros.web.app` |
| Auth | Email/contraseña |
| Cuenta con acceso a la CLI | `numerosclaros27@gmail.com` |
| Configuración web | `src/firebase.js` (la `apiKey` es pública por diseño) |

Para la app móvil se usa el **mismo** `firebaseConfig` (app web registrada) o se registran apps Android/iOS en la consola si se agregan servicios nativos (Crashlytics, notificaciones).

## 2. App web: desarrollo y despliegue

Requisitos: Node.js LTS (probado con v24), npm.

```bash
npm install
npm start                                  # http://localhost:3000
npm run build                              # genera build/
npx firebase-tools login                   # una vez por PC
npx firebase-tools deploy --only hosting   # publica la web
npx firebase-tools deploy --only database  # publica database.rules.json (¡cuidado!)
npx firebase-tools database:get "/.settings/rules"   # ver las reglas publicadas
```

- Publicar siempre con `--only hosting` salvo que se quieran cambiar las reglas a propósito.
- El repo **versiona `build/`** (convención actual): compilar antes de commitear cambios de la web.
- `firebase.json`: `hosting.public = "build"`, rewrite `** → /index.html` (una ruta inexistente devuelve la app con 200, no 404), sin caché para `index.html`, `manifest.json` y `service-worker.js`.
- PWA: `public/manifest.json`, `public/service-worker.js` (HTML desde la red, `/static/*` desde caché, otros dominios sin tocar), íconos `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`. El service worker se registra solo en producción.
- En PowerShell, pasar mensajes de commit con comillas desde archivo (`git commit -F archivo`) para evitar que se corten.

## 3. App móvil: entorno

```bash
npx create-expo-app@latest           # ver Fase 0 en 08
npx expo start                       # desarrollo con Expo Go o dev client
eas build --profile preview -p android    # APK de prueba
eas build --profile production -p android # AAB para Google Play
eas submit -p android
```

- Google Play: cuenta de desarrollador (pago único 25 USD).
- App Store: cuenta Apple Developer (99 USD/año); EAS compila iOS en la nube.
- Secretos (si se usa Cloud Function): `firebase functions:secrets:set GROQ_API_KEY` (requiere plan Blaze).

## 4. Estado del repositorio (octubre 2026)

| Ruta | Estado |
|------|--------|
| `src/` | Código de la web (ver [04 §1](./04-arquitectura.md#1-arquitectura-actual-web)) |
| `src/components/Basicos.js`, `Impuestos.js`, `Asceo.js`, `Ocio.js`, `Semanas.js` | **Huérfanos** (no se importan); reemplazados por `GrupoGastos.js` |
| `src/firestore.rules`, `firestore.rules`, `Nueva carpeta (2)/firestore.rules` | Legados (no se usa Firestore) |
| `Nueva carpeta/`, `Nueva carpeta (2)/` (raíz) | Restos de una versión v1 con Firestore; no participan del build |
| `README.md`, `src/README.md` | Desactualizados (describen Firestore); la referencia es `docs/` |
| `database.rules.json` | Reglas vigentes (publicadas) |
| `package-lock.json` | Sin versionar todavía |

## 5. Deuda técnica y bugs conocidos

| # | Tipo | Descripción | Acción sugerida |
|---|------|-------------|-----------------|
| D1 | Bug | El arrastre de tarjetas de crédito conserva `cargos` del mes anterior con `monto = 0` | Quitar `cargos` en `tarjetasParaMesNuevo` (móvil ya debe hacerlo; corregir web) |
| D2 | Seguridad | `defaults` editable por cualquier usuario; el onboarding sobrescribe `defaults/general` | Restringir a admins fijos; quitar escritura del onboarding |
| D3 | Seguridad | `admins` auto-asignable | No usarlo para autorizar; o fijarlo en reglas |
| D4 | Funcional | No se puede revocar el acceso de un miembro | Regla + UI para que el dueño borre `accesos/{miembro}/{pid}` |
| D5 | Rendimiento | Listar presupuestos lee `presupuestos/{uid}` completo | Listar desde `accesos/{uid}` |
| D6 | Concurrencia | El mes se escribe completo: ediciones simultáneas se pisan | Suscripción en vivo; luego `update()` por ruta |
| D7 | Código | `App.js` concentra todo el estado (~1100 líneas); `toArray`/`encodeEmail` duplicados | En móvil: capas `core/data/state` |
| D8 | IA | Clave de Groq por usuario en el cliente | Cloud Function (ADR-004) |
| D9 | Datos | `gemini_api_key` en `config` ya no se usa (la IA pasó a Groq) y la sección sigue en Configuración | Quitar de la UI |
| D10 | Limpieza | Componentes huérfanos, reglas de Firestore y carpetas `Nueva carpeta*` | Borrar tras confirmar |

## 6. Historial relevante (commits en `master`)

| Commit | Cambio |
|--------|--------|
| `11bb519` | Comprobante desde el sidebar, IA con Groq, tarjeta de pago y descuento, modo carrito, arrastre de tarjetas, "Supermercado" en pantalla |
| `d24f0b2` | Registro de comprobantes y cámara nativa en el móvil |
| `2336cc8` | Chat de IA con contexto editable y herramientas |
| `8b8af97` | Herramientas `listar_gastos` / `sumar_gastos` |
| `ce48740` | Reglas de seguridad por usuario y presupuesto |
| `ffd5e7d` | PWA instalable |
| `dea56f6` | Limpieza de builds viejos en `public/` |
