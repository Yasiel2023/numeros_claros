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

## 2.1 Worker de IA (Cloudflare)

Carpeta `ia-worker/` (Wrangler, `jose` como única dependencia). Cuenta de Cloudflare con el subdominio `numeros-claros-ia-worker.workers.dev`.

```bash
cd ia-worker
npm install
npx wrangler login                       # una vez por PC
npx wrangler secret put GROQ_API_KEY     # pega la clave de Groq (secreto, no se versiona)
npx wrangler deploy                      # publica numeros-claros-ia
npx wrangler dev                         # probar en local
```

- Para que la IA funcione, un administrador debe poner `sistema/ia/activa = true` (pantalla Configuración) y su `uid` debe estar en `admins/{uid} = true` (se carga a mano en la consola de Firebase).
- URL que usa la app: `https://numeros-claros-ia.numeros-claros-ia-worker.workers.dev`; se puede cambiar al compilar con la variable `REACT_APP_IA_URL` (por ejemplo para un Worker de pruebas).
- Límite por usuario: `[[ratelimits]]` de `wrangler.toml` (20 por minuto). Si se cambia el proyecto de Firebase hay que editar `PROYECTO` y `RTDB` en `src/index.js`.
- El Worker es independiente del hosting: publicar la web no lo actualiza ni viceversa.

## 2.2 App Android (Capacitor)

Requisitos: Android Studio (con SDK) y JDK. Id de la app `uy.numerosclaros.app` (`capacitor.config.json`).

```bash
npm run android:sync     # react-scripts build + cap sync android (copia build/ a android/)
npm run android:open     # abre el proyecto en Android Studio para correr o generar el APK/AAB
```

- Permisos del manifiesto: `INTERNET` y `CAMERA` (la cámara es opcional: `uses-feature ... required="false"`).
- El WebView sirve la web desde `https://localhost`, que ya está permitido en el CORS del Worker.
- Siempre hay que correr `android:sync` después de cambiar el código web; `android/` no se actualiza solo.
- `.idea/` (configuración local de Android Studio) está en `.gitignore`.

## 3. App móvil nativa a futuro: entorno

> Solo aplica si se hace la app con Expo (ver [04 ADR-001](./04-arquitectura.md)); la app actual se genera con Capacitor (§2.2).

```bash
npx create-expo-app@latest           # ver Fase 0 en 08
npx expo start                       # desarrollo con Expo Go o dev client
eas build --profile preview -p android    # APK de prueba
eas build --profile production -p android # AAB para Google Play
eas submit -p android
```

- Google Play: cuenta de desarrollador (pago único 25 USD).
- App Store: cuenta Apple Developer (99 USD/año); EAS compila iOS en la nube.
- La IA no necesita Cloud Functions ni plan Blaze: usa el Worker de §2.1.

## 4. Estado del repositorio (octubre 2026)

| Ruta | Estado |
|------|--------|
| `src/` | Código de la web y del diseño de celular (ver [04 §1](./04-arquitectura.md#1-arquitectura-actual-web)) |
| `ia-worker/` | Worker de Cloudflare con el proxy de IA (§2.1) |
| `android/`, `capacitor.config.json` | Proyecto Android de Capacitor (§2.2) |
| `src/components/Basicos.js`, `Impuestos.js`, `Asceo.js`, `Ocio.js`, `Semanas.js` | **Huérfanos** (no se importan); reemplazados por `GrupoGastos.js`. Ojo: `App.js` aún importa `Semanas` |
| `src/firestore.rules`, `firestore.rules`, `Nueva carpeta (2)/firestore.rules` | Legados (no se usa Firestore) |
| `Nueva carpeta/`, `Nueva carpeta (2)/` (raíz) | Restos de una versión v1 con Firestore; no participan del build |
| `README.md`, `src/README.md` | Desactualizados (describen Firestore); la referencia es `docs/` |
| `database.rules.json` | Reglas vigentes (publicadas) |
| `package-lock.json` | Versionado (también `ia-worker/package-lock.json`) |

## 5. Deuda técnica y bugs conocidos

| # | Tipo | Descripción | Acción sugerida |
|---|------|-------------|-----------------|
| D1 | Bug | El arrastre de tarjetas de crédito conserva `cargos` del mes anterior con `monto = 0` | Quitar `cargos` en `tarjetasParaMesNuevo` (móvil ya debe hacerlo; corregir web) |
| D2 | Seguridad | ~~`defaults` editable por cualquier usuario~~ **Resuelto**: solo admins escriben `defaults` y `sistema`; el onboarding ya no pisa `defaults/general` | — |
| D3 | Seguridad | ~~`admins` auto-asignable~~ **Resuelto**: `admins` es de solo lectura desde la app; se asigna a mano en la consola | — |
| D4 | Funcional | No se puede revocar el acceso de un miembro | Regla + UI para que el dueño borre `accesos/{miembro}/{pid}` |
| D5 | Rendimiento | Listar presupuestos lee `presupuestos/{uid}` completo | Listar desde `accesos/{uid}` |
| D6 | Concurrencia | El mes se escribe completo: ediciones simultáneas se pisan | Suscripción en vivo; luego `update()` por ruta |
| D7 | Código | `App.js` concentra todo el estado (~1450 líneas); `toArray`/`encodeEmail` duplicados | En móvil: capas `core/data/state` |
| D8 | IA | ~~Clave de Groq por usuario en el cliente~~ **Resuelto**: Worker de Cloudflare (ADR-004). Pendiente: límite por suscripción premium | Ver TODO en `ia-worker/src/index.js` |
| D9 | Datos | ~~`gemini_api_key` en `config`~~ **Resuelto en la UI**: Configuración solo edita `sistema/ia`. Quedan datos legados en `config/{uid}` | Borrar el nodo `config` cuando se confirme |
| D10 | Limpieza | Componentes huérfanos, reglas de Firestore y carpetas `Nueva carpeta*` | Borrar tras confirmar |
| D11 | Consistencia | Ahorro descontado de una tarjeta (Caja de ahorro): el movimiento de la caja (nivel presupuesto) y el de la tarjeta (dentro del mes) se guardan por separado; si se borra el movimiento en otro mes no se devuelve el saldo | Mostrar aviso o guardar el movimiento de la caja dentro del mes |
| D12 | Datos | `tarjetasParaMesNuevo` sigue conservando `cargos` del mes anterior (ver D1) y ahora puede haber cargos negativos (ajustes a favor) arrastrados con `monto = 0` | Quitar `cargos` al arrastrar |
| D13 | Código | `ia.js` conserva el nombre `llamarGroq` y un comentario que dice "Cloud Function"; en realidad llama al Worker | Renombrar a `llamarModelo` y corregir el comentario |

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
| `a7996fc` | App Android (Capacitor), monedas por presupuesto, IA para crear presupuestos, clave global del sistema, docs/ |
| `0a7d3c8` | Categorías de gastos a mitad de mes |
| `45997fb` | Menú a pantalla completa en el móvil y modales centrados |
| `15add90` | IA vía Cloudflare Worker: la clave de Groq sale del cliente |
| `c6414ac`, `7e3bdc3` | Diseño de app en el celular e interfaz web con el diseño del prototipo |
| `ec3fe65` | Cómo va el mes, eliminar categorías y ajustes en tarjetas |
