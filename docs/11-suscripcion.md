# 11 — Suscripción premium (rama `feature/suscripcion-premium`)

## 1. Qué hace

- **Prueba gratis**: durante `dias_prueba` días desde que el usuario abrió la app por primera vez, tiene todo (IA y presupuestos ilimitados).
- **Después, sin premium (versión gratis)**: la app sigue funcionando completa **salvo**:
  - **Sin IA**: se ocultan tickets con cámara, "Armalo con IA" y Preguntas IA, y el Worker rechaza los pedidos (`403`).
  - **Un solo presupuesto propio editable**: el más antiguo (`_meta.creadoEn`). Los demás propios se ven pero son de **solo lectura**; no se puede crear uno nuevo. Los presupuestos que otros comparten con el usuario no cuentan para el límite. No se borra ningún dato.
- **Premium**: todo habilitado mientras `suscripciones/{uid}.premium === true` y no haya pasado `hasta`.
- **Administradores** (`admins/{uid}`) siempre tienen todo.
- **Interruptor general**: con `sistema/suscripcion/activa` distinto de `true` el sistema está apagado y todos tienen todo. Así se puede publicar el código sin afectar a nadie hasta activarlo.

## 2. Datos (Realtime Database)

| Nodo | Contenido | Quién escribe |
|------|-----------|---------------|
| `sistema/suscripcion` | `{ activa: boolean, dias_prueba: number }` (por defecto 14 días) | admins, a mano en la consola |
| `usuarios/{uid}/creadoEn` | ISO de la primera apertura con esta versión (los usuarios que ya existían empiezan su prueba ese día) | el propio usuario, **una sola vez** (la regla no deja cambiarlo ni borrarlo) |
| `suscripciones/{uid}` | `{ premium, hasta, cancelada, producto, tienda, evento, evento_ms, actualizado }` | solo admins y el Worker (cuenta de servicio) |

Para dar premium a mano (pruebas o regalos): en la consola de Firebase, `suscripciones/{uid}` = `{ "premium": true, "hasta": "2027-01-01T00:00:00.000Z" }`.

## 3. Cálculo

Función pura `calcularEstado` en `src/suscripcion.js` (probada) y su copia reducida en `ia-worker/src/index.js`:

- `premium = esAdmin || (premium === true && (hasta vacío || hasta > ahora))`
- `enPrueba = creadoEn + dias_prueba·día > ahora`
- `restringido = activa && !premium && se conoce creadoEn && !enPrueba`

Ante un error de lectura (sin red) **no se restringe** al usuario en la app; la IA igual se corta en el servidor.

## 4. Dónde se aplica

| Lugar | Qué hace |
|-------|----------|
| `App.js` | `groqApiKey` (bandera de IA) es falsa si `restringido`; `soloLectura` bloquea `updateMesData`, caja de ahorro, financiaciones, agregar/eliminar categoría; `abrirNuevoPresupuesto` lleva al plan si ya tiene uno |
| `components/PlanPremium.js` | Pantalla "Plan premium" (menú / Más) y aviso `AvisoPlan` arriba de las pantallas (últimos 3 días de prueba, versión gratis, presupuesto en solo lectura) |
| `ia-worker/src/index.js` | `403` si el sistema está activo, el usuario no es admin ni premium y la prueba venció |
| `database.rules.json` | Nodos `usuarios` y `suscripciones` |

## 5. Pago (Google Play Billing con RevenueCat)

```
App (Android) ──compra──► RevenueCat ──► Google Play
                               │ webhook
                               ▼
                    Worker /webhook/revenuecat ──(cuenta de servicio)──► suscripciones/{uid}
                                                                              ▲
                              App lee el estado (src/suscripcion.js) ─────────┘
```

- Google Play exige su facturación para suscripciones dentro de la app, por eso el cobro solo existe en Android; la web muestra cómo suscribirse desde la app.
- **Cliente** (`src/pagos.js`): `@revenuecat/purchases-capacitor`. Se asocia la compra al uid de Firebase (`appUserID`), se leen los planes del *offering* actual, se compra y se puede restaurar. Clave pública: variable `REACT_APP_RC_ANDROID_KEY` al compilar.
- **Servidor** (`webhookRevenueCat` en el Worker): autentica con `Authorization: Bearer {REVENUECAT_WEBHOOK_SECRET}`, ignora usuarios anónimos y eventos de prueba, descarta avisos más viejos que el guardado y traduce el evento: `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION` → premium con `hasta`; `CANCELLATION`, `BILLING_ISSUE` → sigue premium hasta que venza (`cancelada: true`); `EXPIRATION` → `premium: false`.
- El premium nunca lo escribe el cliente: las reglas lo impiden.

### Qué falta configurar afuera del código (checklist)

1. **Google Play Console**: cuenta de desarrollador, app creada con el id `uy.numerosclaros.app`, APK/AAB firmado subido a una pista (interna alcanza para probar) y productos de suscripción (por ejemplo `premium_mensual`, `premium_anual`).
2. **RevenueCat**: proyecto con la app de Android, credenciales de servicio de Google Play, *entitlement* `premium`, *offering* actual con los paquetes mensual/anual, y la clave pública de Android.
3. **Webhook**: en RevenueCat apuntar a `https://numeros-claros-ia.numeros-claros-ia-worker.workers.dev/webhook/revenuecat` con el encabezado `Authorization: Bearer <secreto>`.
4. **Secretos del Worker**: `npx wrangler secret put REVENUECAT_WEBHOOK_SECRET` y `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (JSON de la cuenta de servicio de Firebase), luego `npx wrangler deploy`.
5. **Reglas**: `npx firebase-tools deploy --only database` (nodos nuevos).
6. **Compilar la app** con `REACT_APP_RC_ANDROID_KEY=<clave pública>` y `npm run android:sync`.
7. **Activar**: en la consola, `sistema/suscripcion` = `{ "activa": true, "dias_prueba": 14 }`.

> Sin los pasos 1 a 4 la pantalla del plan muestra "Todavía no hay planes disponibles" y la compra no es posible; el resto (prueba, restricciones y premium dado a mano) funciona igual.

## 6. Pendiente y riesgos

- No se probó una compra real: requiere los pasos del checklist.
- La web no cobra; si se quisiera, habría que sumar otro proveedor (por ejemplo Mercado Pago) que escriba el mismo nodo `suscripciones/{uid}`.
- El límite de un presupuesto se aplica en la app; las reglas de la base no lo hacen cumplir (un cliente modificado podría editar presupuestos extra). La IA, en cambio, sí se corta en el servidor.
- Los textos de precios y beneficios de `PlanPremium.js` son provisorios.
- Compilar el APK: el JDK de Android Studio (Java 25) no sirve para Gradle 8.14; usar `JAVA_HOME` con el JDK 21 (`~/.jdks/jbr-21.*`).
