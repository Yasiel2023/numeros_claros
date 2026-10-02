# 07 — Seguridad y privacidad

## 1. Modelo de amenazas

| Amenaza | Mitigación |
|---------|------------|
| Un usuario registrado lee/modifica presupuestos ajenos | Reglas de RTDB por dueño y miembros (§2) |
| Alguien se auto-otorga acceso escribiendo en `accesos` | La regla exige una invitación **pendiente** del dueño |
| Lectura masiva de emails registrados | `email_uid` solo se lee por clave puntual (no la raíz) |
| Robo de claves de IA de otros usuarios | `config/{uid}` legible solo por su dueño |
| Extracción de la clave de IA del binario móvil | Cloud Function como proxy (§3) |
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
    "admins":   { ".read": "auth != null", "$uid": { ".write": "auth != null && auth.uid === $uid && (!newData.exists() || newData.val() === true)" } },
    "defaults": { ".read": "auth != null", ".write": "auth != null" }
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

- `defaults` (plantillas globales) es editable por cualquier usuario con sesión, porque la web permite editarlas y el onboarding escribe `defaults/general`. No son datos personales, pero pueden ser alterados. Recomendación: restringir escritura a una lista de administradores fija en las reglas y quitar la escritura del onboarding.
- `admins` es auto-asignable; hoy no otorga permisos. **No** usarlo para autorizar nada sin cambiar antes su regla.
- Los miembros tienen permisos de escritura completos sobre el presupuesto compartido (incluido `_meta`).
- No hay forma de revocar el acceso de un miembro desde la app (el dueño no puede borrar `accesos/{miembro}/{pid}`). Requiere una regla y una pantalla nuevas.

### 2.3 Cómo verificar las reglas

- Sin sesión, `GET https://numeros-claros-default-rtdb.firebaseio.com/presupuestos.json?shallow=true` debe responder **401**.
- Recomendado: suite con el **Firebase Emulator Suite** (`@firebase/rules-unit-testing`) que cubra: dueño lee/escribe; miembro lee/escribe solo su presupuesto; desconocido no lee; auto-acceso sin invitación falla; invitación de un no-dueño falla; aceptar con invitación pendiente funciona.

## 3. Claves de IA

**Hoy (web):** cada usuario guarda su clave de Groq en `config/{uid}/groq_api_key` y el navegador llama a Groq directamente con esa clave.

**Recomendado para la app de tiendas (ADR-004):**

```
App ──(ID token de Firebase)──► Cloud Function `ia` ──(clave en Secret Manager)──► Groq
```

- La función verifica el token, limita el uso por usuario (por ejemplo N tickets/día), valida tamaño de imagen y reenvía.
- Para el chat, si las herramientas se ejecutan en el servidor con Admin SDK, **la función debe verificar** que el usuario tiene acceso al presupuesto (`accesos/{uid}/{pid}.ownerUid === owner` o `uid === owner`), porque Admin SDK ignora las reglas.
- Mientras no exista la función, mantener la clave por usuario (configuración) detrás de un flag.

## 4. Privacidad

- Datos financieros: solo en RTDB del proyecto, protegidos por reglas.
- A terceros (Groq): ver [05 §5](./05-ia.md#5-privacidad-de-la-ia). Informarlo en la política de privacidad de la tienda.
- Fotos de tickets: se procesan en memoria y no se almacenan.
- La `apiKey` de `firebaseConfig` no es secreta por diseño; la protección real son las reglas.
- Logs/telemetría: no incluir montos, nombres de gastos, emails ni claves.
