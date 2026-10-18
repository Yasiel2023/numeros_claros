# 07 — Seguridad y privacidad

## 1. Modelo de amenazas

| Amenaza | Mitigación |
|---------|------------|
| Un usuario registrado lee/modifica presupuestos ajenos | Reglas de RTDB por dueño y miembros (§2) |
| Alguien se auto-otorga acceso escribiendo en `accesos` | La regla exige una invitación **pendiente** del dueño |
| Lectura masiva de emails registrados | `email_uid` solo se lee por clave puntual (no la raíz) |
| Robo de claves de IA | La clave de Groq no está en la base ni en el cliente: es un secreto del Worker de Cloudflare (§3) |
| Extracción de la clave de IA del binario móvil | No existe en el binario; el Worker exige un ID token de Firebase válido |
| Abuso del cupo de IA | Límite por usuario en el Worker (20 pedidos/min), tamaño máximo de pedido y interruptor `sistema/ia/activa` |
| La IA "pide" datos de otro presupuesto | Las herramientas no aceptan presupuesto/usuario como parámetro; las lecturas usan la sesión del usuario y las reglas las validan |
| Fuga de datos financieros a terceros | Solo se envía a Groq lo necesario (ver [05 §5](./05-ia.md#5-privacidad-de-la-ia)); no se guarda la foto |

## 2. Reglas de Realtime Database (publicadas)

Archivo `database.rules.json` (publicado con `firebase deploy --only database`):

```json
{
  "rules": {
    "presupuestos": {
      "$owner": {
        ".read": "auth != null && auth.uid === $owner",
        ".write": "auth != null && auth.uid === $owner",
        "$pid": {
          ".read": "auth != null && root.child('accesos').child(auth.uid).child($pid).child('ownerUid').val() === $owner",
          ".write": "auth != null && root.child('accesos').child(auth.uid).child($pid).child('ownerUid').val() === $owner"
        }
      }
    },
    "accesos": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$pid": {
          ".read": "auth != null && root.child('presupuestos').child(auth.uid).child($pid).exists()",
          ".write": "auth != null && auth.uid === $uid && (!newData.exists() || (newData.child('ownerUid').val() === auth.uid && root.child('presupuestos').child(auth.uid).child($pid).exists()) || (newData.child('rol').val() === 'miembro' && root.child('invitaciones').child(auth.uid).child($pid).child('estado').val() === 'pendiente' && root.child('invitaciones').child(auth.uid).child($pid).child('ownerUid').val() === newData.child('ownerUid').val()))"
        }
      }
    },
    "invitaciones": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$pid": {
          ".read": "auth != null && root.child('presupuestos').child(auth.uid).child($pid).exists()",
          ".write": "auth != null && ((newData.child('ownerUid').val() === auth.uid && root.child('presupuestos').child(auth.uid).child($pid).exists()) || (auth.uid === $uid && data.exists() && newData.child('ownerUid').val() === data.child('ownerUid').val() && newData.child('presupuestoId').val() === data.child('presupuestoId').val()))"
        }
      }
    },
    "config":         { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid" } },
    "user_templates": { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid" } },
    "email_uid": {
      "$email": {
        ".read": "auth != null",
        ".write": "auth != null && newData.val() === auth.uid && ($email === auth.token.email.replace('.', ',') || $email === auth.token.email.toLowerCase().replace('.', ','))"
      }
    },
    "admins":   { ".read": "auth != null", ".write": false },
    "sistema":  { ".read": "auth != null", ".write": "auth != null && root.child('admins').child(auth.uid).val() === true" },
    "defaults": { ".read": "auth != null", ".write": "auth != null && root.child('admins').child(auth.uid).val() === true" }
  }
}
```

### 2.1 Implicancias para la implementación

- **Orden de escrituras obligatorio**:
  - Crear presupuesto: `_meta` → `_defaults` → `accesos/{uid}/{pid}` (la regla de accesos exige que el presupuesto exista).
  - Aceptar invitación: `accesos/{uid}/{pid}` (rol miembro) → `invitaciones/{uid}/{pid}/estado = 'aceptada'`.
- Un miembro **no** puede leer `presupuestos/{owner}` completo, solo `presupuestos/{owner}/{pid}`.
- El dueño puede leer `accesos/{otro}/{pid}` e `invitaciones/{otro}/{pid}` de **sus** presupuestos (para validar invitaciones).
- Los errores de permisos (`PERMISSION_DENIED`) deben mostrarse como mensaje comprensible y registrarse.

### 2.2 Riesgos aceptados (pendientes)

- ~~`defaults` editable por cualquiera~~ y ~~`admins` auto-asignable~~: **resueltos**. `admins` es de solo lectura desde la app (se asigna a mano en la consola de Firebase) y `defaults` y `sistema` solo los escriben los admins. El onboarding ya no escribe `defaults/general`.
- `sistema/ia` es **legible por cualquier usuario con sesión** (la app necesita saber si la IA está activa). Por eso no debe guardar secretos: solo `activa`, `groq_url` y `groq_model`.
- La regla de `admins/{uid}` también se lee desde el Worker con el token del usuario para eximir del límite de uso.
- Los miembros tienen permisos de escritura completos sobre el presupuesto compartido (incluido `_meta`).
- No hay forma de revocar el acceso de un miembro desde la app (el dueño no puede borrar `accesos/{miembro}/{pid}`). Requiere una regla y una pantalla nuevas.

### 2.3 Cómo verificar las reglas

- Sin sesión, `GET https://numeros-claros-default-rtdb.firebaseio.com/presupuestos.json?shallow=true` debe responder **401**.
- Recomendado: suite con el **Firebase Emulator Suite** (`@firebase/rules-unit-testing`) que cubra: dueño lee/escribe; miembro lee/escribe solo su presupuesto; desconocido no lee; auto-acceso sin invitación falla; invitación de un no-dueño falla; aceptar con invitación pendiente funciona.

## 3. Claves de IA

**Hoy (implementado, ADR-004):**

```
App ──(ID token de Firebase)──► Worker de Cloudflare `numeros-claros-ia` ──(secreto GROQ_API_KEY)──► Groq
```

- El Worker verifica la firma del token contra las claves públicas de Google, exige `activa === true` en `sistema/ia`, limita por usuario (20 pedidos/min con Rate Limiting de Cloudflare; admins sin límite), acota el tamaño del pedido (6 MB) y elige el modelo.
- La clave se carga con `npx wrangler secret put GROQ_API_KEY` (dentro de `ia-worker/`); nunca se guarda en RTDB ni en el repositorio.
- Las herramientas del chat se ejecutan en el **cliente** con la sesión del usuario, así que las reglas de RTDB siguen siendo la barrera de acceso a los datos. Si en el futuro se ejecutaran en el servidor con Admin SDK, habría que verificar acceso al presupuesto (`accesos/{uid}/{pid}.ownerUid === owner` o `uid === owner`).
- `config/{uid}` (clave por usuario) quedó **legado**: ya no se lee ni se escribe.
- Pendiente: restringir por suscripción premium (TODO en `ia-worker/src/index.js`).

## 4. Privacidad

- Datos financieros: solo en RTDB del proyecto, protegidos por reglas.
- A terceros (Groq, a través del Worker de Cloudflare): ver [05 §5](./05-ia.md#5-privacidad-de-la-ia). Informarlo en la política de privacidad de la tienda.
- Fotos de tickets: se procesan en memoria y no se almacenan.
- La `apiKey` de `firebaseConfig` no es secreta por diseño; la protección real son las reglas.
- Logs/telemetría: no incluir montos, nombres de gastos, emails ni claves.
